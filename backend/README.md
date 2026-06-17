# DRP Backend (Flask)

Flask implementation of the DRP API gateway. Serves the REST API for the three user surfaces (service member, provider, commander) and proxies the policy assistant to the Python gRPC RAG service.

> This is the Flask [`../gateway`](../gateway).  It implements every route in [`../docs/API Routes.md`](../docs/API%20Routes.md) and the data model / rules from [`../CLAUDE_CODE_BUILD.md`](../CLAUDE_CODE_BUILD.md).

## Run locally

```sh
cd backend
uv sync                  # create .venv and install from pyproject.toml / uv.lock
uv run python app.py     # -> http://localhost:3000
```

Reads the shared root `.env` (`SUPABASE_CONNECTION_STRING`, `OPENAI_API_KEY`). The policy assistant additionally needs the RAG gRPC service running on `localhost:50051` (`cd ../rag-service && python server.py`).

## Database connectivity note

The root `.env` ships the **direct** Supabase host (`db.<project>.supabase.co`), which is IPv6-only. On networks without an IPv6 route it fails with `could not translate host name`. If you hit that, switch `SUPABASE_CONNECTION_STRING` to the **session pooler** (IPv4) from the Supabase dashboard → Connect:

```
postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

## Endpoints

| Method | Path                           | Purpose                                                       |
| ------ | ------------------------------ | ------------------------------------------------------------- |
| GET    | `/api/health`                  | Liveness check                                                |
| GET    | `/api/assessments`             | List (filter: `status`, `unit_id`, `type`); red-flagged first |
| GET    | `/api/assessments/:id`         | Detail with red flags                                         |
| POST   | `/api/assessments`             | Create/submit; scores + runs the red-flag rule engine         |
| PATCH  | `/api/assessments/:id/certify` | Provider certifies → deployable                               |
| PATCH  | `/api/assessments/:id/refer`   | Provider refers → non-deployable                              |
| GET    | `/api/service-members`         | List (filter: `unit_id`, `deployable`)                        |
| GET    | `/api/service-members/:id`     | Detail with assessments                                       |
| GET    | `/api/units`                   | List (flat; `parent_unit_id` gives hierarchy)                 |
| GET    | `/api/units/:id`               | Detail with readiness stats + child units                     |
| GET    | `/api/readiness`               | KPI cards + per-company readiness                             |
| GET    | `/api/readiness/trend`         | Time-series for the trend chart                               |
| GET    | `/api/red-flags/summary`       | Open red flags aggregated by category                         |
| POST   | `/api/policy-chat`             | RAG policy assistant (proxies gRPC)                           |
| POST   | `/api/commander/chat`          | Commander data chat (SQL context → LLM)                       |

## Layout

- `app.py` — application factory, blueprint registration, entry point
- `config.py` — loads the shared root `.env`
- `db.py` — psycopg2 connection pool + dict-row query helpers
- `rules.py` — PHQ-9/PCL-5 scoring and the red-flag rule engine (pure logic)
- `rag_client.py` — gRPC client for the policy assistant
- `docintel_pb2*.py` — generated gRPC stubs (copied from `../rag-service`)
- `blueprints/` — one module per resource (assessments, service_members, units, readiness, chat)

## Notes / TODO

- `/api/readiness/trend` returns a **synthetic** curve landing on the current deployable %, since the schema has no daily-snapshot table. Replace with a real query once snapshots are persisted.
- The commander chat enforces a HIPAA guardrail in the system prompt (summarize by category and count; no names or specific medical details).
