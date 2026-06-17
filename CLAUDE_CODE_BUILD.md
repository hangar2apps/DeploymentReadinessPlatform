# DRP — Build Instructions for Claude Code

> Deployment Readiness Platform (DRP). Pronounced "DERP."
> Hackathon project — 3 days to build. Prioritize working features over polish.
> Full context and rationale in DRP_SPEC.md. This file is the actionable build guide.

---

## Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **API Gateway:** Node.js + Express + TypeScript
- **RAG Service:** Python + gRPC (already built — lives in `rag-service/`)
- **Database:** Supabase (PostgreSQL + pgvector). Connection string in `.env`
- **LLM:** OpenAI GPT-4o-mini (API key in `.env`)
- **Embeddings:** OpenAI text-embedding-3-small (pre-ingested into Supabase, no embedding calls needed at runtime)

## Repo Structure

```
drp/
├── frontend/              # React + TypeScript + Tailwind
├── gateway/               # Express + TypeScript
├── rag-service/           # Python gRPC server (already built, do not modify unless necessary)
├── docker-compose.yml     # Deployment artifact (not used during development)
├── db/
│   ├── migrations/        # SQL schema
│   └── seed/              # Seed data scripts
├── DRP_SPEC.md            # Full project spec with context
└── CLAUDE_CODE_BUILD.md   # This file
```

## Development Workflow

Everyone runs locally against shared Supabase. No Docker during development.

```
React dev server (npm run dev)           ← localhost:5173
      │
Express gateway (npx tsx server.ts)      ← localhost:3000
      │
Supabase (cloud)                         ← connection string in .env
      │
RAG service (python server.py)           ← localhost:50051 (only needed for policy assistant features)
```

---

## Data Model

```sql
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uic VARCHAR(20) UNIQUE NOT NULL,        -- Unit Identification Code
  name VARCHAR(255) NOT NULL,             -- e.g., "Alpha Company"
  short_name VARCHAR(50),                 -- e.g., "A CO"
  parent_unit_id UUID REFERENCES units(id), -- self-ref for hierarchy (BN → CO → PLT)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE service_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edipi VARCHAR(10) UNIQUE NOT NULL,      -- 10-digit DoD ID
  rank VARCHAR(10) NOT NULL,              -- e.g., "SPC", "SGT", "CPT"
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_initial VARCHAR(1),
  mos VARCHAR(10) NOT NULL,               -- Military Occupational Specialty
  unit_id UUID REFERENCES units(id) NOT NULL,
  deployable BOOLEAN DEFAULT true,
  deployable_reason VARCHAR(255),         -- null if deployable, otherwise category
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_member_id UUID REFERENCES service_members(id) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('PRE', 'POST', 'PDHRA')),
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CERTIFIED', 'REFERRED')),
  responses JSONB NOT NULL DEFAULT '{}',  -- flexible schema for questionnaire answers
  phq9_score INTEGER,                     -- auto-calculated from responses
  pcl5_score INTEGER,                     -- auto-calculated from responses
  submitted_at TIMESTAMPTZ,
  certified_at TIMESTAMPTZ,
  certified_by UUID REFERENCES service_members(id),
  referral_type VARCHAR(50),              -- 'BEHAVIORAL_HEALTH', 'DENTAL', etc.
  referral_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE red_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) NOT NULL,
  type VARCHAR(50) NOT NULL,              -- 'PHQ9_ELEVATED', 'PCL5_ELEVATED', 'DENTAL_CLASS_3', etc.
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  rule_fired VARCHAR(255) NOT NULL,       -- human-readable rule description
  message TEXT NOT NULL,                  -- display message for provider
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- document_chunks table already exists in Supabase (created during pre-hackathon RAG ingestion)
-- Do not recreate or modify it
```

## Red-Flag Rules

Implement these as a rule engine that runs when an assessment is submitted. Each rule checks the assessment responses and creates a `red_flags` record if triggered.

