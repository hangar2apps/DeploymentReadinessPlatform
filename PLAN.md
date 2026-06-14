# Deployment Readiness Platform (DRP)

> Pronounced "DERP" — because that's how the current process feels.

**Hackathon:** Defense Unicorns Warhacker 2026
**Author:** Bryan Rigsby
**Status:** Pre-hackathon planning document
**Audience:** Claude Code, hackathon teammates, technical stakeholders

---

## 1. What We're Building

A unified pre- and post-deployment health readiness platform. Three user surfaces:

1. **Service Member App** — mobile-friendly questionnaire (pre-DHA / post-DHA / re-assessment), document upload, status tracking
2. **Medical Provider Review** — inbox-style queue of assessments awaiting certification, red-flag alerts, one-click approval or referral
3. **Commander Dashboard** — real-time unit readiness %, individual deployability status, drill-down from battalion → company → squad → soldier

Built on a normal cloud web stack. Not targeting UDS/airgap deployment for v1. Designed so it can be containerized and pushed through UDS Army later without a refactor.

---

## 2. The Problem (What Sucks Today)

> All claims in this section are sourced. See **Section 13 — Sources & References** for full citations. Inline markers like `[S1]` point to specific entries in that section.

### Current State

The governing DoD instruction is **DoDI 6490.03, Deployment Health** `[S1]`. It requires three forms across the deployment lifecycle:

| Form | Purpose | Timing | Source |
|---|---|---|---|
| **DD 2795** | Pre-Deployment Health Assessment | Within 120 days prior to deployment | `[S2]` |
| **DD 2796** | Post-Deployment Health Assessment | 30 days before to 30 days after redeployment | `[S3]` |
| **DD 2900** | Post-Deployment Health Re-Assessment (PDHRA) | 90–180 days after redeployment | `[S3]` |

These forms feed an ecosystem of systems that don't fully interoperate:

- **EDHA** (Electronic Deployment Health Assessment) — web-based assessment system; assessments are "not completed until a healthcare provider certifies the survey," requiring a separate provider appointment after the service member completes the form `[S4]`
- **MHS Genesis** — the DoD's Oracle Cerner-based EHR, rollout began 2017, fully deployed to all military treatment facilities in 2024 `[S5][S6]`
- **AHLTA** and **AHLTA-Theater** — legacy EHR being replaced by MHS Genesis `[S6]`
- **ASIMS** (Aeromedical Services Information Management System) — Air Force readiness tracking, separate from MHS Genesis `[S7]`
- **Paper forms and unit-maintained spreadsheets** — still common at unit level for readiness rollups

### Why It's Broken

**MHS Genesis data quality issues are documented by the DoD Inspector General.** A DoD IG management advisory report (May 2022) surveyed providers at eight military treatment facilities `[S8][S9]`:
- **~58% of respondents** expressed concern with the accuracy and completeness of MHS Genesis electronic health records
- **~94% of respondents** said inaccurate or incomplete patient health care information affected their ability to provide quality care
- **~40%** reported it led to inaccurate, delayed, or incomplete diagnosis
- **260 providers** identified inaccurate or incomplete DoD patient information in MHS Genesis
- The IG noted survey results were biased toward those experiencing problems due to non-response bias

**GAO has repeatedly identified readiness-tracking and interoperability problems:**
- GAO-24-106187 (April 2024): only **29%** of MHS Genesis users agreed the system enables them to deliver high-quality care, vs. 46% for legacy system users `[S10]`
- GAO-21-337 (2021): DoD lacks full definition and tracking of wartime medical skills for enlisted personnel; 30 recommendations issued to improve definition, tracking, and assessment of readiness skills `[S11]`
- GAO-18-378: DHA's tracking of serious adverse medical events is fragmented across the services; DHA officials spend ~80 hours/month reconciling records manually via email `[S12]`

**Post-deployment re-assessment is a known re-contact problem.** DoDI 6490.03 requires the PDHRA (DD 2900) be completed 90–180 days after redeployment `[S1][S3]`, but the soldier is back at home station by then, often dispersed across the unit's normal operating rhythm. Historical DHA program training materials flag the reassessment window as a compliance challenge; we do not yet have a public compliance percentage to cite, so any specific number should be verified with DHA program office before inclusion in the pitch.

**Commander visibility into real-time unit readiness is limited.** Rollups are typically produced manually by S1 / medical admin / UDM (Unit Deployment Manager) staff. Air Force Instruction DAFI 48-122 tasks the UDM and medical treatment facility staff with coordinating and updating medical clearance status, including generating DD Form 2766 (Adult Preventive and Chronic Care Flowsheet) from ASIMS `[S7]` — a manual, cross-system workflow.

### What DRP Changes

| Before | After |
|---|---|
| Paper forms, PDFs, unit Excel sheets | Single digital questionnaire, mobile-friendly |
| Commander calls S1 for readiness numbers | Real-time dashboard, drill-down by unit |
| Red flags caught late (if at all) | Automated alerts the moment a form is submitted |
| PDHRA compliance reliant on unit re-contact | Automated reminders, push/email notifications, tracked completion |
| Providers retyping data between systems | One source of truth, designed to sync to MHS Genesis via FHIR |

### Current Deployment Health Flow (What a Soldier Actually Goes Through)

This is the end-to-end process DRP is designed to improve. Understanding it is critical for building realistic user flows and explaining the product to judges.

#### Phase 1: Pre-Deployment (120 days out to departure)

**Soldier Readiness Processing (SRP)** — a 1-2 day mass processing event at the armory or mobilization site. The soldier moves through stations like an assembly line:

1. **Admin/personnel** — verify SGLI (life insurance), emergency contacts, power of attorney, will
2. **Dental screening** — dentist examines, assigns Dental Readiness Class (1-4). Class 3 or 4 = non-deployable. Soldier gets sent to dental clinic for treatment
3. **Medical screening** — provider reviews medical history, current medications, chronic conditions. Physical exam if PHA is expired
4. **Immunizations** — check shot records against theater requirements (CENTCOM MOD 18 for Middle East). Missing vaccines administered on the spot or scheduled. Anthrax series, typhoid, hep A/B, flu, smallpox depending on theater
5. **Vision/hearing** — baseline audiogram and vision test for post-deployment comparison
6. **DD 2795 (Pre-DHA)** — soldier fills out the form (paper or EDHA web form). Includes PHQ-9 (depression) and PCL-5 (PTSD) as embedded screeners. Covers current health concerns, medications, exposures, overall health self-assessment
7. **Provider certification** — a medical provider reviews the completed DD 2795, reviews screening scores, certifies the soldier as deployable or not. This is a **separate appointment** from the form fill — sometimes same day, sometimes days later. This gap is a key problem DRP solves
8. **ID tags/CAC, legal (JAG), finance, equipment draw** — non-medical stations

