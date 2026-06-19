# Deployment Readiness Platform (DRP)

A unified pre- and post-deployment health assessment platform for military units. DRP digitizes the paper-based DD forms (2795, 2796, 2900) and the manual workflows around them — the EDHA web form, batched provider review, and Excel readiness roll-ups — into a single digital workflow connecting service members, medical providers, and commanders. DRP is a workflow and readiness-visibility layer, **not** a clinical system of record: it is designed to integrate with MHS Genesis (via FHIR), not replace it.

---

## What It Does

Today the process loses signal at every step: screenings are rushed so red flags surface late, post-deployment re-assessment (PDHRA) completion lags once units disperse, and commanders have no real-time view of unit readiness. DRP closes those gaps through three integrated surfaces:

| Surface | Who Uses It | Purpose |
|---------|-------------|---------|
| **Service Member** | All personnel (enlisted + officers) | Submit pre/post-deployment health assessments (PHQ-9, PCL-5, dental, immunizations), upload documents, track status |
| **Medical Provider** | Physicians, PA/NPs | Review flagged assessments, certify or refer service members, consult policy assistant |
| **Commander** | Unit commanders | Real-time unit readiness KPIs, per-unit drill-down, 90-day trend, deployment window tracking, data-chat |

Key capabilities:
- **Auto-scoring** — PHQ-9 (depression) and PCL-5 (PTSD) screeners scored on submission
- **Rule-based red-flag engine** — dental class, behavioral health thresholds, pregnancy, immunization gaps, expired physical exams
- **Policy assistant** — RAG over uploaded policy PDFs; grounded Q&A with pgvector retrieval
- **Commander data-chat** — LLM-powered readiness queries with HIPAA guardrails (aggregates only, no names/medical details)
- **Automated notifications** — email on certify/refer decisions, PDHRA re-contact reminders via APScheduler

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Browser / Client                       │
│             React 19 + TypeScript + Tailwind CSS             │
│                    Vite dev server (:5173)                   │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP  (CORS-enabled in dev)
┌────────────────────────────▼─────────────────────────────────┐
│                    Flask API Gateway (:3000)                 │
│  Blueprints: assessments, service_members, units, readiness, │
│  chat, documents, notifications, uploads                     │
│  In-process: RAG pipeline + APScheduler (PDHRA reminders)    │
│  + Serves built SPA from static/ in production               │
└──────┬───────────────┬──────────────┬──────────────┬─────────┘
       │               │              │              │
