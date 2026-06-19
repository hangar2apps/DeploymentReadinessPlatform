# `drp-core-dev` bundle

A local development platform for DRP: a k3d cluster plus the UDS Core functional layers that make up `slim-dev` (`core-base` + `core-identity-authorization`), with **one** difference from the stock `k3d-core-slim-dev` bundle — Keycloak's `uds-opentofu-client` is **enabled**.

Use this instead of `uds deploy k3d-core-slim-dev:latest` when you want to seed Keycloak users with OpenTofu (see [`tofu/keycloak/`](../../tofu/keycloak/README.md)). `OPENTOFU_CLIENT_ENABLED` is a `realmInitEnv` value that only takes effect at the **first** realm import, so the client has to be enabled at deploy time — it can't be turned on afterward without reinitializing Keycloak.

## What's in it

| Package | Why |
|---|---|
| `uds-k3d-dev` | Local k3d cluster (MetalLB, storage). Remove to deploy onto an existing cluster. |
| `init` | Zarf init (registry, agent, injector). |
| `core-base` | Istio, UDS Operator, Pepr policy engine. |
| `core-identity-authorization` | Keycloak + Authservice. Overridden to enable the OpenTofu client and pin username/password auth flows. |

`core-metrics-server` is omitted on purpose — `slim-dev` doesn't include it, and k3d already ships a metrics server.

## Build and deploy

```bash
# from the repo root
uds create bundles/core-dev --confirm
uds deploy bundles/core-dev/uds-bundle-drp-core-dev-*.tar.zst --no-color --confirm
```

This stands up the cluster and UDS Core. Afterward:

1. Seed Keycloak users with OpenTofu — [`tofu/keycloak/README.md`](../../tofu/keycloak/README.md).
2. Build and deploy the DRP app bundle — [`bundles/drp/`](../drp/).

## Pinning

All four packages are pinned to a tested combination: UDS Core `1.6.0-upstream`, `uds-k3d` `0.20.1-airgap`, Zarf `init` `v0.77.0` — the same set the published `k3d-core-slim-dev:1.6.0` bundle ships. `uds create` resolves these tags to digests and records them in the built bundle, so a created bundle is reproducible even though this manifest pins by tag for readability.