| Rule | Condition | Severity | Message |
|---|---|---|---|
| PHQ-9 elevated | phq9_score >= 10 | HIGH | "PHQ-9 score {score} indicates moderate or greater depression" |
| PHQ-9 mild concern | phq9_score >= 5 AND < 10 | LOW | "PHQ-9 score {score} indicates mild depression" |
| PHQ-9 self-harm | responses.phq9_q9 > 0 | HIGH | "Positive response to self-harm ideation question" |
| PCL-5 elevated | pcl5_score >= 31 | HIGH | "PCL-5 score {score} indicates probable PTSD" |
| Dental Class 3 | responses.dental_class == 3 | HIGH | "Dental Class 3 — non-deployable" |
| Dental Class 4 | responses.dental_class == 4 | HIGH | "Dental Class 4 — requires dental exam" |
| PHA expired | responses.last_pha_date > 12 months ago | MEDIUM | "PHA expired — last completed {date}" |
| Immunization gap | responses.immunizations_current == false | MEDIUM | "Immunization records incomplete or expired" |
| Pregnancy | responses.pregnancy == true | HIGH | "Pregnancy — automatic non-deployable" |
| New medication | responses.new_medication == true | LOW | "New medication started — provider review recommended" |

After red flags are generated, update `service_members.deployable` and `service_members.deployable_reason` accordingly. Any HIGH severity flag = non-deployable.

---

## Three User Surfaces

### 1. Service Member — Questionnaire Flow

**Route:** `/assessment`

**Auth:** Mock login — user selects a service member from a dropdown (seeded data). No real auth.

**Flow:**
1. Landing screen showing assessment status (not started / in progress / submitted / certified)
2. Multi-step questionnaire form:
   - Step 1: Personal info verification (pre-filled from service_member record)
   - Step 2: Medical history (current medications, recent hospitalizations, chronic conditions)
   - Step 3: Dental readiness self-report (last dental visit, known issues)
   - Step 4: Immunization status (upload photo of immunization record)
   - Step 5: PHQ-9 depression screening (9 questions, each scored 0-3)
   - Step 6: PCL-5 PTSD screening (20 questions, each scored 0-4)
   - Step 7: Additional concerns (free text), pregnancy status, self-attestation
   - Step 8: Review and submit
3. After submit: status changes to SUBMITTED, red-flag rules run server-side
4. Service member sees status: "Under provider review" or result after certification

**PHQ-9 questions (all use the same 4-option scale: Not at all / Several days / More than half the days / Nearly every day):**
Over the last 2 weeks, how often have you been bothered by:
1. Little interest or pleasure in doing things
2. Feeling down, depressed, or hopeless
3. Trouble falling/staying asleep, sleeping too much
4. Feeling tired or having little energy
5. Poor appetite or overeating
6. Feeling bad about yourself, or that you are a failure
7. Trouble concentrating on things
8. Moving or speaking so slowly that other people noticed, or being fidgety/restless
9. Thoughts that you would be better off dead, or of hurting yourself

Score: sum of all answers (0-27). Cutoffs: 5=mild, 10=moderate, 15=moderately severe, 20=severe.

**Design notes:**
- Mobile-first — service members fill this out on their phones
- One question per screen for PHQ-9 and PCL-5 (privacy, focus)
- Progress bar showing completion
- Dark theme, military-utilitarian aesthetic (see DRP mockups in drp_mockups.html)

---

### 2. Medical Provider — Review Queue

**Route:** `/provider`

**Auth:** Mock login — user selects a provider (e.g., "CPT Chen, Battalion Surgeon"). Provider sees assessments for their assigned units.

**Layout:** Sidebar + main content area

**Sidebar:**
- Provider name, rank, unit
- Queue counts: My Queue, Red Flagged, Awaiting Labs, Referred Out, Certified (7d)
- Filter by assessment type: Pre-DHA, Post-DHA, PDHRA

