# Configuration

The Deployment Readiness Platform (DRP) ships as a single container image (Flask API + gunicorn serving the built React SPA). This package wraps that image in a Helm chart plus a UDS Package CR.

## Container image

The image is **not published to a registry**. It is built locally and brought into the Zarf package from a local OCI-layout archive, so `uds zarf package create` runs fully offline without reaching `ghcr.io`.

[`zarf.yaml`](../zarf.yaml) references the archive via `imageArchives` rather than the usual `images` list:

```yaml
imageArchives:
  - path: images/drp-0.1.0.oci.tar
    images:
      - ghcr.io/defenseunicorns/deployment-readiness-platform:0.1.0
```

The image tag (`ghcr.io/defenseunicorns/...`) is still its identity inside the cluster — the `imageArchives` entry only changes *where Zarf sources the bytes from* (the local file) at create time.

Build the archive with `uds run build` (see [`tasks.yaml`](../tasks.yaml)), which exports the build straight to an OCI layout:

```bash
docker buildx build -f backend/Dockerfile -t "${IMAGE}" --output "type=oci,dest=images/drp-0.1.0.oci.tar" .
```

Notes:

- Once the image is published to a registry, switch [`zarf.yaml`](../zarf.yaml) back to a plain `images:` list (see the `TODO` in [`tasks.yaml`](../tasks.yaml)).

## Authentication & authorization (SSO)

DRP has no native OIDC, so it is fronted by **UDS Authservice**. Authservice runs the Keycloak login flow at the Istio mesh and forwards the validated ID token to the Flask backend as a `Authorization: Bearer <jwt>` header. The UDS Package CR ([`chart/templates/uds-package.yaml`](../chart/templates/uds-package.yaml)) wires this up via the `sso` block (`enableAuthserviceSelector` and a single `edipi` protocol mapper).

### Source-of-truth split

Keycloak and the roster DB own **different** facts, joined by the EDIPI:

- **Keycloak owns authentication only.** Its job is to prove the user is a logged-in UDS user and assert their `edipi` claim (in production the EDIPI comes from the CAC/PIV certificate). There is **no group-based gate** — `groups.anyOf` is intentionally omitted, so any authenticated UDS user reaches the app.
- **The roster DB owns authorization.** The `edipi` resolves to a `service_members` row; that member's **role set** comes from the `member_roles` table (migration [`003`](../db/migrations/003_add_member_roles.sql)). A user whose EDIPI has no roster row is authenticated but unprovisioned and gets `403`.

### Roles are a set, owned by the roster

A person holds several roles at once — every commander and provider is also a service member who owes their own assessment. So roles are a **set**, resolved by [`backend/auth.py`](../backend/auth.py) from the roster:

- **`service_member`** (baseline) — implied by having a `service_members` row; not stored in `member_roles`.
- **`provider` / `commander`** — additive duty positions, stored in `member_roles`.

| Surface | Allowed roles (set intersection) |
| --- | --- |
| Commander dashboard (`/api/readiness*`, `/api/commander/chat`) | `commander` |
| Provider review queue (`/api/assessments` list/detail, `/api/service-members`, `/api/units*`, `/api/documents*`, `/api/policy-chat`, certify/refer) | `provider` or `commander` |
| Submit assessment + read own record | `service_member` |

A soldier may only read/write **their own** record (the one their EDIPI resolves to) — `require_self` is strict and never bypasses for privileged roles, so even a commander may submit only their *own* assessment. This is what supports many distinct soldier users in isolation. Commanders and providers are scoped to their own unit subtree (their EDIPI → unit → that unit and its descendants); requesting a unit outside it returns `403`.

### Trust boundary — why the JWT signature is not re-verified

By the time a request reaches Flask, Authservice (at the mesh) has already verified the token's signature, expiry, and audience. The backend therefore only **decodes** the claims; it does not re-validate the signature. This keeps the backend dependency-free (no `pyjwt`) and avoids duplicating the mesh's work. The guarantee holds only because the app is unreachable except through Authservice — see [`docs/justifications.md`](./justifications.md).

### Keycloak prerequisites (one-time, out of band)

