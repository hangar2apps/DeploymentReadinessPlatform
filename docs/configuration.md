# Configuration

The Deployment Readiness Platform (DRP) ships as a single container image (Flask API + gunicorn serving the built React SPA). This package wraps that image in a Helm chart plus a UDS Package CR.

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