**What actually happens vs. what should happen:**
- The DD 2795 is often filled out in a crowded conference room at 0530 with 200 other soldiers. Privacy is minimal. Soldiers rush through the PHQ-9 and mark "not at all" on everything because they don't want to hold up the unit
- Provider certification is done in batches — doctor reviews 30 forms in a stack, signs off, flags obvious issues. Subtle mental health concerns get missed
- Dental is the biggest blocker. Soldiers show up to SRP with Class 3 dental and there aren't enough appointments to fix everyone before the deployment window
- Expired immunizations create a scramble. Soldiers needing a multi-dose series (anthrax is 5 doses) may not complete it before departure

**What DRP changes here:** Soldier completes the DD 2795 on their phone in privacy, days before SRP. PHQ-9 and PCL-5 are auto-scored. Red flags surface to the provider immediately. By the time SRP happens, the provider has already reviewed the assessment — SRP medical station becomes confirmation, not discovery.

#### Phase 2: During Deployment

Health screening mostly pauses unless something happens:

- **Routine sick call** — soldier gets sick or injured, sees the medic or battalion aid station, documented in AHLTA-Theater or MHS Genesis (theater module)
- **Significant events** — concussive event (IED blast, rocket attack), combat stress incident, chemical exposure. Should be documented but the connection to the eventual post-deployment screening is manual and unreliable
- **Mid-deployment screening** — for deployments over 270 days, a mid-deployment health assessment may be required. Rarely happens for shorter rotations
- **Mental health check-ins** — behavioral health providers do periodic assessments, especially after significant combat events

**What DRP changes here (v2 — not hackathon scope):** Event flagging. Medic tags a soldier with a structured flag (concussive event, combat stress exposure, significant injury) that automatically pre-populates the post-deployment screening. See Section 6, Phase 4.

#### Phase 3: Post-Deployment (redeployment through 30 days after)

**DD 2796 (Post-Deployment Health Assessment)** — completed within 30 days before to 30 days after returning home.

1. **Soldier completes the form** — similar to the pre-DHA but focused on deployment experiences. Blast exposure? Wounded? Witnessed death? Mental health screening again (PHQ-9, PCL-5)
2. **Provider review** — certifies the assessment, identifies immediate referral needs
3. **Referrals** — positive screens get referred to behavioral health, TBI clinic, or specialty care
4. **Reintegration briefings** — suicide prevention, family reintegration, financial readiness, TRICARE benefits

**What actually happens:**
- Soldiers are exhausted and want to see their families. They rush through the DD 2796 the same way they rushed through the DD 2795 — marking everything as fine
- Provider review is again done in batches
- Referrals have poor follow-through because the soldier disappears on block leave within 48 hours

**What DRP changes here:** Same workflow improvements as pre-DHA. Plus: if event flags were created during deployment (v2), they pre-populate the post-DHA questionnaire so the provider sees "this soldier had a documented concussive event on day 47" rather than relying on the soldier to self-report.

#### Phase 4: Post-Deployment Re-Assessment (90-180 days after return)

**DD 2900 (PDHRA)** — the re-contact assessment. Designed to catch issues that emerge months after the soldier returns home.

1. **Notification** — the unit contacts the soldier and schedules the PDHRA. For active duty at home station, manageable. For Guard/Reserve soldiers who've returned to civilian life and are scattered across the state, extremely difficult
2. **Soldier completes DD 2900** — same screeners, but now asking "since your return, have you experienced..." PTSD symptoms often don't fully manifest until 3-6 months post-deployment, making this the most clinically important screening
3. **Provider review and referral** — same as post-DHA

**What actually happens:**
- Compliance is historically poor, especially Guard/Reserve. The soldier is back at their civilian job, living 2 hours from the armory, and nobody's chasing them for a form
- This is arguably the most important screening and the one with the worst completion rate

**What DRP changes here:** Automated push notifications at 90 days. Soldier completes the DD 2900 on their phone — no trip to the armory required. Completion is tracked on the commander dashboard. Non-completions surface as a readiness metric.

#### Summary: What DRP Replaces vs. What It Doesn't

**DRP replaces:** paper forms, EDHA web form, manual provider batch review, Excel readiness rollups, phone calls for status updates, manual PDHRA re-contact

**DRP does NOT replace:** the dental chair, the immunization station, the physical exam, the legal briefing, AHLTA-Theater, MHS Genesis. DRP is the workflow and visibility layer, not the clinical system.

---

## 3. Users and Core Journeys

### 3.1 Service Member (SPC Rodriguez, 1-327 IN)

1. Gets push notification: *"Pre-deployment health assessment due in 14 days."*
2. Opens DRP on phone. Completes DD 2795 equivalent — ~15 minutes.
3. Uploads photo of updated immunization record.
4. Submits. Sees status: *"Under provider review."*
5. 48 hours later: *"Cleared for deployment."* Or: *"Referral required — schedule dental appointment."*

### 3.2 Medical Provider (CPT Chen, Battalion Surgeon)

1. Opens provider queue. 23 assessments awaiting review.
2. Filters to red-flag items first: 4 flagged for abnormal PHQ-9, 2 for expired clearances.
3. Reviews SPC Rodriguez's assessment. Auto-calculated PHQ-9 score: 3 (minimal). Vaccinations current. Clicks "Certify — Deployable."
4. Next one: SPC Bailey scored 14 on PHQ-9 (moderate depression). Adds referral note to Behavioral Health. Marks "Not Deployable pending evaluation."

### 3.3 Commander (LTC Harris, Battalion CDR)

