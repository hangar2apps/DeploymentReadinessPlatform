# Assumptions & justifications

## Image reference: `ghcr.io/defenseunicorns/deployment-readiness-platform:0.1.0`

**Why:** The repo has no published image or registry convention yet. This is a placeholder so the chart, `zarf.yaml` `images:`, and the `build-image` task line up.

## External Supabase Postgres (no in-cluster DB package)

**Why:** `backend/config.py` and `db.py` read a full `SUPABASE_CONNECTION_STRING` DSN and force `sslmode=require` — the app points at hosted Supabase, not an in-cluster service. So the bundle wraps only the DRP package and the egress policy allows outbound Postgres.

## `runAsUser: 1000` set explicitly

**Why:** The image's `USER app` is a *non-numeric* system user. Kubelet cannot verify a non-numeric user is non-root, so with `runAsNonRoot: true` and no numeric `runAsUser` the pod is refused at admission. 1000 is a safe non-root UID; the venv under `/app/.venv` is world-readable/executable, so a UID other than the image's `app` can still run the interpreter. **Confirm** the app starts cleanly as 1000 during the first deploy; if a path needs write access beyond `/tmp`, adjust.

## `readOnlyRootFilesystem: true` + a `/tmp` emptyDir

**Why:** The app does not write to its source tree at runtime (`PYTHONDONTWRITEBYTECODE=1`), so a read-only rootfs is the safer default. gunicorn and some libraries still need a writable `/tmp`, mounted as an emptyDir. If a dependency needs more writable paths, either add mounts or flip the flag in `chart/values.yaml`.

## Egress uses `remoteGenerated: Anywhere`

**Why:** Supabase and OpenAI are public-internet endpoints with rotating IPs, so host-pinned policy is brittle at the package level. Ports are constrained (5432/ 6543, 443). In production the platform egress gateway should narrow these to the specific hostnames.

## SSO via Authservice; authorization owned by the roster DB

**Why:** DRP has no native OIDC, so the app is fronted by UDS Authservice (the `sso` block in [`chart/templates/uds-package.yaml`](../chart/templates/uds-package.yaml)). Authservice authenticates the user and forwards the JWT, but it can only gate the app as a whole and DRP serves all three role surfaces from one origin — so authorization can't live in the CR. It lives in [`backend/auth.py`](../backend/auth.py). Keycloak and the roster own different facts joined by EDIPI: **Keycloak owns authentication** (and asserts the `edipi` claim — from the CAC in production); **the roster DB owns authorization**. Roles come from the `member_roles` table keyed by EDIPI, not from Keycloak groups. This is deliberate — the roles (provider/commander) are duty-position facts that belong to the personnel record, and a user holds several at once (every commander/provider is also a service member), so a single DB-owned role *set* is the one source of truth. Adding or revoking a role is a DB change with no Keycloak edit.

## No `groups.anyOf` — the edge gate is intentionally broad

**Why:** Since the per-role decision is made in the backend from the roster, the Authservice edge only needs to prove "authenticated UDS user." Omitting `groups.anyOf` keeps role data in exactly one place (the DB). A user whose EDIPI has no roster row authenticates but is rejected by the backend with `403` (unprovisioned), so the broad edge gate grants no actual access.

## `member_roles` table rather than Keycloak groups or an array column

**Why:** Roles are naturally many-per-member, so a table models them without array columns or duplicated group memberships in Keycloak. Baseline `service_member` is *not* stored — it is implied by having a `service_members` row — so the table holds only the additive privileged appointments (provider/commander). The optional `unit_id` lets a commander's command unit differ from their assigned unit; when null, scope falls back to the member's own unit.

## Backend decodes the JWT but does not verify its signature

**Why:** Authservice validates the token's signature, expiry, and audience at the mesh before forwarding it. Re-verifying in Flask would duplicate that work and pull in a JWT/JWKS dependency for no security gain. The app is unreachable except through Authservice (single exposure, `enableAuthserviceSelector` on the only workload), so a forged `Authorization` header cannot reach it from outside. We therefore decode claims only (stdlib base64 + json). **If** the app were ever exposed without Authservice in front, this assumption breaks and full JWT verification (or the dev-header fallback being disabled) would be required.

## EDIPI as the identity key; permissive unit scoping when unset

**Why:** `service_members.edipi` is already the natural key used by the seed data and the frontend personas, and EDIPI is the natural identifier for CAC-based DoD auth. The backend resolves the caller's member row (and therefore their unit) from the `edipi` claim. If a user has no `edipi` attribute (or it doesn't match a row), role gating still applies but unit scoping is permissive rather than failing closed — so a misconfigured directory degrades to "role-correct but unscoped" instead of a hard outage. Setting the `edipi` attribute (see [`docs/configuration.md`](./configuration.md)) restores full subtree scoping.
