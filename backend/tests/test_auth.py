"""Auth layer tests — JWT decoding, DB-owned role resolution, and route guards.

Authorization roles are owned by the roster (member_roles), resolved from the JWT
`edipi` claim — not from Keycloak groups. These tests mock the DB where roster
resolution matters; the authorization decisions themselves are made before any
handler touches the DB.

Run:
    cd backend
    uv run pytest tests/test_auth.py -v
"""

import base64
import json
from unittest.mock import patch

import pytest

import auth
from app import create_app


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _b64url(obj) -> str:
    raw = json.dumps(obj).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def make_jwt(claims: dict) -> str:
    """A structurally valid JWT (header.payload.signature). The signature is not
    checked by the backend — Authservice already verified it (see auth.py)."""
    header = _b64url({"alg": "RS256", "typ": "JWT"})
    return f"{header}.{_b64url(claims)}.unverified-signature"


def bearer(claims: dict) -> dict:
    return {"Authorization": f"Bearer {make_jwt(claims)}"}


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# Pure unit: claim decoding
# ---------------------------------------------------------------------------

class TestDecodeJwt:
    def test_decodes_payload_claims(self):
        claims = auth._decode_jwt_claims(make_jwt({"edipi": "123", "name": "X"}))
        assert claims["edipi"] == "123"
        assert claims["name"] == "X"

    def test_malformed_token_returns_empty(self):
        assert auth._decode_jwt_claims("not-a-jwt") == {}
        assert auth._decode_jwt_claims("only.two") == {}


# ---------------------------------------------------------------------------
# Roster-owned role resolution (the authorization source of truth)
# ---------------------------------------------------------------------------

class TestResolveMemberIdentity:
    def test_baseline_service_member_plus_stored_roles(self):
        # A resolvable member always has the baseline role; member_roles adds more.
        with patch("auth.db.query_one", return_value={"id": "m-1", "unit_id": "u-1"}), \
             patch("auth.db.query", return_value=[{"role": "commander", "unit_id": None}]):
            member_id, unit_id, roles = auth._resolve_member_identity("1000000001")
        assert member_id == "m-1"
        assert unit_id == "u-1"  # NULL role unit -> falls back to the member's own unit
        assert roles == {auth.ROLE_SERVICE_MEMBER, auth.ROLE_COMMANDER}

    def test_multiple_roles(self):
        with patch("auth.db.query_one", return_value={"id": "m-2", "unit_id": "u-2"}), \
             patch("auth.db.query", return_value=[
                 {"role": "commander", "unit_id": None},
                 {"role": "provider", "unit_id": None},
             ]):
            _, _, roles = auth._resolve_member_identity("x")
        assert roles == {auth.ROLE_SERVICE_MEMBER, auth.ROLE_COMMANDER, auth.ROLE_PROVIDER}

    def test_explicit_role_unit_overrides_home_unit(self):
        with patch("auth.db.query_one", return_value={"id": "m-3", "unit_id": "home"}), \
             patch("auth.db.query", return_value=[{"role": "commander", "unit_id": "command"}]):
            _, unit_id, _ = auth._resolve_member_identity("x")
        assert unit_id == "command"

    def test_unknown_edipi_resolves_to_nothing(self):
        with patch("auth.db.query_one", return_value=None):
            assert auth._resolve_member_identity("nope") == (None, None, set())

    def test_no_edipi_resolves_to_nothing(self):
        assert auth._resolve_member_identity(None) == (None, None, set())


# ---------------------------------------------------------------------------
# /api/me — identity surfaced from the forwarded JWT
# ---------------------------------------------------------------------------

class TestMe:
    def test_jwt_with_provisioned_edipi_returns_role_set(self, client):
        with patch("auth.db.query_one", return_value={"id": "m-1", "unit_id": "u-1"}), \
             patch("auth.db.query", return_value=[{"role": "commander", "unit_id": None}]):
            r = client.get("/api/me", headers=bearer({"edipi": "1000000001", "name": "LTC Harris"}))
        assert r.status_code == 200
        body = r.get_json()
        assert set(body["roles"]) == {"service_member", "commander"}
        assert body["name"] == "LTC Harris"
        assert body["member_id"] == "m-1"

    def test_no_session_is_401(self, client):
        # No JWT and no dev headers -> anonymous, even under TESTING.
        assert client.get("/api/me").status_code == 401

    def test_authenticated_but_unprovisioned_edipi_is_403(self, client):
        # Valid token, but the EDIPI isn't in the roster -> authenticated, no roles.
        with patch("auth.db.query_one", return_value=None):
            r = client.get("/api/me", headers=bearer({"edipi": "9999999999"}))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# require_role — set-based surface gating
