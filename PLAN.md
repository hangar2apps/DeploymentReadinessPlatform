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

### Current State

The governing DoD instruction is **DoDI 6490.03, Deployment Health**. It requires three forms across the deployment lifecycle:

| Form | Purpose | Timing |
|---|---|---|
| **DD 2795** | Pre-Deployment Health Assessment | Within 120 days prior to deployment |
| **DD 2796** | Post-Deployment Health Assessment | 30 days before to 30 days after redeployment |
| **DD 2900** | Post-Deployment Health Re-Assessment (PDHRA) | 90–180 days after redeployment |

These forms feed an ecosystem of systems that don't talk to each other well:

- **EDHA** (Electronic Deployment Health Assessment) — Navy-maintained web form, separate from the actual EHR
- **MHS Genesis** — the DoD's Oracle Cerner-based EHR, rolling out since 2017
- **AHLTA** and **AHLTA-Theater** — legacy EHR being sunset, still used in many places
- **ASIMS** (Aeromedical Services Information Management System) — Air Force readiness tracking
- **MEDPROS / eMILPO** — Army personnel/medical readiness tracking
- **Paper forms and unit Excel sheets** — the reality at many units

### Why It's Broken

- **DoD IG (May 2022)**: 58% of providers surveyed expressed concern about accuracy and completeness of MHS Genesis records. 94% said inaccurate/incomplete records affected their ability to provide quality care. 40% reported it caused delayed or incomplete diagnosis.
- **GAO reporting**: missing and incomplete health data in DoD's centralized database; fragmented medical readiness tracking processes.
- **Commanders lack a real-time view** of unit medical readiness. Readiness rollups come from manual pulls by the S1 / medical admin, often in Excel, often days or weeks stale.
- **Service members deploy with incomplete or expired clearances** — PHA expired, dental Class 3, missing vaccinations — because no one surfaced it in time.
- **Post-deployment health issues go untracked** because the PDHRA (DD 2900) is a re-contact problem — soldier is back at home station, no one's chasing them for a form.

The short version: **the data exists, but it's trapped in the wrong places, surfaced too late, to the wrong people.**

### What DRP Changes