**Main area — assessment queue table:**
- Columns: Service Member (name, rank, EDIPI), Unit, Type, Flags (badge with severity + reason), Submitted (relative time), Action button
- Sort by: red flags first, then submission time
- Filter chips: ALL, RED FLAG, OVERDUE, NEW

**Assessment detail view (click a row):**
- Full assessment responses displayed in readable format
- Auto-calculated PHQ-9 score with severity label
- Auto-calculated PCL-5 score with severity label
- Red flags highlighted prominently
- Action buttons: CERTIFY (deployable), REFER (select type + notes), NON-DEPLOYABLE (select reason)
- After action: assessment status updates, service_member.deployable updates

**Policy Assistant chat panel (right side or collapsible):**
- Chat interface where provider types questions about DoD health policy
- Answers come from the RAG service via gRPC through the Express gateway
- Each answer includes source citations (document name, similarity score)
- Example queries shown as placeholder text: "What dental class blocks deployment?", "What PCL-5 score indicates probable PTSD?"

**API endpoints needed:**
```
GET    /api/assessments?status=SUBMITTED&unit_id=...  — provider queue
GET    /api/assessments/:id                            — assessment detail
PATCH  /api/assessments/:id/certify                    — mark deployable
PATCH  /api/assessments/:id/refer                      — refer with type + notes
POST   /api/policy-chat                                — proxy to RAG service via gRPC
```

---

### 3. Commander — Readiness Dashboard

**Route:** `/commander`

**Auth:** Mock login — user selects a commander (e.g., "LTC Harris, 1-327 IN"). Commander sees their battalion and below.

**Layout:** Full-width dashboard

**Top section — KPI cards:**
- % Deployable (large, primary metric, with delta from last week)
- Total Assigned
- Non-Deployable count (with delta)
- PDHRA Compliance %

**Middle section — two-column grid:**

Left column — **Readiness by Company:**
- Table/list: Company name, assigned count, horizontal bar showing %, percentage number, drill-down link
- Color coding: green >90%, yellow 80-90%, red <80%
- Click a company to see individual soldiers

Right column — **Attention Required:**
- Issue list with severity dots (red/yellow/blue)
- Each row: issue title, soldier count, affected units, "ROSTER →" link
- Example issues: "Dental Class 3 — blocking deployment (14 soldiers)", "Behavioral health referral pending (8 soldiers, avg 11 days open)", "PHA expired (27 soldiers)"

**Bottom section — two-column grid:**

Left — **Deployable % — 90 day trend chart** (line chart with area fill)

Right — **Deployment window tracker:**
- N-Day countdown
- Pre-DHAs complete count vs total
- Awaiting provider review count
- Not started count
- "EXPORT CUB BRIEF" and "MESSAGE 1SG" buttons

**Commander Data Chat panel (collapsible or drawer):**
- Chat interface where commander asks questions about their unit's readiness data
- **NOT the RAG policy assistant** — this queries the DRP database, not policy documents
- Express endpoint: takes the question, runs SQL queries against Supabase (readiness data, red flags, unit stats), formats results as context, sends to LLM, returns natural language summary
- HIPAA constraint: LLM prompt must instruct "Summarize by category and count. Do not include individual names or specific medical details."
- Example queries: "Why is Bravo Company at 78%?", "How many soldiers are pending dental?", "Give me a summary for my CUB brief."

**API endpoints needed:**
```
GET    /api/readiness?unit_id=...                      — readiness stats by unit
GET    /api/readiness/trend?unit_id=...&days=90         — trend data for chart
GET    /api/red-flags/summary?unit_id=...              — aggregated issues by category
GET    /api/service-members?unit_id=...&deployable=false — non-deployable roster
POST   /api/commander/chat                             — data chat (SQL → LLM → summary)
```

---

## Mock Auth (Role Switcher)