# ---------------------------------------------------------------------------

class TestRequireRole:
    def test_wrong_role_is_403(self, client):
        client.environ_base["HTTP_X_DEV_ROLE"] = "provider"
        assert client.get("/api/readiness").status_code == 403  # commander-only

    def test_no_auth_is_401(self, client):
        assert client.get("/api/readiness").status_code == 401

    def test_soldier_cannot_list_assessments(self, client):
        client.environ_base["HTTP_X_DEV_ROLE"] = "service_member"
        client.environ_base["HTTP_X_DEV_MEMBER_ID"] = "sm-1"
        assert client.get("/api/assessments").status_code == 403

    def test_multi_role_user_passes_each_role_gate(self, client):
        # A commander who is also a service member clears the commander gate.
        client.environ_base["HTTP_X_DEV_ROLES"] = "commander,service_member"
        # Stub the unit lookup so the handler returns 404 (no units) instead of
        # touching a real DB; the point is it is NOT rejected by the role gate.
        with patch("blueprints.readiness._default_unit_id", return_value=None):
            r = client.get("/api/readiness")
        assert r.status_code == 404
        assert r.status_code not in (401, 403)


# ---------------------------------------------------------------------------
# require_self — callers act only on their own record (strict, no role bypass)
# ---------------------------------------------------------------------------

class TestRequireSelf:
    def _dev(self, client, roles, member_id):
        client.environ_base["HTTP_X_DEV_ROLES"] = roles
        client.environ_base["HTTP_X_DEV_MEMBER_ID"] = member_id

    def test_soldier_cannot_submit_for_another(self, client):
        self._dev(client, "service_member", "soldier-A")
        r = client.post("/api/assessments",
                        json={"service_member_id": "soldier-B", "type": "PRE", "responses": {}})
        assert r.status_code == 403
        assert "not your record" in r.get_json()["error"]

    def test_soldier_cannot_read_another_members_detail(self, client):
        self._dev(client, "service_member", "11111111-1111-1111-1111-111111111111")
        r = client.get("/api/service-members/22222222-2222-2222-2222-222222222222")
        assert r.status_code == 403

    def test_commander_who_is_soldier_submits_own_but_not_others(self, client):
        # The multi-role guarantee: a commander is also a service member and may
        # submit THEIR OWN assessment, but require_self still blocks others.
        self._dev(client, "commander,service_member", "me")
        other = client.post("/api/assessments",
                            json={"service_member_id": "someone-else", "type": "PRE", "responses": {}})
        assert other.status_code == 403  # not their record

        # For the own-record submit, stub the DB write so we exercise only the
        # self-check (a raising transaction -> 500, which is still not a 403).
        def boom():
            raise RuntimeError("no DB in this test")
        with patch("blueprints.assessments.db.transaction", boom):
            own = client.post("/api/assessments",
                             json={"service_member_id": "me", "type": "PRE", "responses": {}})
        assert own.status_code != 403  # self-check passes

    def test_pure_provider_cannot_create_assessment(self, client):
        # No service_member role -> blocked by require_role before require_self.
        self._dev(client, "provider", "prov-1")
        r = client.post("/api/assessments",
                        json={"service_member_id": "prov-1", "type": "PRE", "responses": {}})
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# scope_unit — a commander/provider can't reach outside their command
# ---------------------------------------------------------------------------

class TestScopeUnit:
    def test_requested_unit_outside_subtree_is_403(self, client):
        client.environ_base["HTTP_X_DEV_ROLE"] = "commander"
        client.environ_base["HTTP_X_DEV_UNIT_ID"] = "11111111-1111-1111-1111-111111111111"
        with patch("auth.db.query_one", return_value=None):  # not in subtree
            r = client.get("/api/units/22222222-2222-2222-2222-222222222222")
        assert r.status_code == 403
        assert "outside your command" in r.get_json()["error"]

    def test_requested_unit_within_subtree_passes_scope(self, client):
        client.environ_base["HTTP_X_DEV_ROLE"] = "commander"
        client.environ_base["HTTP_X_DEV_UNIT_ID"] = "11111111-1111-1111-1111-111111111111"
        target = "22222222-2222-2222-2222-222222222222"
        with patch("auth.db.query_one", return_value={"ok": 1}), \
             patch("blueprints.units.db.query_one", return_value={"id": target}), \
             patch("blueprints.units.readiness_stats", return_value={}), \
             patch("blueprints.units.db.query", return_value=[]):
            r = client.get(f"/api/units/{target}")
        assert r.status_code == 200