┌──────▼───────┐ ┌─────▼────────┐ ┌───▼────────┐ ┌───▼─────────┐
│ Supabase     │ │ Supabase     │ │ OpenAI API │ │ SendGrid    │
│ Postgres     │ │ Storage      │ │ GPT-4o-    │ │ Email       │
│ + pgvector   │ │ member-      │ │ mini +     │ │ certify /   │
│ Units,       │ │ records      │ │ text-      │ │ refer +     │
│ Members,     │ │ bucket       │ │ embedding- │ │ PDHRA       │
│ Assessments, │ │ (uploads)    │ │ 3-small    │ │ reminders   │
│ Red Flags,   │ └──────────────┘ └────────────┘ └─────────────┘
│ Doc Chunks   │
└──────────────┘
```

In production a single Docker image serves both the API and the pre-built React SPA (Flask catch-all route with `index.html` fallback). In development the Vite dev server (:5173) calls the Flask API (:3000) directly over HTTP — there is no proxy; CORS is enabled for the dev origin via `flask-cors`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router 7 |
| API | Flask 3.1, flask-cors, Gunicorn, Python 3.11+ |
| Database | Supabase (PostgreSQL + pgvector) |
| LLM / Embeddings | OpenAI API (GPT-4o-mini, text-embedding-3-small) |
| RAG | LangChain text splitters, pgvector retrieval (in-process in Flask) |
| File Storage | Supabase Storage (bucket: `member-records`) |
| Email | SendGrid (certify/refer + PDHRA notifications) |
| Scheduling | APScheduler (PDHRA re-contact reminders, opt-in via `SCHEDULER_ENABLED`) |
| Container | Docker multi-stage build (Node → uv/Python) |
| Kubernetes | UDS (Zarf + Helm), Helm chart in `chart/` |
| Python packages | `uv` (not pip) |
| Node packages | `npm` |

---

## Project Structure

```
DeploymentReadinessPlatform/
├── frontend/               # React SPA
│   └── src/
│       ├── pages/          # LoginPage, AssessmentPage, ProviderPage, CommanderPage
│       ├── components/     # assessment/, provider/, commander/, layout/, ui/
│       ├── services/       # api.ts (API client seam), fixtures.ts (mock data)
│       ├── lib/            # Pure logic: screeners, readiness, deployment, questionnaire, PDF export
│       ├── types/drp.ts    # Domain model types
│       └── context/        # RoleContext, LayoutContext, DevContext
├── backend/
│   ├── app.py              # Flask application factory, blueprint registration, SPA serving
│   ├── config.py           # Environment config loader
│   ├── db.py               # psycopg2 connection pool + query helpers
│   ├── rules.py            # Scoring (PHQ-9, PCL-5) and red-flag rule engine
│   ├── rag.py              # In-process RAG pipeline: ingest, embed, retrieve, answer
│   ├── email_service.py    # SendGrid integration
│   ├── scheduler.py        # APScheduler for PDHRA re-contact reminders
│   ├── storage.py          # Supabase Storage integration
│   ├── deployment_helpers.py  # Subtree member queries + incomplete-item lookups (notifications)
│   ├── blueprints/         # assessments, service_members, units, readiness,
│   │                       # chat, documents, notifications, uploads
│   └── tests/              # pytest suite (unit + integration)
├── db/
│   ├── migrations/         # SQL schema migrations (run manually against Supabase)
│   └── seed/               # seed.sql (1-327 IN: 90 soldiers, 12 non-deployable),
│                           #   seed_post.sql (POST assessments + pre→post comparison baselines),
│                           #   and demo reset scripts (reset_rodriguez, reset_dalton, dalton_needs_post)
├── chart/                  # Helm chart for Kubernetes deployment
├── manifests/              # UDS Package custom resource
├── bundle/                 # UDS bundle configuration
├── docs/                   # Configuration, policy exemptions, assessment rules
├── tasks.yaml              # UDS task runner: build, cluster, deploy
├── zarf.yaml               # Zarf package configuration
├── .env.example            # Environment variable template
└── docker-compose.yml      # Reference artifact (not used in local dev)
```

---

## Local Development Setup

### Prerequisites

- Node.js 22+
- Python 3.11+
- [`uv`](https://docs.astral.sh/uv/) Python package manager
- A Supabase project with the schema applied (see [Database Setup](#database-setup))
- An OpenAI API key

### 1. Environment Variables

Copy `.env.example` to `.env` in the repo root and fill in your values:

```bash
cp .env.example .env
```

```bash
# .env (repo root)

# --- Supabase (Postgres + pgvector) ---
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_PASSWORD=your-supabase-db-password
SUPABASE_CONNECTION_STRING=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key

# --- OpenAI (commander data-chat + policy RAG) ---
OPENAI_API_KEY=sk-proj-xxx

# --- SendGrid (certify/refer + PDHRA email) ---
SENDGRID_API_KEY=SG.xxxx
SENDGRID_FROM_EMAIL=your-email@example.com

# --- Scheduler (PDHRA re-contact reminders) ---
SCHEDULER_ENABLED=true
```

> **IPv6 note:** The default Supabase direct host is IPv6-only. If your network lacks IPv6, use the session pooler URL instead:
> `postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

### 2. Start the Backend

```bash
cd backend
uv sync                   # Creates .venv and installs all dependencies
uv run python app.py      # Flask starts on http://localhost:3000
```