No real authentication. A dropdown or toggle at the top of the app lets the user switch between:
- **Service Member** → shows the questionnaire flow (pre-selects a service member)
- **Provider** → shows the review queue (pre-selects CPT Chen)
- **Commander** → shows the readiness dashboard (pre-selects LTC Harris, 1-327 IN)

This is for demo purposes only. Store the selected role in React state or localStorage.

---

## API Route Summary

```
# Assessments
GET    /api/assessments                    — list (filterable by status, unit, type)
GET    /api/assessments/:id                — detail
POST   /api/assessments                    — create (service member submits)
PATCH  /api/assessments/:id/certify        — provider certifies
PATCH  /api/assessments/:id/refer          — provider refers

# Service Members
GET    /api/service-members                — list (filterable by unit, deployable status)
GET    /api/service-members/:id            — detail

# Units
GET    /api/units                          — list with hierarchy
GET    /api/units/:id                      — detail with readiness stats

# Readiness
GET    /api/readiness                      — battalion-level rollup
GET    /api/readiness/trend                — time-series data for charts
GET    /api/red-flags/summary              — aggregated by category

# AI Chat
POST   /api/policy-chat                    — RAG policy assistant (proxies to Python gRPC service)
POST   /api/commander/chat                 — commander data chat (SQL → LLM)
```

---

## Seed Data Requirements

The seed script must create:

**Units (1-327 IN Battalion):**
- 1-327 IN (battalion — parent)
  - HHC (headquarters company)
  - Alpha Company
  - Bravo Company
  - Charlie Company
  - Delta Company

**Service Members (80-100):**
- Distribute across all 5 companies
- Realistic ranks: PVT, PFC, SPC, SGT, SSG, SFC (enlisted); 2LT, 1LT, CPT, MAJ, LTC (officers)
- Realistic MOS codes: 11B (Infantry), 68W (Combat Medic), 25U (Signal), 92G (Culinary), 42A (HR)
- Include named characters used in the demo narrative:
  - SPC Rodriguez (Alpha Company) — clean assessment, deployable
  - SPC Bailey (Bravo Company) — elevated PHQ-9 (score 14), referred to behavioral health
  - CPT Chen (HHC) — the battalion surgeon / provider role
  - LTC Harris (HHC) — the battalion commander role

**Assessments (20-30):**
- Mix of statuses: DRAFT, SUBMITTED, UNDER_REVIEW, CERTIFIED, REFERRED
- Mix of types: mostly PRE, some POST
- Include scenarios that trigger each red-flag rule
- Bravo Company should have notably lower readiness (dental issues, behavioral health) — this is the demo drill-down moment

**Red Flags:**
- Auto-generated by the red-flag rules from the assessment data
- Should result in overall battalion readiness of ~87% deployable

---

## Priority Order

Build in this order. If time runs out, the earlier items are the demo.

1. Database schema + seed data + seed script
2. Express API — CRUD for assessments, service members, units
3. Mock auth / role switcher
4. Service member questionnaire flow (frontend)
5. Red-flag rule engine (runs on assessment submit)
6. Provider review queue (frontend)
7. Commander dashboard with KPIs and readiness by company (frontend)
8. Commander data chat (SQL → LLM endpoint + chat UI)
9. Provider policy assistant (gRPC proxy endpoint + chat UI)
10. Trend chart, deployment window tracker, export CUB brief

---

## Design Direction

Dark theme, military-utilitarian aesthetic. Reference: `drp_mockups.html` in the repo.

- Colors: dark bg (#0e1613), accent yellow-green (#c5d64a), ok green (#4ade80), warn yellow (#fbbf24), danger red (#f87171)
- Typography: Sora for body, JetBrains Mono for data/labels/badges
- Dense data displays, minimal whitespace
- CUI classification bar across the top: "CUI // CONTROLLED UNCLASSIFIED INFORMATION // DEMO — NOT ACTUAL PHI"
- Flag badges: color-coded by severity (red=HIGH, yellow=MEDIUM, blue=LOW, green=NONE)