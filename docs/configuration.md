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

## Deploy-time variables

Set via `uds-config.yaml`, bundle overrides, or interactive prompts. Defaults are in [`zarf.yaml`](../zarf.yaml); the dynamic subset is wired through [`values/values.yaml`](../values/values.yaml) into the chart.

| Variable | Default | Maps to (config.py / chart) | Notes |
| --- | --- | --- | --- |
| `DOMAIN` | `uds.dev` | UDS Package CR host (`drp.<DOMAIN>`) | External domain. |
| `OPENAI_MODEL` | `gpt-4o-mini` | `OPENAI_MODEL` | Chat model for data-chat + RAG. |
| `BACKEND_DEBUG` | `false` | `BACKEND_DEBUG` | Flask debug. Keep `false` in production. |
| `SUPABASE_CONNECTION_STRING` | _(empty)_ | Secret → `SUPABASE_CONNECTION_STRING` | **Sensitive.** Postgres DSN (pgvector). |
| `OPENAI_API_KEY` | _(empty)_ | Secret → `OPENAI_API_KEY` | **Sensitive.** OpenAI API key. |

The container port (`3000`) is a fixed chart value in [`chart/values.yaml`](../chart/values.yaml) (`config.backendPort`), not a deploy-time variable: the Service fronts it via a named `targetPort`, so there is no reason to retune it per environment.

The embedding model (`text-embedding-3-small`) is currently hard-coded in [`rag.py`](../src/backend/rag.py); it is not yet a deploy-time variable.

## Secrets

`SUPABASE_CONNECTION_STRING` and `OPENAI_API_KEY` render into a Kubernetes `Secret` ([`chart/templates/secret.yaml`](../chart/templates/secret.yaml)). For a quick standalone deploy you can pass them via `uds-config.yaml`, but that writes the values into the deployed package state.

**Production:** source them from a real secret manager. Add the `external-secrets-operator` package to the bundle, create an `ExternalSecret` that materializes a Secret of the same name, and leave the chart's `secrets.*` values empty so the chart-managed Secret is not used.