| Before | After |
|---|---|
| Paper forms, PDFs, unit Excel sheets | Single digital questionnaire, mobile-friendly |
| Commander calls S1 for readiness numbers | Real-time dashboard, drill-down by unit |
| Red flags caught late (if at all) | Automated alerts the moment a form is submitted |
| PDHRA compliance at ~60% | Push notifications, easy re-entry, completion tracked |
| Providers retyping data between systems | One source of truth, designed to sync to MHS Genesis |

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
4. Exports readiness brief for CUB (Commander's Update Brief).

---

## 4. Technical Architecture

### 4.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (web) | React + TypeScript + Tailwind | Bryan's wheelhouse; fast to build |
| Frontend (mobile) | React Native + Expo | Shared component patterns; offline-capable for field medics |
| Backend | Node.js + Express + TypeScript | Consistent language across stack |
| Database | PostgreSQL (Supabase for hackathon) | JSON support for flexible questionnaire schemas; strong audit trail |
| Auth (hackathon) | Mock CAC/SSO with role selection | Don't burn time on auth |
| Auth (production) | Keycloak / CAC integration | Maps cleanly to UDS Core's Keycloak |
| Deployment (hackathon) | Vercel (web) + single Express server | Fastest demo path |
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

### SHOULD have (strong demo)

- [ ] Push / email notification simulation
- [ ] Post-deployment flow (DD 2796 equivalent)
- [ ] Export readiness brief to PDF
- [ ] Mobile-responsive (not separate native app yet — responsive web is enough)

### WON'T have (v2)

- Real CAC auth, real MHS Genesis sync, real HL7, real native mobile app, airgap/UDS deployment, offline-first sync

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

### Phase 4 — Tactical edge
- Mobile app with offline sync for downrange medics.
- Sync reconciles when connection returns, not full airgap.
- This is where UDS Tactical Edge becomes potentially relevant — but only if forward-deployed instances are needed. Probably not v1 even of production.

### On HL7 specifically
Bryan has HL7 integration experience with MEDITECH and CorePoint/Rhapsody. MHS Genesis uses FHIR (R4) as its primary modern API, with legacy HL7 v2 interfaces available. DRP's integration approach uses FHIR natively for new integrations; HL7 v2 only if required by a legacy peer system.

---

## 7. What's on UDS and What Isn't

**After consultation with Defense Unicorns team:** DRP is a dashboard-centric web app dealing with CUI, not classified data. It does **not** need UDS for v1.

**Where it lives:**
- Hackathon: Vercel + Supabase
- Pilot: AWS GovCloud or Azure Government (IL4 environment)
- Production: Same, with CAC-based auth and MHS Genesis integration

**Where UDS becomes relevant:**
- If/when we build the downrange medic tool for disconnected environments → UDS Tactical Edge
- If/when the Army wants the full stack packaged for their marketplace → UDS Army pipeline for the authorization fast-track

**What we do during the hackathon to keep that option open:**
- Clean Dockerfile for every service
- Configuration via environment variables, not hardcoded
- No dependencies on cloud-specific managed services we can't replace (keep Supabase usage to vanilla Postgres features)
- Stateless services where possible

This means when DU's team later packages DRP for UDS Army, it's a 1-day job, not a 1-week refactor.

---

## 8. Demo Narrative

The pitch to judges, in order:

1. **Hook** — "Every combat casualty gets headlines. The preventable illnesses from incomplete health screening don't — but they happen more often and cost more resources."
2. **Problem** — Show the current state. Paper. Excel. A commander calling S1 for a number that's a week old.
3. **Solution — Service Member flow** — Show SPC Rodriguez completing a pre-DHA on a phone in 15 minutes.
4. **Solution — Provider flow** — Show CPT Chen catching an elevated PHQ-9 score that would've otherwise slipped through.
5. **Solution — Commander flow** — Show LTC Harris seeing his battalion's readiness % change in real time, drilling down, exporting a brief.
6. **Path forward** — "This is built to integrate with MHS Genesis via FHIR, and packages cleanly for UDS Army when the Army's ready to deploy it."
7. **Close** — "I'm a veteran. I've been the soldier filling out paper forms in a conference room at 0530. This is the tool I wished we had."

---

## 9. Open Questions

- Should we scope in National Guard / Reserve readiness tracking for the demo, or active duty only? (Guard/Reserve has much messier data problems; bigger opportunity, bigger scope.)
- How far do we go on PDHRA (DD 2900) given the 90–180 day window is post-hackathon? Suggest: build the data model but demo only pre/post.
- Behavioral health referral workflow — do we build real referral routing or just flag for manual routing? Suggest: flag + free-text note field for v1.

---

## 10. Glossary

- **AHLTA** — Armed Forces Health Longitudinal Technology Application; legacy DoD EHR being replaced
- **ATO** — Authority to Operate; formal security authorization to run on DoD networks
- **CUI** — Controlled Unclassified Information
- **DD 2795 / 2796 / 2900** — The three deployment health assessment forms
- **DHA** — Deployment Health Assessment (the program), OR Defense Health Agency (the org). Context-dependent.
- **DoDI 6490.03** — The DoD Instruction that mandates deployment health assessments
- **EDHA** — Electronic Deployment Health Assessment (current Navy-hosted form system)
- **EDIPI** — Electronic Data Interchange Personal Identifier; the DoD unique ID on a CAC
- **FHIR** — Fast Healthcare Interoperability Resources; modern healthcare data API standard
- **IL4 / IL5** — DoD Impact Levels; data sensitivity classifications for cloud environments
- **MHS Genesis** — Current DoD EHR built on Oracle Cerner
- **PDHRA** — Post-Deployment Health Re-Assessment (DD 2900)
- **PHA** — Periodic Health Assessment (annual physical, separate from deployment assessments)
- **PHI** — Protected Health Information
- **UIC** — Unit Identification Code