### 3. Start the Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev               # Vite dev server on http://localhost:5173
```

The frontend defaults to mock data (`VITE_USE_MOCKS=true` in dev). To connect to the real backend, create `frontend/.env.local`:

```bash
# frontend/.env.local
VITE_USE_MOCKS=false
VITE_API_URL=http://localhost:3000
```

### 4. Open the App

Navigate to `http://localhost:5173`. In **mock mode** (the default dev build, `VITE_USE_MOCKS=true`) the login page offers four demo personas: two **Service Members** — Rodriguez (pre-deployment assessment due) and Dalton (post-deployment assessment due) — plus the **Provider** (Chen) and **Commander** (Harris). Selecting one enters that surface.

In **real mode** (`VITE_USE_MOCKS=false`) there is no picker — the app runs behind UDS Authservice + Keycloak, calls `GET /api/me` to resolve the signed-in user's role(s) and identity, and routes straight to their surface. For local real-mode dev without Authservice, set `BACKEND_DEBUG=true` and a `DEV_ROLE` / `DEV_EDIPI` in `.env` (or send `X-Dev-Role` / `X-Dev-Edipi` headers per request) — see [docs/configuration.md](docs/configuration.md).

---

## Application Sections

### Service Member

Route: `/assessment`

Multi-step questionnaire wizard supporting three assessment types:

- **Pre-DHA** — Pre-deployment health assessment before unit deployment
- **Post-DHA** — Post-deployment health assessment on return
- **PDHRA** — Post-Deployment Health Re-Assessment at 90–180 days

Each submission auto-scores PHQ-9 (depression) and PCL-5 (PTSD), runs the red-flag rule engine, and sets an initial deployability status. Members can also upload supporting documents (immunization records, etc.) and track their certification status.

**Key files:** [frontend/src/pages/AssessmentPage.tsx](frontend/src/pages/AssessmentPage.tsx), [frontend/src/components/assessment/](frontend/src/components/assessment/)

### Medical Provider

Route: `/provider`

Assessment review queue sorted red-flagged submissions first. Providers can:

- View a detail drawer with all assessment responses, auto-scored screener results, and fired red flags
- On **POST** assessments, see a **pre→post comparison panel** — baseline vs. return PHQ-9/PCL-5 with color-coded deltas and the reported deployment exposures
- **Certify / Refer** decisions, with actions that adapt to the form: *Certify (deployable) / Refer (non-deployable)* for pre-deployment, *Clear (no referral) / Refer for Care* for post-deployment
- Chat with the **Policy Assistant** — a RAG-powered interface over uploaded policy PDFs for grounded regulatory Q&A

Each decision triggers an automatic email to the service member and updates the unit readiness roll-up.

**Key files:** [frontend/src/components/provider/ReviewQueue.tsx](frontend/src/components/provider/ReviewQueue.tsx), [frontend/src/components/provider/PolicyChat.tsx](frontend/src/components/provider/PolicyChat.tsx)

### Commander Dashboard

Route: `/commander`

Real-time unit readiness view for battalion and company commanders:

- **KPI cards** — overall deployability rate, open red flags, pending reviews, deployment days out
- **Per-company readiness bars** — drill down to a company's roster
- **Attention Required** — soldiers with unresolved high-severity red flags
- **90-day trend chart** — readiness trajectory over time
- **Deployment window** — countdown and readiness gate status
- **Data-chat** — LLM-powered natural language queries over unit readiness data with HIPAA guardrails (category-level aggregates only, no names or medical specifics)
- **CUB Brief export** — one-click PDF export of the commander's update brief

**Key files:** [frontend/src/pages/CommanderPage.tsx](frontend/src/pages/CommanderPage.tsx), [frontend/src/components/commander/](frontend/src/components/commander/)

### Red-Flag Rule Engine

