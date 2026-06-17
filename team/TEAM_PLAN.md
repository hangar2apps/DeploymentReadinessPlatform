# DRP — Team Plan (Warhacker 2026)

Master coordination doc. Each person also has a focused file in `team/`.
Full product context: `DRP_SPEC.md`. Build details: `CLAUDE_CODE_BUILD.md`.

## Team (5 people)

| Person | Lane | File |
|---|---|---|
| Bryan | Frontend — app shell, commander dashboard, contract steward | `team/frontend-bryan.md` |
| Derrick | Frontend — service member + provider surfaces | `team/frontend-derrick.md` |
| Unicorn (TBD) | Backend — assessments + red-flag engine | `team/backend-assessments.md` |
| Unicorn (TBD) | Backend — readiness + commander data chat | `team/backend-readiness-chat.md` |
| Unicorn (TBD) | Backend — foundation + RAG/policy integration (coordinator) | `team/backend-foundation-rag.md` |

2 frontend, 3 backend. All three unicorns are platform engineers comfortable
with backend + Python.

## The #1 rule: lock the API contract Day 1 AM

With 2 frontend devs building against 3 backend devs, the API contract IS the
coordination mechanism. Freeze the request/response shapes below before anyone
goes deep. Frontend builds against the shapes (mock if needed); backend
implements behind them. Bryan is contract steward — changes go through him.

## Dev workflow

Everyone runs locally against the shared Supabase. No Docker in dev.

```
frontend: npm run dev          -> http://localhost:5173
gateway:  npx tsx server.ts    -> http://localhost:3000   (NOTE: tsx, not ts-node)
rag:      python server.py     -> localhost:50051          (only for policy-chat work)
```

Env: root `.env` (SUPABASE_*, OPENAI_API_KEY) for the gateway;
`rag-service/.env` (DB_* + OPENAI_API_KEY) for the RAG service. Copy from the
`.env.example` files. Never commit a real `.env`.

Portability rule (keeps the UDS story honest): vanilla Postgres only — no
Supabase Auth/Storage/edge APIs. The app must work against any Postgres.

## Database (already done — pre-hackathon)

- Schema created in Supabase: `units`, `service_members`, `assessments`,
  `red_flags` (+ `document_chunks` for RAG). See `CLAUDE_CODE_BUILD.md`.
- Seed loaded + verified: 6 units, 90 soldiers, 30 assessments, 17 red_flags.
  Battalion **86.7% deployable**, **Bravo 68.4%** (demo drill-down). Reload
  anytime with `db/seed/seed.sql` (truncates the 4 app tables, not document_chunks).
- Policy docs already ingested/embedded into `document_chunks` via DocIntel.

## Shared API contract (freeze these shapes)

Core entities returned by the API:

```jsonc
// ServiceMember
{ "id","edipi","rank","last_name","first_name","middle_initial","mos",
  "unit_id","deployable","deployable_reason" }
// Unit
{ "id","uic","name","short_name","parent_unit_id" }
// Assessment
{ "id","service_member_id","type","status","responses",
  "phq9_score","pcl5_score","submitted_at","certified_at","certified_by",
  "referral_type","referral_notes" }
// RedFlag
{ "id","assessment_id","type","severity","rule_fired","message","resolved_at" }
```

Endpoints by owner:

```
# Assessments + members  -> backend-assessments
GET   /api/assessments?status=&unit_id=&type=   list (+ member, unit, flags[])
GET   /api/assessments/:id                       detail (+ member, flags[])
POST  /api/assessments                           create/submit -> runs rule engine
PATCH /api/assessments/:id/certify               { } -> CERTIFIED, deployable=true
PATCH /api/assessments/:id/refer                 { referral_type, referral_notes }
GET   /api/service-members?unit_id=&deployable=  list
GET   /api/service-members/:id                   detail

# Readiness + commander chat  -> backend-readiness-chat
GET   /api/units                                 hierarchy
GET   /api/units/:id                             detail + readiness stats
GET   /api/readiness?unit_id=                    rollup: totals, pct, by-company, pdhra %
GET   /api/readiness/trend?unit_id=&days=90      [{ date, pct_deployable }]
GET   /api/red-flags/summary?unit_id=            [{ category, severity, soldier_count, units[] }]
POST  /api/commander/chat                        { question, unit_id } -> { answer }

# Foundation + RAG  -> backend-foundation-rag
GET   /api/health                                liveness
POST  /api/policy-chat                           { question } -> SSE tokens + sources[]
```

## Sequencing

1. **Day 1 AM** — Foundation unicorn stands up the Express skeleton + DB access
   layer + CORS/error handling. Team agrees the contract above. Bryan briefs the
   data model + seed data.
2. **Day 1–2** — Assessments and Readiness unicorns build their slices in
   parallel on the foundation. Frontend wires to endpoints as they land.
3. **Day 2** — policy-chat + commander data-chat integrated end to end.
4. **Day 3 (2 hrs)** — polish, demo data cleanup, rehearse. No new features.

## Shared gotchas (read once)

- **gRPC service name is `DocumentIntelligence`**, not `PolicyAssistant` (the
  spec's Section 4.7 is wrong). RPCs: `IngestDocument`, `Query` (streaming),
  `ListDocuments`. Proto: `rag-service/docintel.proto`.
- **Gateway uses `tsx`**, not `ts-node`.
- **Port, don't rewrite, the gRPC client**: DocIntel's `gateway/server.ts`
  (`~/Documents/GitHub/DocIntel/docintel/gateway/`) is a working
  `@grpc/proto-loader` client for this exact service. No TS stub codegen needed.
- **Seed data is the rule-engine test fixture**: `responses` JSONB field names
  match the rule conditions; a correct engine reproduces the 17 seeded flags.
- **HIPAA**: commander data-chat returns categories + counts only — never names
  or clinical detail. See `backend-readiness-chat.md`.

## Scope reminder (from DRP_SPEC §5)

MUST: questionnaire (incl. PHQ-9), doc upload, provider queue w/ red-flag filter,
commander dashboard + drill-down, seed data, red-flag engine, mock role switcher.
SHOULD: commander data chat, provider policy assistant, PDF brief export,
mobile-responsive. PDF export is **frontend** (client-side). WON'T: real auth,
MHS Genesis sync, airgap/UDS.
