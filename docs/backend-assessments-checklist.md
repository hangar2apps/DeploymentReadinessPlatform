# Backend Assessments — Implementation Checklist

Status as of 2026-06-17. Tracks spec requirements from `team/backend-assessments.md`
against what is implemented in the Flask backend.

---

## Endpoints

- [x] `GET /api/assessments?status=&unit_id=&type=` — list with member + unit join, red flags array
  [`blueprints/assessments.py:35-63`](../backend/blueprints/assessments.py#L35-L63)
- [x] `GET /api/assessments/:id` — detail with member, unit, and flags
  [`blueprints/assessments.py:66-73`](../backend/blueprints/assessments.py#L66-L73)
- [x] `POST /api/assessments` — create/submit → scores + runs rule engine
  [`blueprints/assessments.py:76-123`](../backend/blueprints/assessments.py#L76-L123)
- [ ] `PATCH /api/assessments/:id/certify` → status CERTIFIED, member `deployable=true`
  Route exists at [`blueprints/assessments.py:126-152`](../backend/blueprints/assessments.py#L126-L152), but **missing the guard**: spec requires "sets member `deployable=true` only if no other open HIGH flag remains." The current code unconditionally sets `deployable = true` without checking for other unresolved HIGH flags on the member.
- [x] `PATCH /api/assessments/:id/refer` `{ referral_type, referral_notes }` → REFERRED + non-deployable
  [`blueprints/assessments.py:155-185`](../backend/blueprints/assessments.py#L155-L185)
- [x] `GET /api/service-members?unit_id=&deployable=` — list with unit join, deployable filter
  [`blueprints/service_members.py:16-32`](../backend/blueprints/service_members.py#L16-L32)
- [x] `GET /api/service-members/:id` — detail with assessments array
  [`blueprints/service_members.py:35-45`](../backend/blueprints/service_members.py#L35-L45)

---

## Red-Flag Rule Engine

- [x] Triggered on `POST /api/assessments` (SUBMITTED status only)
  [`blueprints/assessments.py:117-121`](../backend/blueprints/assessments.py#L117-L121)
- [x] Reads `responses` JSONB, computes `phq9_score` and `pcl5_score` server-side
  [`rules.py:15-24`](../backend/rules.py#L15-L24)
- [x] Scores stored on the assessment row
  [`blueprints/assessments.py:98-114`](../backend/blueprints/assessments.py#L98-L114)
- [x] Creates `red_flags` rows
  [`blueprints/assessments.py:188-208`](../backend/blueprints/assessments.py#L188-L208)
- [x] Updates `service_members.deployable` / `deployable_reason`
  [`blueprints/assessments.py:210-215`](../backend/blueprints/assessments.py#L210-L215)
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
- [ ] Spec requires **12 non-deployable soldiers** reproduced — `SEED_CASES` only has 10 entries; 2 cases are missing
- [ ] Spec requires **17 hand-authored `red_flags`** reproduced — total flag count not validated anywhere in the tests

---

## Gotchas from the spec

- [x] Vanilla Postgres / parameterized SQL (no Supabase SDK) — `%s` placeholders used throughout
- [ ] `certify` must check for remaining open HIGH flags before setting `deployable=true` — **not implemented** (see Endpoints section above)
- [ ] Coordinate response shapes with Bryan (contract steward) — out of scope for this checklist

---

## Summary of gaps

| # | Gap | File | Notes |
|---|---|---|---|
| 1 | Certify guard missing | [`blueprints/assessments.py:146-151`](../backend/blueprints/assessments.py#L146-L151) | Must query other unresolved HIGH flags before setting `deployable=true` |
| 2 | 2 seed cases missing | [`tests/test_rules.py:226`](../backend/tests/test_rules.py#L226) | `SEED_CASES` has 10 soldiers; spec requires 12 non-deployable |
| 3 | 17-flag count not validated | [`tests/test_rules.py`](../backend/tests/test_rules.py) | No test verifies total flag count against seeded data |