# Deployment Health Flow — Current State vs. DRP

For the team (especially the unicorns new to the domain): this is what a soldier
actually goes through today, where it breaks, and how DRP fixes each gap.
Source: `DRP_SPEC.md` §2. Acronyms at the bottom.

## The three forms (the legal backbone)

DoD Instruction **6490.03** mandates three deployment-health assessments:

| Form | What | When |
|---|---|---|
| **DD 2795** | Pre-Deployment Health Assessment (Pre-DHA) | ≤120 days before deploying |
| **DD 2796** | Post-Deployment Health Assessment (Post-DHA) | 30 days before → 30 days after return |
| **DD 2900** | Post-Deployment Health **Re**-Assessment (PDHRA) | 90–180 days after return |

Each form embeds **PHQ-9** (depression) and **PCL-5** (PTSD) screeners. A form
isn't "done" until a **provider certifies** it — a separate step from the
soldier filling it out. That gap is the core problem.

---

## Current flow (what actually happens)

```mermaid
flowchart TD
    classDef pain fill:#3b1f1f,stroke:#f87171,color:#fde8e8;

    Start([Deployment ordered]) --> SRP

    subgraph PRE["PHASE 1 · Pre-Deployment, up to 120 days out"]
      SRP["SRP: 1-2 day mass processing event<br/>dental, medical, immunizations, vision/hearing"] --> F2795["DD 2795 Pre-DHA<br/>paper or EDHA web form"]
      F2795 --> CERT["Provider certification<br/>SEPARATE appointment, often batched"]
    end

    CERT --> DEP{"Deployable?"}
    DEP -->|No| FIX["Dental / immunization / behavioral-health fix<br/>scramble before the deployment window"]
    DEP -->|Yes| DEPLOY

    subgraph DUR["PHASE 2 · During Deployment"]
      DEPLOY["Deployed"] --> EVENT["Significant events: blast, combat stress, injury<br/>logged in AHLTA-T / MHS Genesis theater module"]
    end

    EVENT --> RET([Redeployment / return home])

    subgraph POST["PHASE 3 · Post-Deployment, within 30 days"]
      RET --> F2796["DD 2796 Post-DHA<br/>blast exposure + PHQ-9 / PCL-5"]
      F2796 --> REV["Provider review + referrals"]
    end

    REV --> LEAVE["Block leave — soldier disperses within 48h"]

    subgraph PDHRA["PHASE 4 · Re-Assessment, 90-180 days after"]
      LEAVE --> RECON["Unit must re-contact the soldier"]
      RECON --> F2900["DD 2900 PDHRA<br/>most clinically important screening"]
      F2900 --> REV2["Provider review + referrals"]
    end

    PN1["0530 in a room with 200 soldiers — no privacy,<br/>PHQ-9 rushed, everyone marks 'not at all'"]:::pain -.-> F2795
    PN2["Batch sign-off — subtle mental-health concerns missed"]:::pain -.-> CERT
    PN3["Event-to-screening link is manual and unreliable"]:::pain -.-> EVENT
    PN4["Re-contact fails; worst completion rate of all four"]:::pain -.-> RECON
    PN5["Commander readiness = manual Excel rollups, often a week old"]:::pain -.-> DEP
```

### The pain, phase by phase
- **Phase 1 — Pre-Deployment:** The DD 2795 is filled out in a crowded room at
  0530. No privacy, so soldiers under-report on the PHQ-9 to avoid holding up
  the unit. Provider certification is a *separate, batched* review where subtle
  issues slip through. Dental Class 3/4 is the biggest blocker — not enough
  appointments before the window.
- **Phase 2 — During Deployment:** Concussive events / combat stress get logged
  in the theater EHR but don't reliably resurface at the post-deployment
  screening. (DRP v2 fixes this with event flagging — out of hackathon scope.)
- **Phase 3 — Post-Deployment:** Exhausted soldiers rush the DD 2796; referrals
  have poor follow-through because the soldier is on block leave in 48 hours.
- **Phase 4 — Re-Assessment (PDHRA):** The most important screening (PTSD often
  surfaces months later) has the *worst* completion rate — nobody's chasing a
  dispersed soldier for a form.
- **Throughout:** Commanders have no real-time readiness view; rollups are
  manual Excel produced by S1/UDM staff, often a week stale.

---

## DRP flow (the fix)

```mermaid
flowchart TD
    classDef fix fill:#1f2e1f,stroke:#4ade80,color:#e6ffe9;

    N["Push notification:<br/>'assessment due in 14 days'"] --> PHONE["Soldier completes DD 2795 / 2796 / 2900<br/>on their phone, in private, days early"]
    PHONE --> SCORE["Submit → red-flag engine runs server-side<br/>auto-scores PHQ-9 / PCL-5, creates flags"]
    SCORE --> QUEUE["Provider queue — red flags surfaced first<br/>review is confirmation, not discovery"]
    QUEUE --> ACT{"Provider acts"}
    ACT -->|Certify| OK["Deployable"]
    ACT -->|Refer| REF["Referred + note (e.g. Behavioral Health)"]
    SCORE --> DASH["Commander dashboard<br/>real-time readiness %, drill-down by unit"]
    OK --> DASH
    REF --> DASH
    DASH --> CHAT["Data chat: 'Why did Bravo drop?'<br/>instant HIPAA-safe summary by category + count"]
    QUEUE --> POL["Provider policy chat: cited DoD-policy answers<br/>no PDF hunting"]

    class N,PHONE,SCORE,QUEUE,OK,REF,DASH,CHAT,POL fix;
```

### Before → After

| Today | With DRP |
|---|---|
| Paper / EDHA form at 0530, no privacy | Phone, in private, days before SRP |
| PHQ-9 / PCL-5 hand-scored, errors | Auto-scored on submit |
| Red flags caught late, in batches | Flags fire the moment the form is submitted |
| Provider certification = discovery | Provider already reviewed → SRP is confirmation |
| Commander calls S1 for a week-old number | Real-time dashboard + drill-down |
| "Why did readiness drop?" = manual digging | Data chat answers in seconds (categories/counts) |
| PDHRA re-contact by phone, poor compliance | Auto push at 90 days; completion tracked as a metric |
| Provider guesses policy / searches PDFs | Policy chat with cited DoDI 6490.03 answers |

---

## What DRP replaces vs. what it doesn't

**Replaces:** paper forms, the EDHA web form, manual batch provider review,
Excel readiness rollups, phone calls for status, manual PDHRA re-contact.

**Does NOT replace:** the dental chair, the immunization station, the physical
exam, the legal briefing, AHLTA-Theater, MHS Genesis. **DRP is the workflow and
visibility layer — not the clinical system.** It's designed to later sync to
MHS Genesis via FHIR (see `DRP_SPEC.md` §6).

---

## Mini-glossary
- **SRP** — Soldier Readiness Processing; the mass pre-deployment processing event.
- **PHA** — Periodic Health Assessment; the annual physical (separate from these forms).
- **PHQ-9 / PCL-5** — depression / PTSD screeners embedded in the forms.
- **EDHA** — the current Navy-hosted web form for these assessments.
- **MHS Genesis** — the DoD's current EHR (Oracle Cerner). **AHLTA-T** = legacy theater EHR.
- **S1 / UDM** — battalion personnel staff / Unit Deployment Manager (do the manual rollups).
- **CUB** — Commander's Update Brief; where readiness gets reported up the chain.

Full glossary: `DRP_SPEC.md` §12.
