# Backend — Assessments + Red-Flag Engine

Name: ___________

Read first: `team/TEAM_PLAN.md`. Build details: `CLAUDE_CODE_BUILD.md`.
You build on the Express foundation from `backend-foundation-rag`.

## You own

The core write path: service members submit assessments, the rule engine fires,
deployability updates, providers act on them.

### Endpoints
```
GET   /api/assessments?status=&unit_id=&type=   list (join member + unit + flags[])
GET   /api/assessments/:id                        detail (+ member, flags[])
POST  /api/assessments                            create/submit -> run rule engine
PATCH /api/assessments/:id/certify                -> status CERTIFIED, member deployable=true
PATCH /api/assessments/:id/refer                  { referral_type, referral_notes } -> REFERRED
GET   /api/service-members?unit_id=&deployable=   list
GET   /api/service-members/:id                    detail
```

### Red-flag rule engine (the heart of your work)
Runs on `POST /api/assessments`. Reads `responses` JSONB + computes scores,
creates `red_flags` rows, then updates `service_members.deployable` /
`deployable_reason`. **Any HIGH flag => non-deployable.**

| Rule | Condition | Severity |
|---|---|---|
| PHQ-9 elevated | phq9_score >= 10 | HIGH |
| PHQ-9 mild | 5 <= phq9_score < 10 | LOW |
| PHQ-9 self-harm | responses.phq9_q9 > 0 | HIGH |
| PCL-5 elevated | pcl5_score >= 31 | HIGH |
| Dental Class 3 | responses.dental_class == 3 | HIGH |
| Dental Class 4 | responses.dental_class == 4 | HIGH |
| PHA expired | responses.last_pha_date > 12 mo | MEDIUM |
| Immunization gap | responses.immunizations_current == false | MEDIUM |
| Pregnancy | responses.pregnancy == true | HIGH |
| New medication | responses.new_medication == true | LOW |

Compute `phq9_score` (sum of 9 items, 0-27) and `pcl5_score` (sum of 20 items,
0-80) server-side from the raw answers in `responses`. Store on the assessment.

Structure rules as a list/config so they could be DB-driven later — but
hard-coded is fine for the hackathon.

### Map flags -> deployable_reason category
HIGH dental -> `Dental`; HIGH PHQ-9/PCL-5/self-harm -> `Behavioral Health`;
pregnancy -> `Pregnancy`. These categories drive the commander dashboard.

## Your built-in test fixture
`db/seed/seed.sql` already contains 30 assessments whose `responses` encode
every rule scenario and 17 hand-authored `red_flags`. **Your engine is correct
when, re-run against the seeded `responses`, it reproduces those 17 flags and
the 12 non-deployable soldiers (battalion 86.7%, Bravo 68.4%).** Use it as your
acceptance test.

## Gotchas
- Vanilla Postgres only (portability). Use parameterized SQL — no Supabase SDK.
- `certify` sets member deployable=true only if no other open HIGH flag remains.
- Coordinate response shapes with Bryan (contract steward) before going deep.
