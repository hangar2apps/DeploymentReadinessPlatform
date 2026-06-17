# Derrick — Frontend (Service Member + Provider surfaces)

Read first: `team/TEAM_PLAN.md`. Product context: `DRP_SPEC.md`.
Design direction: `CLAUDE_CODE_BUILD.md` §Design Direction + `drp_mockups.html`.
Form reference PDFs: `frontend/documents/` (DD2795, PHQ-9, PCL-5).

Bryan builds the app shell, routing, role switcher, and shared design-system
components first — build on those.

## Your lanes

### 1. Service Member questionnaire (`/assessment`)
- Landing screen: assessment status (not started / in progress / submitted /
  certified).
- Multi-step form (see `CLAUDE_CODE_BUILD.md` §1 for the 8 steps): personal
  info, medical history, dental self-report, immunization status + **photo
  upload**, PHQ-9, PCL-5, additional concerns/pregnancy/attestation, review.
- **Mobile-first.** One question per screen for PHQ-9 / PCL-5 (privacy, focus).
  Progress bar.
- PHQ-9: 9 questions, 0-3 scale (text in `CLAUDE_CODE_BUILD.md`). PCL-5: 20
  questions, 0-4 scale. Scores are computed server-side on submit — you collect
  answers into `responses` and POST.
- Submit -> `POST /api/assessments` -> status SUBMITTED. Then show "Under
  provider review" / result.

### 2. Provider review queue (`/provider`)
- Sidebar: provider identity + queue counts (My Queue, Red Flagged, Awaiting,
  Referred, Certified 7d). Filter by type (Pre/Post/PDHRA).
- Queue table: member (name/rank/EDIPI), unit, type, **flag badges**
  (severity + reason), submitted (relative), action. Sort red-flags-first.
  Filter chips: ALL / RED FLAG / OVERDUE / NEW.
- Detail view: full responses, auto PHQ-9 + PCL-5 with severity labels, flags
  highlighted, actions: CERTIFY / REFER (type + notes) / NON-DEPLOYABLE.
- **Provider policy-chat panel**: posts to `POST /api/policy-chat`, streams the
  answer (SSE) + shows source citations (doc name, similarity). Placeholder
  examples: "What dental class blocks deployment?", "What PCL-5 score indicates
  probable PTSD?"

## APIs you consume
```
POST  /api/assessments                  submit questionnaire (responses JSONB)
GET   /api/assessments?status=&unit_id= provider queue
GET   /api/assessments/:id              detail
PATCH /api/assessments/:id/certify
PATCH /api/assessments/:id/refer        { referral_type, referral_notes }
POST  /api/policy-chat   { question } -> SSE tokens + sources[]
```

## `responses` JSONB shape (match the rule engine)
Field names the backend rule engine reads — collect exactly these:
`dental_class` (1-4), `immunizations_current` (bool), `pregnancy` (bool),
`new_medication` (bool), `last_pha_date` (YYYY-MM-DD), `phq9_q9` (0-3, the
self-harm item), plus the per-question PHQ-9/PCL-5 answers. See examples in
`db/seed/seed.sql`.

## Gotchas
- Scores (`phq9_score`, `pcl5_score`) are computed server-side — don't trust
  client math; just send the raw answers.
- Demo characters live in seed: SPC Rodriguez (clean), SPC Bailey (PHQ-9 14,
  referred). CPT Chen is the provider.
- Build against the contract; mock responses if an endpoint isn't ready.