The rule engine ([backend/rules.py](backend/rules.py)) runs on every assessment submission. (Certify resolves that assessment's flags and recomputes deployability from any that remain; refer marks the member non-deployable — neither re-evaluates the rules.) Rules fire based on:

| Rule | Trigger | Severity |
|------|---------|---------|
| `PHQ9_ELEVATED` | PHQ-9 total ≥ 10 | HIGH |
| `PHQ9_MILD` | PHQ-9 total 5–9 | LOW |
| `PHQ9_SELF_HARM` | PHQ-9 question 9 > 0 | HIGH |
| `PCL5_ELEVATED` | PCL-5 total ≥ 31 | HIGH |
| `DENTAL_CLASS_3` | Dental class = 3 | HIGH |
| `DENTAL_CLASS_4` | Dental class = 4 | HIGH |
| `PREGNANCY` | Pregnancy reported | HIGH |
| `IMMUNIZATION_GAP` | Immunizations not current | MEDIUM |
| `PHA_EXPIRED` | Last PHA date > 12 months ago | MEDIUM |
| `NEW_MEDICATION` | New medication started | LOW |

Any HIGH-severity flag marks the soldier non-deployable and sets a reason category (Behavioral Health, Dental, Pregnancy, or Medical).

---

## Backend API Reference

Base URL: `http://localhost:3000`

```
GET  /api/health

GET   /api/assessments             ?status= &unit_id= &type=
GET   /api/assessments/:id         (POST type also returns a pre→post `comparison`)
POST  /api/assessments             (submit; auto-scores + flags on creation)
PATCH /api/assessments/:id/certify
PATCH /api/assessments/:id/refer
POST  /api/assessments/:id/notify-referral   (email the member about a referral)

GET   /api/service-members         ?unit_id= &deployable=
GET   /api/service-members/:id

GET   /api/units
GET   /api/units/:id
POST  /api/units/:id/notify-deployment       (deployment-readiness email blast to the unit)

GET   /api/readiness               ?unit_id=
GET   /api/readiness/trend         ?unit_id=
GET   /api/readiness/post-deployment ?unit_id=
GET   /api/red-flags/summary       ?unit_id=

POST  /api/policy-chat             {question, max_chunks?}
POST  /api/commander/chat          {question, unit_id, history?}

POST /api/documents                (ingest PDF: base64 JSON or multipart)
GET  /api/documents

POST /api/uploads                  (multipart file → Supabase Storage)
```

---

## Database Setup

The database is hosted on Supabase (PostgreSQL + pgvector). To set up a new instance:

1. Create a Supabase project and enable the `pgvector` extension in the SQL editor:
   ```sql
   create extension if not exists vector;
   ```

2. Apply the base schema. The full DDL is in [CLAUDE_CODE_BUILD.md](CLAUDE_CODE_BUILD.md) under "Database Schema". Core tables:
   ```
   units            — battalion/company/squad hierarchy
   service_members  — soldiers with deployability status
   assessments      — submissions with responses, scores, status
   red_flags        — fired rules per assessment
   document_chunks  — RAG chunks with pgvector embeddings (auto-created on first ingest)
   ```

3. Apply the migrations. They add the email/notification/scheduler columns
   (`email`, `deployment_date`, `referral_notified_at`). The three files overlap
   and are all idempotent (`ADD COLUMN IF NOT EXISTS`), so running all of them is
   safe:
   ```bash
   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/0001_add_notification_columns.sql
   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/001_add_deployment_date_and_email.sql
   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/002_add_referral_notified_at.sql
   ```

4. Seed the synthetic 1-327 IN battalion, then the post-deployment data:
   ```bash
   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/seed.sql        # 90 soldiers, 12 non-deployable
   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/seed_post.sql   # POST assessments + pre→post baselines
   ```
   `db/seed/` also holds demo reset scripts (`reset_rodriguez.sql`,
   `reset_dalton.sql`, `dalton_needs_post.sql`) for re-running the assessment flows.

---

## Backend Testing

Tests live in [backend/tests/](backend/tests/) and use `pytest`. There are two categories:

### Unit Tests (no database required)

These run entirely in-process with no external dependencies:

```bash
cd backend
uv run pytest tests/test_rules.py -v        # Rule engine: scoring, flag evaluation, deployability
uv run pytest tests/test_app.py -v          # Flask factory, blueprint registration, SPA routing
uv run pytest tests/test_http.py -v         # HTTP-level route shape tests (mock DB)
uv run pytest tests/test_chat.py -v         # Chat endpoint structure
uv run pytest tests/test_documents.py -v    # Document ingest endpoint
uv run pytest tests/test_readiness_routes.py -v
uv run pytest tests/test_units_routes.py -v
uv run pytest tests/test_uploads.py -v
```

Run all unit tests at once:

```bash
cd backend
uv run pytest -v -m "not db"
```

### Integration Tests (live Supabase required)

Integration tests are marked `@pytest.mark.db` and skip automatically when `SUPABASE_CONNECTION_STRING` is not set. They exercise the full request → Flask → psycopg2 → Supabase → response path against real data.

```bash
cd backend
uv run pytest tests/test_db_integration.py -v -m db
```

Coverage includes:
- All assessment CRUD endpoints and both status transitions (certify / refer)
- Service member list and detail with deployment filter
- Seed data acceptance: ≥12 non-deployable soldiers, ≥17 red flags

### Rule Engine Test Coverage

`test_rules.py` covers every rule exhaustively:

- PHQ-9 boundary values (threshold at 10, mild band 5–9, self-harm q9 independence)
- PCL-5 boundary values (threshold at 31)
- All dental class combinations
- Immunization, PHA expiry, pregnancy, and medication rules
- `deployability()` reason mapping for every HIGH-severity flag type
- **Seed scenario validation** — 10 parameterized cases exactly matching the seeded non-deployable soldiers, ensuring the rule engine reproduces all seed data

### Running the Full Suite

```bash
cd backend

# Unit tests only (fast, no credentials needed)
uv run pytest -v -m "not db"

# Full suite including integration tests
uv run pytest -v

# Single file with verbose output
uv run pytest tests/test_rules.py -v
```

---

## Production Build

A single Docker image serves both the API and pre-built React SPA.

### Build the Image

```bash
docker buildx build \
  -f backend/Dockerfile \
  -t ghcr.io/defenseunicorns/deployment-readiness-platform:0.1.0 \
  --output "type=oci,dest=images/drp-0.1.0.oci.tar" \
  .
```

The Dockerfile uses a three-stage build:
1. **Node 22** — builds the React SPA (`npm run build` → `dist/`)
2. **uv** — resolves Python dependencies from `pyproject.toml` + `uv.lock` into a virtualenv
3. **Python 3.14 runtime** — copies virtualenv, backend source, and built SPA; runs Gunicorn

At runtime Flask serves the SPA from `backend/static/` with a catch-all route that returns `index.html` for any path not matched by an `/api/` blueprint.

### Deploy with UDS

```bash
uds run build      # Build OCI image + Zarf package + UDS bundle
uds run cluster    # Spin up a local k3d cluster with UDS Core
uds run deploy     # Deploy the bundle to the cluster
```

Sensitive values (`SUPABASE_CONNECTION_STRING`, `OPENAI_API_KEY`) are prompted at deploy time by Zarf and injected as Kubernetes secrets.

The deployed app is exposed at `https://drp.<DOMAIN>` (default: `drp.uds.dev`) through the UDS tenant gateway.

---

## Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_USE_MOCKS` | `true` in dev, `false` in Docker | Use fixture data instead of real API calls |
| `VITE_API_URL` | `http://localhost:3000` (dev fallback); `""` (same-origin) in Docker | API base URL; empty means same host as the page |
| `VITE_MOCK_AI` | inherits `VITE_USE_MOCKS` | Override mock behavior for chat endpoints only |

---

## Additional Documentation

| Document | Contents |
|----------|---------|
| [docs/configuration.md](docs/configuration.md) | Full configuration reference |
| [docs/justifications.md](docs/justifications.md) | UDS policy exemptions with justification |
| [docs/DRP_SPEC.md](docs/DRP_SPEC.md) | Full project specification and DoD context |
| [CLAUDE_CODE_BUILD.md](CLAUDE_CODE_BUILD.md) | Complete build guide, database schema, API spec |