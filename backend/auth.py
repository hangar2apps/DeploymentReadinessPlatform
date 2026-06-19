"""
Authentication & authorization for the DRP API.

DRP is fronted by UDS Authservice (see the Package CR in the chart). Authservice
runs the Keycloak OIDC login flow at the Istio mesh and forwards the validated ID
token to this app as a `Authorization: Bearer <jwt>` header. By the time a request
reaches Flask the token's signature, expiry, and audience have already been checked
by the mesh, so here we only *decode* the claims — we do not re-verify the
signature. That trust boundary is documented in docs/configuration.md.

Source-of-truth split (see docs/justifications.md):

  - Keycloak owns AUTHENTICATION only. The single claim we depend on is `edipi`
    (a Keycloak user attribute; in production it comes from the CAC/PIV cert).
  - The roster DB owns AUTHORIZATION. The `edipi` resolves to a service_members
    row, and that member's role SET comes from the member_roles table. EDIPI is
    the join key between identity and the roster.

Roles are a SET, not a single value, because one person legitimately holds
several: every commander and provider is also a service member who owes their own
assessment. The baseline `service_member` role is implied by having a roster row
and is not stored in member_roles.

Authservice gates the app coarsely (any authenticated UDS user reaches it); a user
whose EDIPI has no roster row is authenticated but unprovisioned and gets 403.

Local development: with no Authservice in front there is no JWT. When Flask runs in
debug mode (or under the test client) identity falls back to `X-Dev-*` request
headers (or the DEV_* config defaults) so `python app.py` + Vite work offline. In
production a real JWT is always present and always wins.
"""

import base64
import binascii
import json
from dataclasses import dataclass, field
from functools import wraps
from typing import Callable, Optional

from flask import current_app, g, jsonify, request

import config
import db

# --- Roles ------------------------------------------------------------------
# Internal role names match the frontend's Role union (frontend/src/lib/roles.ts).
ROLE_COMMANDER = "commander"
ROLE_PROVIDER = "provider"
ROLE_SERVICE_MEMBER = "service_member"

# Privileged roles stored in member_roles (baseline service_member is implied).
_STORED_ROLES = {ROLE_COMMANDER, ROLE_PROVIDER}
_ALL_ROLES = _STORED_ROLES | {ROLE_SERVICE_MEMBER}


@dataclass
class Identity:
    """The authenticated caller, resolved once per request.

    `subject_present` is True when a credential was presented (a decoded JWT or a
    dev header) regardless of whether it mapped to a roster row — it separates
    "anonymous" (401) from "authenticated but unprovisioned / wrong role" (403).
    """

    roles: set[str] = field(default_factory=set)
    edipi: Optional[str] = None
    name: Optional[str] = None
    member_id: Optional[str] = None  # service_members.id (UUID), when resolvable
    unit_id: Optional[str] = None  # command/scope unit for this caller
    subject_present: bool = False


# --- JWT decoding (no signature verification — see module docstring) ---------

def _b64url_decode(segment: str) -> bytes:
    # JWT uses base64url without padding; restore it before decoding.
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def _decode_jwt_claims(token: str) -> dict:
    """Return the JWT payload claims, or {} if the token is unparseable."""
    parts = token.split(".")
    if len(parts) != 3:
        return {}
    try:
        return json.loads(_b64url_decode(parts[1]))
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return {}


def _bearer_token() -> Optional[str]:
    header = request.headers.get(config.AUTH_HEADER, "")
    prefix = "Bearer "
    if header.startswith(prefix):
        return header[len(prefix):].strip()
    return None


# --- Roster resolution (the authorization source of truth) -------------------

def _resolve_member_identity(
    edipi: Optional[str],
) -> tuple[Optional[str], Optional[str], set[str]]:
    """Resolve (member_id, scope_unit_id, roles) for an EDIPI from the roster.

    Best-effort: returns (None, None, set()) when the EDIPI is unknown or the DB
    is unreachable. A resolvable member always carries the baseline
    `service_member` role; additive roles come from member_roles. The scope unit
    is the role's explicit unit_id when set, else the member's own unit.
    """
    if not edipi:
        return None, None, set()
    try:
        row = db.query_one(
            "SELECT id, unit_id FROM service_members WHERE edipi = %s", (edipi,)
        )
    except Exception:
        return None, None, set()
    if not row:
        return None, None, set()

    member_id = str(row["id"])
    unit_id = str(row["unit_id"])
    roles = {ROLE_SERVICE_MEMBER}
    try:
        for r in db.query(
            "SELECT role, unit_id FROM member_roles WHERE service_member_id = %s",
            (member_id,),
        ):
            roles.add(r["role"])
            # An explicit command unit overrides the home unit for scoping.
            if r["unit_id"]:
                unit_id = str(r["unit_id"])
    except Exception:
        # member_roles missing or unreachable — fall back to baseline only.
        pass
    return member_id, unit_id, roles


# --- Identity resolution -----------------------------------------------------

def _identity_from_jwt(token: str) -> Identity:
    claims = _decode_jwt_claims(token)
    edipi = claims.get("edipi")
    edipi = str(edipi) if edipi is not None else None
    member_id, unit_id, roles = _resolve_member_identity(edipi)
    return Identity(
        roles=roles,
        edipi=edipi,
        name=claims.get("name") or claims.get("preferred_username"),
        member_id=member_id,
        unit_id=unit_id,
        subject_present=bool(claims),
    )


