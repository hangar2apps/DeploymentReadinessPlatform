# Backend — Foundation + RAG/Policy Integration (Coordinator)

Name: ___________

Read first: `team/TEAM_PLAN.md`. Build details: `CLAUDE_CODE_BUILD.md`.
You're the backend coordinator and tiebreaker so the other two don't ping Bryan
mid-frontend-flow.

## You own

### 1. Express foundation (Day 1 AM — unblocks the other two backend devs)
Stand this up first; the assessments + readiness devs build on it.
- Express + TS app (`gateway/`), runs via `npx tsx server.ts` on :3000.
  `/api/health` already exists.
- Shared DB access layer: a single pooled Postgres client (`pg`) reading
  `SUPABASE_CONNECTION_STRING` from the root `.env`. Parameterized queries only.
  **Vanilla Postgres — no Supabase SDK** (portability / UDS story).
- CORS (already allows :5173), JSON body parsing, centralized error handling,
  a consistent JSON error shape. Router structure so each dev owns a file.

### 2. RAG / policy-chat integration
- `POST /api/policy-chat { question }` -> calls the Python RAG service over
  gRPC -> streams the answer back to the browser via **SSE** + returns source
  citations.
- **Port, don't rewrite.** DocIntel's gateway already implements this exact
  client: `~/Documents/GitHub/DocIntel/docintel/gateway/server.ts`. It uses
  `@grpc/grpc-js` + `@grpc/proto-loader.loadSync()` against the `.proto` at
  runtime — no TS stub codegen. Copy that pattern in.
- The proto is `rag-service/docintel.proto`. **Service name is
  `DocumentIntelligence`** (NOT `PolicyAssistant` — the spec §4.7 is wrong).
  RPCs: `Query` (server-streaming, use this for chat), `IngestDocument`,
  `ListDocuments`.
- Deps to add in `gateway/`: `@grpc/grpc-js`, `@grpc/proto-loader`.

### 3. Run / own the RAG service + Docker
- `rag-service/` is DocIntel, already connected to Supabase and verified
  (policy docs ingested + embedded — no runtime ingestion).
- Start: `cd rag-service && source .venv/bin/activate && python server.py`
  (Python 3.12). Listens on :50051. Config in `rag-service/.env` (DB_* + key).
- `docker-compose.yml` builds all three services (deployment artifact, not dev).

## Smoke test the RAG path is live
```bash
cd rag-service && source .venv/bin/activate
python -c "import grpc, docintel_pb2, docintel_pb2_grpc; s=docintel_pb2_grpc.DocumentIntelligenceStub(grpc.insecure_channel('localhost:50051')); r=s.ListDocuments(docintel_pb2.ListRequest()); print(len(r.documents),'docs')"
```

## Streaming note
The Python `Query` RPC is server-streaming (token by token). Pipe gRPC stream
-> Express SSE (`text/event-stream`) so the provider chat panel renders live.
Token-by-token is a NICE-to-have; a single final answer is acceptable for MVP.

## Gotchas
- Don't modify the Python `server.py` chunking/embedding/proto (per DocIntel
  rules) unless necessary — it's proven.
- gRPC default is :50051; gateway :3000; frontend :5173.
