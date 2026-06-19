# Keycloak user provisioning (OpenTofu)

Creates one Keycloak user per roster member in the `uds` realm, with the `edipi` attribute the DRP SSO client maps into the token. This is the reproducible way to prepopulate Keycloak for a demo/test environment instead of clicking through the admin UI for ~90 users.

**Identity only — no roles here.** Keycloak owns authentication; the roster DB owns authorization. A member's role set (`provider`/`commander`, plus the implied baseline `service_member`) lives in the `member_roles` table, not in Keycloak. To make someone a provider or commander, add a row to `member_roles` (see [`db/seed/seed.sql`](../../db/seed/seed.sql)) — nothing in this directory changes.

## Prerequisites

1. **UDS Core with the OpenTofu client enabled.** This config authenticates as
   `uds-opentofu-client` (a realm-admin client UDS ships for exactly this). The [`drp-core-dev` bundle](../../bundles/core-dev/README.md) brings up the dev cluster with this client already enabled — deploy that instead of stock `k3d-core-slim-dev`:

   ```bash
   uds create bundles/core-dev --confirm
   uds deploy bundles/core-dev/uds-bundle-drp-core-dev-*.tar.zst --no-color --confirm
   ```

   It enables the client via a bundle override on the Keycloak package (`realmInitEnv.OPENTOFU_CLIENT_ENABLED: "true"`). `realmInitEnv` is applied only at **initial realm import**. If your realm is already up without it, you must reinitialize Keycloak (destroy + recreate the Keycloak deployment) for the client to exist.

2. **The `uds` realm must accept the `edipi` user attribute.** Modern Keycloak gates arbitrary attributes behind the realm User Profile. If apply fails writing `edipi`, add an `edipi` attribute to **Realm settings → User profile** (or enable unmanaged attributes) and re-apply.

3. **OpenTofu** (`tofu`) or Terraform installed.

## Run

```bash
cd tofu/keycloak

# Secret for uds-opentofu-client:
#   uds realm -> Clients -> uds-opentofu-client -> Credentials
export TF_VAR_client_secret='<client-secret>'

# Optional overrides (defaults target https://sso.uds.dev, realm "uds"):
export TF_VAR_keycloak_url='https://sso.<your-domain>'
export TF_VAR_default_password='<demo-login-password>'   # must satisfy the realm password policy

tofu init
tofu plan
tofu apply
```

Testers then log in at `https://drp.<domain>` as any member using the **EDIPI as the username** and `default_password`. Each user's `edipi` claim resolves to their `service_members` row, and the backend derives their role set from `member_roles`.

## Regenerating the member list

`members.auto.tfvars.json` is generated from the roster seed — do not hand-edit. If `db/seed/seed.sql` changes, regenerate:

```bash
python3 tofu/keycloak/generate_members.py
```

## Cleanup

```bash
tofu destroy
```

## Notes

- State may contain the client secret and the default password; it is git-ignored. Prefer the `TF_VAR_*` env vars over a committed `*.tfvars`.
- Production wouldn't use this at all: an upstream IdP (CAC/PIV, Azure AD/Okta) authenticates and supplies EDIPI from the certificate, and SCIM provisions users. This config is a thin, reproducible seeding layer for non-production environments.