The Package CR creates the Keycloak **client** and the `edipi` protocol mapper. Because roles live in the DB, Keycloak needs **no DRP groups** — only that each user can authenticate and carries an `edipi` attribute. Provision via the admin UI or OpenTofu (see [Manage Keycloak with OpenTofu](https://uds.defenseunicorns.com/how-to-guides/identity-and-authorization/manage-keycloak-with-opentofu/) — UDS Core ships a `uds-opentofu-client` for this):

1. Ensure each user can log in to the `uds` realm.
2. Set a user attribute named `edipi` to their 10-digit EDIPI. It must match a `service_members.edipi` row (see [`db/seed/seed.sql`](../db/seed/seed.sql)). If the realm's User Profile blocks arbitrary attributes, add `edipi` to the profile or enable unmanaged attributes first.

A user's **roles** are then granted entirely in the DB: a baseline `service_member` for everyone in the roster, plus rows in `member_roles` for provider/commander appointments. No Keycloak change is needed to grant or revoke a role.

### Local development (no Authservice)

Running `python app.py` + the Vite dev server has no Authservice in front and no JWT. When `BACKEND_DEBUG=true` (or under the test client), the backend falls back to identity supplied via request headers — `X-Dev-Roles` (comma-separated for multi-role; `X-Dev-Role` also accepted), `X-Dev-Edipi`, `X-Dev-Member-Id`, `X-Dev-Unit-Id` — or the `DEV_ROLE` / `DEV_EDIPI` env defaults. With no such header and no JWT, requests are anonymous (`401`). The frontend keeps its mock persona picker in mock mode (`VITE_USE_MOCKS` unset/true); set `VITE_USE_MOCKS=false` to drive roles from the real `/api/me` endpoint. In production (`BACKEND_DEBUG=false`) the dev-header fallback is **off** — only a real Authservice JWT is accepted.

> **Note:** unit scoping for a commander/provider depends on their `edipi` attribute resolving to a `service_members` row. If the attribute is missing, the role still gates access but unit scoping is permissive (the caller is not restricted to a subtree). Set the `edipi` attribute for full scoping.

## Deploy-time variables

Set via `uds-config.yaml`, bundle overrides, or interactive prompts. Defaults are in [`zarf.yaml`](../zarf.yaml); the dynamic subset is wired through [`values/values.yaml`](../values/values.yaml) into the chart.

| Variable | Default | Maps to (config.py / chart) | Notes |
| --- | --- | --- | --- |
| `DOMAIN` | `uds.dev` | UDS Package CR host (`drp.<DOMAIN>`) + SSO redirect URI (`https://drp.<DOMAIN>/login`) | External domain. Flows through `chart/values.yaml` `domain`. |
| `OPENAI_MODEL` | `gpt-4o-mini` | `OPENAI_MODEL` | Chat model for data-chat + RAG. |
| `BACKEND_DEBUG` | `false` | `BACKEND_DEBUG` | Flask debug. Keep `false` in production. |
| `SUPABASE_CONNECTION_STRING` | _(empty)_ | Secret → `SUPABASE_CONNECTION_STRING` | **Sensitive.** Postgres DSN (pgvector). |
| `OPENAI_API_KEY` | _(empty)_ | Secret → `OPENAI_API_KEY` | **Sensitive.** OpenAI API key. |

The container port (`3000`) is a fixed chart value in [`chart/values.yaml`](../chart/values.yaml) (`config.backendPort`), not a deploy-time variable: the Service fronts it via a named `targetPort`, so there is no reason to retune it per environment.

The embedding model (`text-embedding-3-small`) is currently hard-coded in [`rag.py`](../src/backend/rag.py); it is not yet a deploy-time variable.

## Secrets

`SUPABASE_CONNECTION_STRING` and `OPENAI_API_KEY` render into a Kubernetes `Secret` ([`chart/templates/secret.yaml`](../chart/templates/secret.yaml)). For a quick standalone deploy you can pass them via `uds-config.yaml`, but that writes the values into the deployed package state.

**Production:** source them from a real secret manager. Add the `external-secrets-operator` package to the bundle, create an `ExternalSecret` that materializes a Secret of the same name, and leave the chart's `secrets.*` values empty so the chart-managed Secret is not used.