def _parse_dev_roles() -> set[str]:
    """Roles from X-Dev-Roles (comma-separated) or X-Dev-Role, else DEV_ROLE."""
    raw = request.headers.get("X-Dev-Roles") or request.headers.get(
        "X-Dev-Role", config.DEV_ROLE
    )
    return {r.strip() for r in raw.split(",") if r.strip() in _ALL_ROLES}


def _identity_from_dev_headers() -> Identity:
    """Build identity from X-Dev-* headers / DEV_* config (debug/test only).

    Explicit member id / unit id are used as-is (handy for offline tests with no
    DB); otherwise the roster is consulted to resolve them and merge in stored
    roles. The dev role set is authoritative and is not auto-augmented.
    """
    roles = _parse_dev_roles()
    if not roles:
        return Identity()  # nothing configured — anonymous even in debug
    edipi = request.headers.get("X-Dev-Edipi", config.DEV_EDIPI) or None
    member_id = request.headers.get("X-Dev-Member-Id") or None
    unit_id = request.headers.get("X-Dev-Unit-Id") or None
    if member_id is None and unit_id is None:
        member_id, unit_id, _ = _resolve_member_identity(edipi)
    return Identity(
        roles=roles,
        edipi=edipi,
        name=request.headers.get("X-Dev-Name", "Dev User"),
        member_id=member_id,
        unit_id=unit_id,
        subject_present=True,
    )


def current_identity() -> Identity:
    """The caller's identity, resolved once and cached on the request context."""
    if "drp_identity" not in g:
        token = _bearer_token()
        # The dev-header fallback is allowed in Flask debug (local run, no
        # Authservice) or under the test client.
        dev_ok = config.DEBUG or current_app.testing
        if token:
            g.drp_identity = _identity_from_jwt(token)
        elif dev_ok:
            g.drp_identity = _identity_from_dev_headers()
        else:
            g.drp_identity = Identity()
    return g.drp_identity


# --- Authorization primitives ------------------------------------------------

def _deny(message: str, status: int):
    return jsonify({"error": message}), status


def require_role(*allowed: str) -> Callable:
    """Restrict a view to callers whose role SET intersects `allowed`.

    401 when no credential was presented (anonymous), 403 when authenticated but
    holding none of the allowed roles (wrong role, or EDIPI not in the roster).
    """

    def decorator(view: Callable) -> Callable:
        @wraps(view)
        def wrapper(*args, **kwargs):
            ident = current_identity()
            if not ident.subject_present:
                return _deny("authentication required", 401)
            if not (ident.roles & set(allowed)):
                return _deny("forbidden: insufficient role", 403)
            return view(*args, **kwargs)

        return wrapper

    return decorator


def require_self(member_id: str):
    """Ensure the caller's own roster row matches `member_id` (strict).

    The guarantee behind "multiple soldiers supported": a caller can only act on
    their own record. Unlike role checks this never bypasses for privileged roles
    — even a commander may submit only their own assessment. Callers that legitimately
    operate on other members (e.g. the provider review queue) gate on role first and
    only fall back to this for a plain service member. Returns a (response, status)
    tuple to return on failure, or None when allowed.
    """
    ident = current_identity()
    if ident.member_id is None:
        return _deny("forbidden: caller is not a known service member", 403)
    if str(member_id) != str(ident.member_id):
        return _deny("forbidden: not your record", 403)
    return None


def _unit_in_subtree(root_unit_id: str, candidate_unit_id: str) -> bool:
    """True when candidate_unit_id is root_unit_id or one of its descendants."""
    if root_unit_id == candidate_unit_id:
        return True
    row = db.query_one(
        """
        WITH RECURSIVE subtree AS (
          SELECT id FROM units WHERE id = %s
          UNION ALL
          SELECT u.id FROM units u JOIN subtree s ON u.parent_unit_id = s.id
        )
        SELECT 1 AS ok FROM subtree WHERE id = %s LIMIT 1
        """,
        (root_unit_id, candidate_unit_id),
    )
    return bool(row)


def scope_unit(requested_unit_id: Optional[str]) -> Optional[str]:
    """Resolve which unit a commander/provider may operate on.

    - No unit requested -> the caller's own scope unit (their subtree root).
    - A unit requested  -> allowed only if within the caller's subtree, else 403.

    Permissive fallback: when the caller has no resolved scope unit (EDIPI not
    mapped to a roster row, e.g. a misconfigured directory), the request is
    honored as-is — role gating still governs access. Documented in
    docs/configuration.md.
    """
    ident = current_identity()
    own = ident.unit_id
    if own is None:
        return requested_unit_id
    if not requested_unit_id:
        return own
    if _unit_in_subtree(own, requested_unit_id):
        return requested_unit_id
    raise Forbidden("forbidden: unit outside your command")


class Forbidden(Exception):
    """Raised by scope_unit when a caller requests an out-of-scope unit."""


def register_error_handlers(app) -> None:
    """Translate auth exceptions raised inside handlers into 403 responses."""

    @app.errorhandler(Forbidden)
    def _handle_forbidden(exc: Forbidden):
        return jsonify({"error": str(exc)}), 403