1. Opens battalion dashboard Monday morning.
2. Sees: **87% medically deployable** (down from 91% last week).
3. Drills into Bravo Company — 4 soldiers newly non-deployable: 2 pending dental, 1 pending mental health eval, 1 pending PHA.
4. Wants more detail. Opens the chat panel and types: *"Why did Bravo Company's readiness drop?"* Gets: *"Bravo Company dropped from 84% to 78% this week. 6 soldiers moved to non-deployable: 4 Dental Class 3 and 2 pending behavioral health referrals. Dental is the primary driver — recommend coordinating a readiness push with the dental clinic."*
5. Types: *"Give me a summary for my CUB brief."* Gets a formatted readiness summary ready to paste.
6. Exports readiness brief for CUB (Commander's Update Brief).

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Tailwind | Responsive web app serving all three user surfaces (service member, provider, commander) |
| API Gateway | Node.js + Express + TypeScript | HTTP API for the frontend; proxies AI requests to the RAG service via gRPC |
| RAG Policy Service | Python + LangChain + FastAPI/gRPC | AI-powered policy assistant; Python has the strongest LLM/ML ecosystem |
| Service Communication | gRPC + Protocol Buffers | Type-safe contracts between TypeScript and Python services; native streaming for LLM token delivery; mirrors LeapfrogAI's internal architecture |
| Database (hackathon dev) | Supabase (PostgreSQL + pgvector) | Shared cloud database — all three devs connect to the same instance. No local DB setup needed. Use only vanilla Postgres features so it stays portable |
| Database (production) | PostgreSQL + pgvector (self-hosted or GovCloud) | No Supabase dependency in production |
| Embeddings | OpenAI text-embedding-3-small (hackathon) | 1536 dimensions; swap for self-hosted model in production |
| LLM | GPT-4o-mini (hackathon) | Fast, cheap, good for grounded Q&A; swap for LeapfrogAI-hosted model in production |
| Auth (hackathon) | Mock CAC/SSO with role selection | Don't burn time on auth |
| Auth (production) | Keycloak / CAC integration | Maps cleanly to UDS Core's Keycloak |
| Dev workflow (hackathon) | Local processes (npm run dev, ts-node, python) | Each dev runs frontend + gateway locally, all pointing at shared Supabase. Fast iteration, minimal setup |
| Deployment artifact | Docker Compose | Proves the app is containerized and portable. Used for demo talking points and post-hackathon deployment, not for day-to-day development |
| Deployment (production) | Containerized, UDS Army pipeline | IL4/IL5 inheritance |

### 4.2 Data Model (High Level)

```
service_members
  ├── id, edipi, rank, unit_id, mos, ...
  └── hasMany → assessments

units
  ├── id, uic, name, parent_unit_id (self-ref for hierarchy)
  └── hasMany → service_members

assessments
  ├── id, service_member_id, type (PRE|POST|PDHRA)
  ├── status (DRAFT|SUBMITTED|UNDER_REVIEW|CERTIFIED|REFERRED)
  ├── submitted_at, certified_at, certified_by
  ├── responses (JSONB — flexible schema by form version)
  └── hasMany → red_flags, attachments

red_flags
  ├── id, assessment_id, type, severity (LOW|MEDIUM|HIGH)
  ├── rule_fired, message, resolved_at
  └── (e.g., "PHQ-9 score ≥10", "Immunization expired >30d")

readiness_snapshots (computed/cached)
  └── unit_id, date, deployable_count, non_deployable_count, reasons[]
```

### 4.3 Red-Flag Rules (Configurable)

Start with a hard-coded rule set, structure it so rules can be DB-driven later:

- **Mental health**: PHQ-9 ≥ 10, PCL-5 ≥ 33, any self-harm ideation response → HIGH
- **Immunizations**: Any required vaccine expired or missing → MEDIUM
- **PHA**: Periodic Health Assessment > 12 months old → MEDIUM
- **Dental**: Class 3 or Class 4 → HIGH (non-deployable per DoD standards)
- **Pregnancy**: Positive → automatic non-deployable flag with appropriate routing
- **Chronic conditions**: New medication starts, recent hospitalizations → LOW (provider discretion)

### 4.4 Security Posture (for v1)

- All PHI encrypted at rest (Postgres TDE / Supabase default)
- TLS 1.3 in transit
- Audit log on every read/write of assessment data (who, what, when)
- Role-based access: service member sees own only; provider sees assigned unit; commander sees own unit and below
- No PHI in URLs, logs, or analytics
- Session timeout: 15 minutes idle (HIPAA-standard)

### 4.5 RAG Policy Assistant (Provider Only)

A chat interface in the **provider review view.** When a provider is reviewing a borderline case, they can ask natural language questions about DoD health policy and get grounded, cited answers without alt-tabbing to a PDF.

**Example queries:**
- "What dental classification blocks deployment?"
- "Is a PCL-5 score of 28 an automatic referral?"
- "What vaccinations are required for CENTCOM AOR?"
- "How long is a PHA valid before deployment?"
- "Who has waiver authority for deployment medical conditions?"

**How it works:**

```
User types a question
      ↓
Question is embedded (OpenAI text-embedding-3-small)
      ↓
pgvector similarity search across ingested policy documents
      ↓
Top 5 most relevant chunks retrieved
      ↓
Chunks + question sent to LLM as context
      ↓
LLM generates answer using ONLY the provided context
      ↓
Answer + source citations returned to user
```

**Pre-loaded documents (ingested before hackathon — this is data, not code):**
- DoDI 6490.03 (Deployment Health)
- DAFI 48-122 (Air Force Deployment Health)
- Dental readiness classification standards
- Theater-specific immunization requirements
- PHQ-9 / PCL-5 scoring and referral thresholds

**Why this is genuine, not forced:**
Providers currently look up policy by searching PDFs, calling someone, or guessing from memory. This is a real workflow problem documented in the DoD IG's findings about provider efficiency. The policy assistant turns "I think Dental Class 3 blocks deployment but let me check" into a 5-second lookup with a citation.

**Technical implementation:**
This is DocIntel (github.com/hangar2apps/docintel) integrated into DRP. The RAG pipeline is already built and tested. Integration is adding a chat panel to the provider view and pointing it at the DRP backend.

### 4.6 Commander Data Chat

A separate chat capability in the commander dashboard that queries **DRP's own database** — not policy documents. The commander asks questions about their unit's readiness data in natural language and gets summarized answers.

**Example queries:**
- "Why is Bravo Company at 78%?"
- "How many soldiers are pending dental?"
- "Which companies have the most non-deployable soldiers?"
- "What changed since last week?"
- "Give me a summary for my CUB brief."

**How it works (different from the RAG policy assistant — no embeddings needed):**

```
Commander types a question
      ↓
Express backend parses the question
      ↓
Runs SQL queries against the readiness data
(assessments, red_flags, readiness_snapshots, units, service_members)
      ↓
Query results formatted as structured context
      ↓
Context + question sent to LLM
      ↓
LLM generates a natural language summary
      ↓
Summary returned to commander
```

**HIPAA constraint:** The LLM prompt must explicitly instruct: *"Summarize by category and count. Do not include individual names, specific diagnoses, or personal medical details. The audience is a commander who sees deployability status, not clinical information."*

This means the commander gets: *"6 soldiers in Bravo Company are non-deployable due to Dental Class 3"* — not *"SPC Bailey has three untreated cavities."* Categories (dental, behavioral health, immunizations, PHA) are visible. Individual medical details are not.

**UI implementation:** A single chat panel in the commander dashboard. No tabs, no mode switching. The commander asks questions about their unit's data and gets answers. If they need policy guidance, they ask their battalion surgeon (who has the RAG policy assistant in their view).

**Why this matters for the demo:**
This is the "wow" moment. The commander dashboard already shows numbers and charts — every hackathon project has dashboards. But a commander typing a natural language question and getting an instant, HIPAA-compliant summary of why their readiness dropped? That's the demo beat that separates DRP from a spreadsheet with a better UI.

### 4.7 Service Architecture (gRPC)

DRP uses two backend services connected by gRPC:

```
React Frontend
      │ HTTP (REST/JSON)
      ▼
Express API Gateway (TypeScript)
      │ gRPC (Protocol Buffers)
      ▼
RAG Policy Service (Python)
      │ SQL
      ▼
PostgreSQL + pgvector
```

**Why two services instead of one Express monolith?**

The Express gateway handles all CRUD operations for assessments, readiness calculations, red flags, and unit management — standard TypeScript/Express work. The RAG policy assistant is a separate Python service because Python has the strongest LLM/ML ecosystem (LangChain, pypdf, sentence-transformers).

**Why gRPC between them instead of REST?**

- The `.proto` file is a single source of truth for the service contract — both sides know exactly what data is expected
- Protocol Buffers (binary serialization) are smaller and faster than JSON over REST
- Native streaming — the policy assistant streams LLM tokens back to the gateway word-by-word, which streams them to the browser via Server-Sent Events. No WebSocket bolt-on needed.
- This mirrors Defense Unicorns' LeapfrogAI architecture, where the API server communicates with model backends via gRPC

**The proto contract:**

```protobuf
service PolicyAssistant {
  rpc Query (PolicyQuery) returns (stream PolicyResponse);
  rpc IngestDocument (IngestRequest) returns (IngestResponse);
  rpc ListDocuments (ListRequest) returns (DocumentList);
}
```

**For production / airgapped deployment:**
Swap OpenAI API calls for a self-hosted model via LeapfrogAI or Ollama. The pipeline stays identical — embeddings model and LLM are configuration, not architecture.

---

## 5. Scope for Warhacker (3 Days)

### MUST have (demo-critical)

- [ ] Service member questionnaire flow — at minimum DD 2795 equivalent, ~10 key questions including PHQ-9
- [ ] Document upload (immunization record photo)
- [ ] Provider review queue with filtering by red flag
- [ ] Commander dashboard with readiness % and drill-down
- [ ] 50–100 seeded service members across a realistic battalion structure
- [ ] Red-flag rule engine for the rules listed above
- [ ] Mock login with role switcher (demo as service member / provider / commander without real auth)

### SHOULD have (strong demo — these are the differentiators)

- [ ] Commander data chat — natural language questions about unit readiness, answered from DRP's database with HIPAA-compliant summaries
- [ ] RAG policy assistant in provider view — chat interface for policy lookups with citations
- [ ] Export readiness brief to PDF
- [ ] Mobile-responsive layouts for all three surfaces (one codebase, adapts to phone / tablet / desktop)

### NICE to have (if time allows)

- [ ] Push / email notification simulation
- [ ] Post-deployment flow (DD 2796 equivalent)
- [ ] Token-by-token streaming in chat interfaces

### WON'T have (v2)

- Real CAC auth, real MHS Genesis sync, real HL7, airgap/UDS deployment

---

## 6. Integration Strategy (The "What's Next" Story)

We are **not** trying to replace MHS Genesis. DRP is the **workflow and readiness layer** that sits above existing systems. Integration path:

### Phase 1 — Standalone (hackathon through pilot)
DRP runs as its own system with its own data. Manually reconciled with existing records. Proves the workflow and the commander value.

### Phase 2 — Read integrations
- **MHS Genesis** exposes FHIR R4 APIs (Cerner/Oracle standard). Pull immunization records, recent labs, PHA status.
- **DMDC / MilConnect** for personnel data (rank, unit, EDIPI).
- Reduces manual data entry in assessments — questionnaire pre-fills what the system already knows.

### Phase 3 — Write integrations
- Push certified assessments back to MHS Genesis as a signed clinical document (CCD / FHIR DocumentReference).
- Satisfies the "copy must be in the permanent medical record" requirement from DoDI 6490.03.
- Requires formal MHS Genesis API agreement — 6–12 month procurement conversation, not a technical blocker.

### Phase 4 — Downrange event flagging (NOT a separate app)

The earlier version of this spec proposed a native mobile app for downrange medics with offline sync. **We've dropped that.** On closer inspection:

- Theater clinical documentation is already owned by AHLTA-T and the MHS Genesis theater module. DRP has no business there.
- True airgap is rare; most forward locations have sufficient connectivity for a web form to sync eventually.
- A separate React Native codebase is significant scope for unclear value.

The one legitimate medic use case is **event flagging for post-deployment assessment.** Today, when a soldier has a concussive event, significant combat stress exposure, or near-miss injury downrange, it gets documented in the theater EHR and then routinely fails to surface months later during the DD 2796 / DD 2900 cycle at home station. That's a known, persistent gap.

DRP can solve this with a narrow feature — not a separate app:
- Medic (or BN surgeon) uses the same DRP responsive web interface from a theater workstation or tablet.
- Tags the affected soldier with a structured flag: concussive event, combat stress exposure, significant injury, exposure event.
- Flag travels with the soldier's record. Pre-populates the post-DHA questionnaire with the specific event and auto-routes the assessment for enhanced review.
- No native app. No offline sync engineering. Just one more role in the existing web app.

### On HL7 specifically
Bryan has HL7 integration experience with MEDITECH and CorePoint/Rhapsody. MHS Genesis uses FHIR (R4) as its primary modern API, with legacy HL7 v2 interfaces available. DRP's integration approach uses FHIR natively for new integrations; HL7 v2 only if required by a legacy peer system.

---

## 7. What's on UDS and What Isn't

**After consultation with Defense Unicorns team:** DRP is a dashboard-centric web app dealing with CUI, not classified data. It does **not** need UDS for v1.

**Where it lives:**
- Hackathon development: Local processes (React dev server, Express gateway, Python RAG service) pointing at shared Supabase cloud database. No Docker during development.
- Hackathon deployment artifact: Docker Compose in the repo — proves the app is containerized and portable. Used for demo talking points, not day-to-day dev.
- Pilot: AWS GovCloud or Azure Government (IL4 environment)
- Production: Same, with CAC-based auth, MHS Genesis integration, and self-hosted LLMs

**Where UDS becomes relevant:**
- If/when the Army wants the full stack packaged for their marketplace → UDS Army pipeline for the authorization fast-track
- If a future iteration needs to run in genuinely disconnected environments (not our current target) → UDS Tactical Edge

**What we do during the hackathon to keep that option open:**
- Clean Dockerfile for every service (in the repo, used for Docker Compose deployment artifact)
- Configuration via environment variables, not hardcoded (database, API keys, service URLs)
- Supabase used only for vanilla Postgres features — no Supabase-specific APIs, no Supabase Auth, no Supabase Storage. The app works against any Postgres instance.
- Stateless services where possible

This means when DU's team later packages DRP for UDS Army, it's a 1-day job, not a 1-week refactor.

---

## 8. Demo Narrative

The pitch to judges, in order:

1. **Hook** — "Every combat casualty gets headlines. The preventable illnesses from incomplete health screening don't — but they happen more often and cost more resources."
2. **Problem** — Show the current state. Paper. Excel. A commander calling S1 for a number that's a week old. A provider alt-tabbing through PDFs to look up policy.
3. **Solution — Service Member flow** — Show SPC Rodriguez completing a pre-DHA on a phone in 15 minutes.
4. **Solution — Provider flow** — Show CPT Chen catching an elevated PHQ-9 score that would've otherwise slipped through.
5. **Solution — Policy Assistant** — CPT Chen isn't sure about the PCL-5 threshold. Types "What PCL-5 score requires a behavioral health referral?" and gets the answer with a citation from DoDI 6490.03 in 5 seconds. No PDF search, no phone call.
6. **Solution — Commander dashboard** — Show LTC Harris seeing his battalion's readiness % change in real time, drilling down by company.
7. **Solution — Commander data chat (the "wow" moment)** — LTC Harris types: "Why did Bravo Company's readiness drop this week?" The system queries the database and responds: "Bravo Company dropped from 84% to 78%. 6 soldiers moved to non-deployable: 4 Dental Class 3, 2 pending behavioral health referrals. Dental is the primary driver — recommend coordinating a readiness push with the dental clinic." Then: "Give me a summary for my CUB brief." Instant formatted readiness summary.
8. **Architecture** — "Two services: TypeScript for the app, Python for the AI, connected by gRPC. Same architecture as LeapfrogAI. Fully containerized — runs with `docker compose up`. Designed to swap OpenAI for self-hosted models and package for UDS Army when the time comes."
9. **HIPAA note** — "The commander sees categories and counts, never individual medical details. The system is explicitly designed to summarize without exposing PHI."
10. **Path forward** — "This integrates with MHS Genesis via FHIR. The AI capabilities scale — the provider's policy assistant covers any DoD regulation, the commander's data chat works on any structured readiness data. UDS Army is the authorization path when we're ready for Army networks."
11. **Close** — "I'm a veteran. I've been the soldier filling out paper forms in a conference room at 0530. This is the tool I wished we had."

---

## 9. Open Questions (Resolved)

- ~~Should we scope in National Guard / Reserve readiness tracking for the demo, or active duty only?~~ **DECIDED: Active duty only for the hackathon.** Guard/Reserve has much messier data problems (soldiers scattered across the state, multiple readiness systems, civilian employer coordination). Bigger opportunity, but too much scope for 3 days. Mention it as a future expansion in the pitch.

- ~~How far do we go on PDHRA (DD 2900) given the 90–180 day window is post-hackathon?~~ **DECIDED: Build the data model, don't build the UI flow.** The `assessments` table supports `type: PDHRA`. Seed data includes a few PDHRA records in various states (complete, overdue, pending). Commander dashboard shows PDHRA compliance % as a metric. But there's no DD 2900 questionnaire a soldier can fill out — it uses the same pattern as the pre/post-DHA flows, so adding it is a day of work post-hackathon. In the demo, point to the compliance metric and say "the PDHRA form is the same architecture as what you just saw — the data model already supports it."

- ~~Behavioral health referral workflow — do we build real referral routing or just flag for manual routing?~~ **DECIDED: Flag + free-text note field.** Provider marks a soldier as "Referred — Behavioral Health" with a note. No automated routing, no integration with behavioral health scheduling systems. The flag surfaces on the commander dashboard as a non-deployable reason. Real referral routing is a v2 feature requiring integration with MHS Genesis appointment scheduling.

- ~~Downrange event flagging (Phase 4 feature): in scope for the hackathon demo, or save it for v2?~~ **DECIDED: Mention in the narrative, don't build.** Event flagging is a compelling story ("concussive events in theater automatically pre-populate the post-deployment screening") but building it requires a medic role, a theater context, and a sync mechanism — too much scope. Describe it in the pitch as the logical v2 extension.

---

## 10. Team & Workload Split

Three developers, 2.5 effective build days (Day 3 is 2 hours of polish + presentations).

### Development Workflow

Everyone develops locally against a shared Supabase database. No Docker during development — Docker Compose exists in the repo as a deployment artifact but is not used for day-to-day coding.

**Each developer's local setup:**

```
React dev server (npm run dev)          ← each dev runs locally
      │
Express gateway (npx ts-node server.ts) ← each dev runs locally
      │
Supabase (cloud)                        ← shared by all three devs
```

**How code flows between teammates:**
1. Bryan pushes a new API endpoint to GitHub
2. Derrick pulls, restarts their local Express gateway
3. Derrick can now build frontend against the new endpoint
4. Both are reading/writing the same Supabase database
5. Cody pulls latest from both, tests full flows

The RAG service (Python) only needs to run locally when testing the policy assistant. For most frontend and backend work, just Express + Supabase is enough.

**Supabase setup (Bryan does this pre-hackathon):**
- Create project, enable pgvector extension
- Run schema migrations (tables for service_members, units, assessments, red_flags, readiness_snapshots, document_chunks)
- Load seed data (fake battalion, service members, assessments)
- Ingest policy documents (embeddings stored in document_chunks)
- Share Supabase connection string with teammates via `.env.example`
- Use only vanilla Postgres features — no Supabase-specific APIs — so the app stays portable to any Postgres instance

### Bryan (Tech Lead + Backend + AI)
- Express API: all CRUD endpoints for assessments, readiness, units, service members
- Database schema, migrations, seed data script
- Red-flag rule engine
- gRPC integration with RAG policy service
- Commander data chat endpoint (SQL queries → LLM summary)
- Docker Compose config (pre-hackathon prep — deployment artifact, not dev workflow)
- Supabase project setup and seed data loading (pre-hackathon)
- Architecture decisions, unblocking teammates, code review

### Derrick (Frontend)
- All three UI surfaces in React + TypeScript + Tailwind:
  - Service member questionnaire flow
  - Provider review queue with red-flag filtering
  - Commander dashboard with readiness %, drill-down, charts
- Chat panels: policy assistant (provider view) and data chat (commander view)
- Mock login with role switcher
- Wire frontend to backend API endpoints
- This is the most visible work during the demo — polish matters here

### Cody — DU Customer Success Engineer (Domain + Demo + QA)
- Validate user journeys against real military workflows — catch things we get wrong
- Curate and validate policy documents for RAG ingestion
- Review seed data for realism (correct ranks, unit structures, assessment scenarios)
- QA completed flows from a user/customer perspective
- Own the demo narrative and pitch preparation — lead rehearsals
- If they code: frontend polish, documentation, or readiness brief export
- Handle UDS/platform questions from judges
- Their biggest value isn't code — it's credibility and domain accuracy

### Day-by-Day Schedule

**Day 0 — Before the hackathon (Bryan, pre-hackathon prep):**
- Supabase project created, schema migrated, seed data loaded, policy docs ingested
- Repo scaffolded, `.env.example` ready, Docker Compose config working
- Teammates have cloned the repo and verified they can run locally against Supabase

**Day 1 — Foundation:**
- Bryan: API scaffolding, CRUD endpoints, red-flag engine. Push to GitHub frequently so Derrick can pull.
- Derrick: React app scaffold, role switcher, service member questionnaire flow. Pull Bryan's API as endpoints become available.
- Cody: Validate seed data, review policy document RAG answers, begin demo script
- End of day: questionnaire submits to the API, seed data visible in the dashboard

**Day 2 — Features + Integration (this is the real deadline):**
- Bryan: Provider/commander API endpoints, RAG integration, commander data chat
- Derrick: Provider queue, commander dashboard, chat panels
- Cody: QA all flows, refine demo narrative, test policy assistant answers
- End of day: all three surfaces working end-to-end with real data

**Day 3 — Polish + Present (2 hours only):**
- Everyone: bug fixes, UI polish, demo data cleanup
- Cody: lead a full demo rehearsal, time it, adjust
- No new features. If it's not working by Day 3 morning, cut it from the demo.

---

## 11. Pre-Hackathon Prep Checklist

Prepare in advance so the 3 days are spent on the product, not on scaffolding. Everything below is infrastructure, tooling, and data — not the product itself. Confirm with DU that boilerplate/scaffolding is allowed (standard at most hackathons).

### Repo & Boilerplate (do first)

- [ ] Create GitHub repo with README, .gitignore, license
- [ ] Set up monorepo structure:
  ```
  drp/
  ├── docker-compose.yml       # Deployment artifact — not used during development
  ├── frontend/                # React + TypeScript + Tailwind (empty app shell)
  ├── gateway/                 # Express + TypeScript + gRPC client (routes stubbed, no logic)
  ├── rag-service/             # DocIntel Python service (already built)
  └── db/
      ├── migrations/          # SQL schema migrations
      └── seed/                # Seed data scripts
  ```
- [ ] Docker Compose config for deployment artifact (all services containerized). Verify `docker compose up --build` starts everything clean. This is for the production story, not for daily dev.
- [ ] Environment variable template (`.env.example`) with all required keys documented, including Supabase connection string

### Supabase Setup (shared development database)

- [ ] Create Supabase project
- [ ] Enable pgvector extension
- [ ] Run schema migrations — tables for service_members, units, assessments, red_flags, readiness_snapshots, document_chunks
- [ ] Verify teammates can connect with the shared connection string
- [ ] Document connection details in `.env.example` (never commit actual credentials)

### Seed Data (critical — takes hours to do well)

- [ ] Realistic battalion structure: 1-327 IN with HHC, Alpha, Bravo, Charlie, Delta companies
- [ ] 50–100 fake service members with: name, rank, EDIPI, MOS, unit assignment
- [ ] 15–20 pre-built assessment responses with varied outcomes:
  - Clean assessments (deployable)
  - Elevated PHQ-9 scores (behavioral health flag)
  - Dental Class 3 (non-deployable)
  - Expired immunizations
  - Expired PHA
  - Pregnancy
  - Recent medication changes
- [ ] Seed script that populates Supabase with one command (`node db/seed/run.js` or `psql` against the Supabase connection string)
- [ ] Verify the commander dashboard shows realistic data from seeds

### RAG Policy Documents (data, not code)

- [ ] Download and prepare PDFs for ingestion:
  - DoDI 6490.03 (Deployment Health)
  - DAFI 48-122 (Air Force Deployment Health)
  - Dental readiness classification guide (Camp Lejeune IMR PDF + AR 40-35)
  - PHQ-9 scoring and interpretation guide
  - PCL-5 scoring and referral thresholds (VA National Center for PTSD)
  - Theater-specific immunization requirements (CENTCOM MOD 18)
- [ ] Test ingestion through DocIntel — verify all documents chunk and embed cleanly
- [ ] Write 10 test questions and verify quality of RAG answers
- [ ] Embeddings stored in Supabase's pgvector — ingested once pre-hackathon, available to all teammates immediately

### Design System (reusable, not product-specific)

- [ ] Extract color variables, typography, and layout patterns from the DRP mockups into a shared CSS/Tailwind config
- [ ] Build reusable components: data table, status badge, KPI card, sidebar layout, form inputs
- [ ] These are generic UI components, not DRP screens — the screens get built during the hackathon

### Proto Definitions

- [ ] Write `.proto` files for DRP-specific services if using gRPC beyond the RAG service
- [ ] Generate stubs for both Python and TypeScript
- [ ] Verify gRPC communication works between gateway and RAG service locally

### Local Dev Environment (each teammate)

- [ ] Verify Node.js 20+, Python 3.12+, Docker Desktop all current on hackathon machine
- [ ] Clone the repo, copy `.env.example` to `.env`, fill in Supabase connection string and OpenAI API key
- [ ] Verify `npm run dev` (frontend) and `npx ts-node server.ts` (gateway) start cleanly
- [ ] Verify connection to shared Supabase instance
- [ ] VS Code extensions: Tailwind IntelliSense, ESLint, Prettier, Python, Proto3

### Know Before You Go

- [ ] Re-read this spec. Know the user journeys, the data model, and the red-flag rules cold.
- [ ] Practice the demo narrative out loud. Time it.
- [ ] Know your "What's Next" story (FHIR integration, UDS Army, self-hosted models) without reading from notes.
- [ ] Have the GAO and DoD IG citations ready for tough questions (Section 13 of this doc).

---

## 12. Glossary

- **ACIP** — Advisory Committee on Immunization Practices; sets civilian and military vaccination guidelines
- **AHLTA** — Armed Forces Health Longitudinal Technology Application; legacy DoD EHR being replaced by MHS Genesis
- **AHLTA-T / AHLTA-Theater** — Theater version of AHLTA used for deployed medical documentation
- **AOR** — Area of Responsibility; a geographic region assigned to a combatant command (e.g., CENTCOM AOR covers the Middle East)
- **ASIMS** — Aeromedical Services Information Management System; Air Force readiness tracking system
- **ATO** — Authority to Operate; formal security authorization required before software can run on DoD networks
- **BAS** — Battalion Aid Station; the first-line medical facility at the battalion level
- **BN** — Battalion; a military unit typically consisting of 300-800 soldiers
- **C2** — Command and Control; the exercise of authority and direction by a commander
- **CAC** — Common Access Card; the DoD's smart card for identification and system access
- **CCD** — Continuity of Care Document; a standard format for exchanging patient summary records
- **CCDR** — Combatant Commander; a four-star officer commanding a combatant command
- **CENTCOM** — United States Central Command; the combatant command responsible for the Middle East, Central Asia, and parts of South Asia
- **CO** — Company; a military unit typically consisting of 80-200 soldiers
- **CUB** — Commander's Update Brief; a regular briefing where commanders present unit status to their chain of command
- **CUI** — Controlled Unclassified Information; sensitive but not classified data requiring specific handling
- **DAFI** — Department of the Air Force Instruction; Air Force regulatory documents
- **DD** — Department of Defense (when used with form numbers, e.g., DD 2795)
- **DD 2795 / 2796 / 2900** — The three deployment health assessment forms (pre-deployment, post-deployment, and post-deployment re-assessment)
- **DHA** — Defense Health Agency (the org that manages military healthcare), OR Deployment Health Assessment (the screening program). Context-dependent
- **DMDC** — Defense Manpower Data Center; manages personnel data systems including MilConnect
- **DoD** — Department of Defense
- **DoD IG** — Department of Defense Inspector General; the independent oversight body
- **DoDI** — Department of Defense Instruction; a DoD-level regulatory document
- **DRC** — Dental Readiness Classification; the 4-class system (Class 1-4) for dental deployability
- **DSM-5** — Diagnostic and Statistical Manual of Mental Disorders, 5th Edition; the standard classification of mental disorders
- **EDHA** — Electronic Deployment Health Assessment; the current Navy-hosted web form system for deployment health screening
- **EDIPI** — Electronic Data Interchange Personal Identifier; the 10-digit DoD-unique ID number on a CAC
- **EHR** — Electronic Health Record
- **FHIR** — Fast Healthcare Interoperability Resources; the modern healthcare data API standard (pronounced "fire")
- **FISMA** — Federal Information Security Modernization Act; law requiring federal agencies to secure their information systems
- **GAO** — Government Accountability Office; the congressional watchdog that audits federal agencies
- **gRPC** — Google Remote Procedure Call; a protocol for service-to-service communication using Protocol Buffers
- **HHC** — Headquarters and Headquarters Company; the command and support element of a battalion
- **HIPAA** — Health Insurance Portability and Accountability Act; the law governing medical data privacy
- **HL7** — Health Level 7; a set of standards for exchanging healthcare data between systems
- **IED** — Improvised Explosive Device
- **IL4 / IL5** — Impact Levels 4 and 5; DoD data sensitivity classifications for cloud environments. IL4 covers CUI; IL5 covers CUI plus national security data
- **IMR** — Individual Medical Readiness; the overall medical readiness status of a service member
- **IN** — Infantry (as in 1-327 IN = 1st Battalion, 327th Infantry Regiment)
- **JAG** — Judge Advocate General; the military's legal corps
- **LLM** — Large Language Model; the AI model that generates natural language responses (e.g., GPT-4, Claude)
- **MHS Genesis** — Military Health System Genesis; the current DoD EHR built on Oracle Cerner, replacing AHLTA
- **MOD 18** — Modification 18 to the USCENTCOM Individual Protection and Individual-Unit Deployment Policy; the current CENTCOM theater entry requirements including immunizations
- **MOS** — Military Occupational Specialty; a soldier's job code (e.g., 11B = Infantryman, 68W = Combat Medic)
- **MTF** — Military Treatment Facility; a military hospital or clinic
- **NIST 800-53** — The specific security control framework federal agencies use to satisfy FISMA requirements
- **NIPR / NIPRNet** — Non-classified Internet Protocol Router Network; the DoD's unclassified network
- **OCIE** — Organizational Clothing and Individual Equipment; the gear issued to a soldier for deployment
- **OIF** — Operation Iraqi Freedom (2003-2010)
- **PCL-5** — PTSD Checklist for DSM-5; a 20-item self-report measure of PTSD symptoms. Score range 0-80. Cutoff of 31-33 indicates probable PTSD
- **PDHRA** — Post-Deployment Health Re-Assessment (DD 2900); completed 90-180 days after redeployment
- **PHA** — Periodic Health Assessment; the annual physical exam for service members (DD Form 3024), separate from deployment-specific assessments
- **PHI** — Protected Health Information; individually identifiable health data protected by HIPAA
- **PHQ-9** — Patient Health Questionnaire-9; a 9-item depression screening tool. Score range 0-27. Scores of 5/10/15/20 = mild/moderate/moderately severe/severe. Score ≥10 = positive screen
- **PLT** — Platoon; a military unit typically consisting of 16-44 soldiers
- **PTSD** — Post-Traumatic Stress Disorder
- **RAG** — Retrieval-Augmented Generation; an AI pattern that grounds LLM responses in specific documents
- **S1** — the personnel/admin staff section at battalion or brigade level
- **SBOM** — Software Bill of Materials; a manifest listing every component in a software package
- **SGLI** — Servicemembers' Group Life Insurance
- **SRP** — Soldier Readiness Processing; the mass processing event where soldiers complete all pre-deployment requirements
- **SSE** — Server-Sent Events; a web standard for streaming data from server to browser
- **SSO** — Single Sign-On; an authentication scheme that allows one login for multiple systems
- **TBI** — Traumatic Brain Injury
- **TLS** — Transport Layer Security; the encryption protocol behind HTTPS
- **TRICARE** — the military's healthcare program for service members, retirees, and families
- **UAS** — Unmanned Aerial System; military drones and their associated ground control equipment
- **UDM** — Unit Deployment Manager; the person responsible for tracking deployment readiness at the unit level
- **UDS** — Unicorn Delivery Service; Defense Unicorns' core platform for deploying software to DoD environments
- **UIC** — Unit Identification Code; a unique identifier for a military unit
- **Zarf** — Defense Unicorns' open-source tool for packaging software for airgapped deployment

---

## 13. Sources & References

All claims in Section 2 ("The Problem") are sourced below. Official government documents (DoD Instructions, GAO reports, IG reports) should be considered primary authority; reporting in Military Times / MOAA / Air & Space Forces Magazine are secondary sources summarizing the primary reports and are cited where they provide clear summaries of the underlying findings.

### Primary DoD and government sources

- **`[S1]` DoDI 6490.03, Deployment Health** — the DoD Instruction that mandates pre- and post-deployment health assessments. See DHA-PI 6490.03 (implementing procedural instruction). Summarized at: https://www.pdhealth.mil/treatment-guidance/deployment-health-assessments/pre-deployment-health-assessment

- **`[S2]` DD Form 2795 — Pre-Deployment Health Assessment** — official form and timing requirements. https://www.esd.whs.mil/portals/54/documents/dd/forms/dd/dd2795.pdf (alternate host: https://api.army.mil/e2/c/downloads/2025/12/11/f93e02b4/pre-deployment-health-assessment-dd-form-2795.pdf)

- **`[S3]` DHA Program Training (Sept 2020)** — timing requirements for DD 2795, DD 2796, and DD 2900 (PDHRA 90–180 days after redeployment). https://media.defense.gov/2020/Sep/12/2002496119/-1/-1/0/DHA-PROGRAM-TRAINING-SEP-2020.PDF

- **`[S4]` TECOM Pre/Post Deployment Health Assessment Go-By** — describes EDHA workflow including the requirement that assessments are not complete until a provider certifies the survey. https://www.tecom.marines.mil/Portals/90/HQBN/Directives/Medical/Pre-Post%20Deployment%20Health%20Assessment%20Go-By.pdf

- **`[S5]` MHS Genesis overview — Health.mil** — official program description. https://www.health.mil/Military-Health-Topics/Technology/MHS-GENESIS

- **`[S6]` GAO-24-106187, "Electronic Health Records: DOD Has Deployed New System but Challenges Remain"** (April 2024) — full MHS Genesis deployment history, user satisfaction data, comparison to legacy systems and private sector users. https://www.gao.gov/assets/870/868847.pdf

- **`[S7]` DAFI 48-122, Deployment Health** — Air Force instruction detailing UDM responsibilities, ASIMS usage, DD Form 2766 workflows. https://static.e-publishing.af.mil/production/1/af_sg/publication/dafi48-122/dafi48-122.pdf

- **`[S8]` DoD Inspector General Management Advisory (May 5, 2022)** — MHS Genesis provider survey findings. Primary report summarized in sources S9 below. Survey conducted Oct–Nov 2020 at eight military treatment facilities; 701 of 7,378 providers responded.

- **`[S9]` Secondary reporting on the DoD IG 2022 MHS Genesis survey:**
  - Military Times, "Errors in DoD's new electronic health care records system raise concerns among providers" (May 2022): https://www.militarytimes.com/pay-benefits/2022/05/09/errors-in-dods-new-electronic-health-care-records-system-raise-concerns-among-providers/
  - MOAA, "Errors in DoD's New Electronic Health Records System Raise Provider Concerns" (May 2022): https://www.moaa.org/content/publications-and-media/news-articles/2022-news-articles/errors-in-dods-new-electronic-health-records-system-raise-provider-concerns/

- **`[S10]` GAO-24-106187 — MHS Genesis user satisfaction data** (same report as S6): only 29% of MHS Genesis users agreed the system enables delivery of high-quality care in 2023 (up from 24% in 2022), compared to 46% of legacy system users and 50% of private-sector users of the same commercial system. https://www.gao.gov/assets/870/868847.pdf

- **`[S11]` GAO-21-337, "Defense Health Care: Actions Needed to Define and Sustain Wartime Medical Skills for Enlisted Personnel"** (June 2021) — 30 recommendations to DoD on defining, tracking, and assessing wartime medical skills. https://www.gao.gov/assets/gao-21-337.pdf

- **`[S12]` GAO-18-378, "DOD Health Care: Defense Health Agency Should Improve Tracking of Serious Adverse Medical Events"** — fragmented tracking across the services; DHA officials spend ~80 hours/month reconciling records manually via email. https://www.gao.gov/products/gao-18-378 (PDF: https://www.gao.gov/assets/gao-18-378.pdf)

### Additional supporting coverage

- Air & Space Forces Magazine, "DoD Needs To Make MHS Genesis Better for Users; Watchdog" (April 2024) — summary of GAO-24-106187 findings: https://www.airandspaceforces.com/mhs-genesis-military-health-care/
- Military.com, "Military Clinicians Not Particularly Happy with DoD's New Electronic Health Records System, Watchdog Finds" (April 2024): https://www.military.com/daily-news/2024/04/24/military-clinicians-not-particularly-happy-dods-new-electronic-health-records-system-watchdog-finds.html
- Navy Times, "Defense electronic health records rollout is halfway done, even as VA's is delayed" (June 2022): https://www.navytimes.com/pay-benefits/2022/06/22/defense-electronic-health-records-rollout-is-halfway-done-even-as-vas-is-delayed/

### Claims NOT yet sourced (verify before using in pitch)

Two earlier versions of this spec included figures we removed because we could not find direct citations:

- **"PDHRA compliance at ~60%"** — plausible and consistent with general DHA discussion of the re-contact problem, but we have no public primary source for a specific compliance percentage. If presenting to judges, either (a) verify through DHA program office / DHRA, or (b) say "historically difficult to track" without giving a number.
- **Specific statistic on service members deploying with incomplete vaccinations or expired clearances** — the general problem is acknowledged in DoD doctrine and provider reporting, but we don't have a clean cited statistic. Safe framing: "documented in GAO and IG reporting as a persistent gap" rather than claiming a percentage.

### How to verify for yourself

If judges or DU stakeholders want to independently verify:
1. Start with **GAO-24-106187** — it's the most current and consolidates the MHS Genesis picture.
2. Pull **DoDI 6490.03** for the authoritative deployment health assessment requirements.
3. Cross-reference with **DAFI 48-122** (Air Force) or equivalent service regulations for actual workflow mechanics.