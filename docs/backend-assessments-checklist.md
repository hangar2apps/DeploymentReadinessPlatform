# Backend Assessments — Implementation Checklist

Tracks spec requirements from `team/backend-assessments.md` against the Flask backend.
Last updated: 2026-06-17.

---

## Endpoints

- [x] `GET /api/assessments?status=&unit_id=&type=` — list with nested member/unit, flags array
  [`blueprints/assessments.py:69-101`](../backend/blueprints/assessments.py#L69-L101)
- [x] `GET /api/assessments/:id` — detail with nested member/unit, flags array
  [`blueprints/assessments.py:103-115`](../backend/blueprints/assessments.py#L103-L115)
- [x] `POST /api/assessments` — create/submit → scores + runs rule engine
  [`blueprints/assessments.py:116-167`](../backend/blueprints/assessments.py#L116-L167)
- [ ] `PATCH /api/assessments/:id/certify` → status CERTIFIED, member `deployable=true`
  Route exists at [`blueprints/assessments.py:169-198`](../backend/blueprints/assessments.py#L169-L198), but **missing the guard**: spec requires "sets member `deployable=true` only if no other open HIGH flag remains." Currently sets `deployable=true` unconditionally.
- [x] `PATCH /api/assessments/:id/refer` `{ referral_type, referral_notes }` → REFERRED + non-deployable
  [`blueprints/assessments.py:200-233`](../backend/blueprints/assessments.py#L200-L233)
- [x] `GET /api/service-members?unit_id=&deployable=` — list with unit join, deployable filter
  [`blueprints/service_members.py:16-32`](../backend/blueprints/service_members.py#L16-L32)
- [x] `GET /api/service-members/:id` — detail with assessments array
  [`blueprints/service_members.py:35-45`](../backend/blueprints/service_members.py#L35-L45)

---

## Response shape (frontend contract)

- [x] `_shape()` helper — reshapes flat JOIN row into nested `member` / `unit` objects, renames `red_flags` → `flags`
  [`blueprints/assessments.py:34-59`](../backend/blueprints/assessments.py#L34-L59)
- [x] Applied to `GET /api/assessments` list and `GET /api/assessments/:id` detail
- [x] `CreateAssessmentInput` in `frontend/src/types/drp.ts` exposes optional `status` field — Derrick can pass `'DRAFT'` to auto-save without triggering the rule engine
  [`frontend/src/types/drp.ts:155-160`](../frontend/src/types/drp.ts#L155-L160)

---

## Red-Flag Rule Engine

- [x] Triggered on `POST /api/assessments` (SUBMITTED status only)
  [`blueprints/assessments.py:155-158`](../backend/blueprints/assessments.py#L155-L158)
- [x] Reads `responses` JSONB, computes `phq9_score` and `pcl5_score` server-side
  [`rules.py:15-24`](../backend/rules.py#L15-L24)
- [x] Scores stored on the assessment row
  [`blueprints/assessments.py:131-150`](../backend/blueprints/assessments.py#L131-L150)
- [x] Creates `red_flags` rows
  [`blueprints/assessments.py:249-265`](../backend/blueprints/assessments.py#L249-L265)
- [x] Updates `service_members.deployable` / `deployable_reason`
  [`blueprints/assessments.py:267-272`](../backend/blueprints/assessments.py#L267-L272)
- [x] Any HIGH flag → non-deployable
  [`rules.py:142-144`](../backend/rules.py#L142-L144)

### All 10 rules implemented

| Rule | Condition | Severity | Status | Location |
|---|---|---|---|---|
| PHQ-9 elevated | `phq9_score >= 10` | HIGH | ✅ | [`rules.py:57-63`](../backend/rules.py#L57-L63) |
| PHQ-9 mild | `5 <= score < 10` | LOW | ✅ | [`rules.py:64-69`](../backend/rules.py#L64-L69) |
| PHQ-9 self-harm | `phq9_q9 > 0` | HIGH | ✅ | [`rules.py:72-79`](../backend/rules.py#L72-L79) |
| PCL-5 elevated | `pcl5_score >= 31` | HIGH | ✅ | [`rules.py:82-88`](../backend/rules.py#L82-L88) |
| Dental Class 3 | `dental_class == 3` | HIGH | ✅ | [`rules.py:91-94`](../backend/rules.py#L91-L94) |
| Dental Class 4 | `dental_class == 4` | HIGH | ✅ | [`rules.py:95-97`](../backend/rules.py#L95-L97) |
| PHA expired | `last_pha_date > 12 mo` | MEDIUM | ✅ | [`rules.py:100-105`](../backend/rules.py#L100-L105) |
| Immunization gap | `immunizations_current == false` | MEDIUM | ✅ | [`rules.py:107-110`](../backend/rules.py#L107-L110) |
| Pregnancy | `pregnancy == true` | HIGH | ✅ | [`rules.py:112-115`](../backend/rules.py#L112-L115) |
| New medication | `new_medication == true` | LOW | ✅ | [`rules.py:117-120`](../backend/rules.py#L117-L120) |

### Flag → `deployable_reason` mapping

- [x] HIGH dental → `Dental`
  [`rules.py:128-130`](../backend/rules.py#L128-L130)
- [x] HIGH PHQ-9 / PCL-5 / self-harm → `Behavioral Health`
  [`rules.py:127-129`](../backend/rules.py#L127-L129)
- [x] Pregnancy → `Pregnancy`
  [`rules.py:131`](../backend/rules.py#L131)

---

## Acceptance Test (seed fixture)

- [x] Unit test coverage for all 10 rules
  [`tests/test_rules.py`](../backend/tests/test_rules.py)
- [x] 10 seed scenario cases pass (Bailey, Mitchell, Holt, Coleman, Nguyen, Foster, Marsh, Castillo, Vargas, Reyes)
  [`tests/test_rules.py:226-315`](../backend/tests/test_rules.py#L226-L315)
- [ ] Spec requires **12 non-deployable soldiers** reproduced — `SEED_CASES` only has 10 entries; 2 cases are missing from unit tests
- [x] Spec requires **17 hand-authored `red_flags`** reproduced — validated by `TestSeedAcceptance` against live DB
  [`tests/test_db_integration.py`](../backend/tests/test_db_integration.py)

---

## Gotchas from the spec

- [x] Vanilla Postgres / parameterized SQL (no Supabase SDK) — `%s` placeholders used throughout
- [x] `certify` must check for remaining open HIGH flags before setting `deployable=true` — implemented in [`blueprints/assessments.py:190-208`](../backend/blueprints/assessments.py#L190-L208) and tested by `TestCertifyLive`
- [ ] Coordinate response shapes with Bryan (contract steward) — out of scope for this checklist

---

## Test coverage status

Tracks which spec requirements have automated test coverage and at what tier (unit = no DB, integration = live DB).

### Endpoints

| Endpoint | Unit/mock test | DB integration test |
|---|---|---|
| `GET /api/assessments` (list) | ✅ route exists | ✅ list, shape, status/type/unit_id filters |
| `GET /api/assessments/:id` (detail) | ✅ route exists | ✅ 200 + shape, 404 |
| `POST /api/assessments` (create/submit) | ✅ validation, rule engine (mocked) | ✅ all 10 rules, deployability side-effect |
| `PATCH /api/assessments/:id/certify` | ✅ route exists | ✅ status CERTIFIED, certified_at, member deployable=true, guard |
| `PATCH /api/assessments/:id/refer` | ✅ input validation | ✅ status REFERRED, referral_type, member deployable=false |
| `GET /api/service-members` (list) | ✅ route exists | ✅ list, unit_id filter, deployable filter |
| `GET /api/service-members/:id` (detail) | ✅ route exists | ✅ member + assessments array, 404 |

### Red-flag rules

| Rule | Unit test | DB integration |
|---|---|---|
| PHQ-9 elevated ≥ 10 (HIGH) | ✅ | ✅ |
| PHQ-9 mild 5–9 (LOW) | ✅ | ✅ |
| PHQ-9 self-harm q9 > 0 (HIGH) | ✅ | ✅ |
| PCL-5 elevated ≥ 31 (HIGH) | ✅ | ✅ |
| Dental Class 3 (HIGH) | ✅ | ✅ |
| Dental Class 4 (HIGH) | ✅ | ✅ |
| PHA expired > 12 mo (MEDIUM) | ✅ | ✅ |
| Immunization gap (MEDIUM) | ✅ | ✅ |
| Pregnancy (HIGH) | ✅ | ✅ |
| New medication (LOW) | ✅ | ✅ |

### Flag → deployable_reason mapping

| Category | Unit test | DB integration (side-effect on SM row) |
|---|---|---|
| Dental | ✅ | ✅ |
| Behavioral Health | ✅ | ✅ |
| Pregnancy | ✅ | ✅ |

### Certify guard

| Scenario | DB integration |
|---|---|
| No other open HIGH flags → member becomes deployable | ✅ |
| Other open HIGH flag exists → member stays non-deployable | ✅ |

### Seed acceptance

| Criterion | Test |
|---|---|
| ≥ 12 non-deployable soldiers in DB | ✅ `TestSeedAcceptance` |
| ≥ 17 red flags in DB | ✅ `TestSeedAcceptance` |

---

## Remaining gaps

| # | Gap | Notes |
|---|---|---|
| 1 | 2 unit test seed cases missing | `SEED_CASES` has 10; spec says 12 non-deployable soldiers — identify the 2 remaining soldiers and add them |
| 2 | Response shape coordination with Bryan | Out of scope until frontend integration review |