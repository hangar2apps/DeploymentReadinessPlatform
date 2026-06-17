# Backend — Assessments & Red-Flag Engine

Everything the Flask backend owns for the assessments workflow: endpoints, rule
engine, database tables, response shapes, known gaps, and how to verify it works.

---

## What this service owns

The core write path for deployment health:

- Service members submit assessments (PRE/POST/PDHRA questionnaires)
- The rule engine scores them and fires red flags
- Deployability on the `service_members` table gets updated
- Medical providers work a queue: certify or refer each assessment

---

## Running the backend

```sh
cd backend
uv sync                  # first time only — creates .venv from pyproject.toml
uv run python app.py     # -> http://localhost:3000
```

Requires `SUPABASE_CONNECTION_STRING` set in the root `.env` (copy from `.env.example`).

> **IPv4 note:** The default Supabase direct host is IPv6-only. If you get
> `could not translate host name`, switch to the **session pooler** URL from
> Supabase Dashboard → Connect (port 5432, `pooler.supabase.com`).

---

## Endpoints

All owned by `backend/blueprints/assessments.py` and `backend/blueprints/service_members.py`.

### Assessments

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/assessments` | List, filterable by `status`, `unit_id`, `type`. Red-flagged first in results. |
| `GET` | `/api/assessments/:id` | Full detail with red flags. |
| `POST` | `/api/assessments` | Create/submit. Scores responses, runs rule engine, persists flags, updates deployability. |
| `PATCH` | `/api/assessments/:id/certify` | Provider certifies → `CERTIFIED`, member `deployable=true` (if no other open HIGH flags). |
| `PATCH` | `/api/assessments/:id/refer` | Provider refers → `REFERRED`, member `deployable=false` with reason category. |

### Service Members

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/service-members` | List, filterable by `unit_id` and `deployable`. |
| `GET` | `/api/service-members/:id` | Detail with full assessment history. |

---

## Request / response shapes

### POST /api/assessments — request body

```json
{
  "service_member_id": "uuid",
  "type": "PRE | POST | PDHRA",
  "responses": {
    "dental_class": 1,
    "immunizations_current": true,
    "pregnancy": false,
    "new_medication": false,
    "last_pha_date": "2025-01-15",
    "phq9_q1": 1,
    "phq9_q2": 0,
    "...",
    "phq9_q9": 0,
    "pcl5_q1": 2,
    "...",
    "pcl5_q20": 1
  },
  "status": "SUBMITTED"
}
```

`status` defaults to `SUBMITTED`. Pass `DRAFT` to save without triggering the
rule engine.

### GET /api/assessments — response item shape

```json
{
  "id": "uuid",
  "service_member_id": "uuid",
  "type": "PRE",
  "status": "SUBMITTED",
  "responses": { "..." : "..." },
  "phq9_score": 14,
  "pcl5_score": 0,
  "submitted_at": "2026-06-05T09:10:00Z",
  "certified_at": null,
  "certified_by": null,
  "referral_type": null,
  "referral_notes": null,
  "member": {
    "id": "uuid",
    "rank": "SPC",
    "last_name": "Bailey",
    "first_name": "Marcus",
    "edipi": "3000000001"
  },
  "unit": {
    "id": "uuid",
    "short_name": "B CO"
  },
  "flags": [
    {
      "id": "uuid",
      "assessment_id": "uuid",
      "type": "PHQ9_ELEVATED",
      "severity": "HIGH",
      "rule_fired": "phq9_score >= 10",
      "message": "PHQ-9 score 14 indicates moderate or greater depression",
      "resolved_at": null
    }
  ]
}
```

### PATCH /api/assessments/:id/refer — request body

```json
{
  "referral_type": "BEHAVIORAL_HEALTH | DENTAL | MEDICAL | OTHER",
  "referral_notes": "optional free text"
}
```

---

## Database tables

Defined in `CLAUDE_CODE_BUILD.md`. Relevant tables for this slice:

### `assessments`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `service_member_id` | UUID FK → service_members | |
| `type` | VARCHAR | `PRE`, `POST`, `PDHRA` |
| `status` | VARCHAR | `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `CERTIFIED`, `REFERRED` |
| `responses` | JSONB | Raw questionnaire answers — field names drive the rule engine |
| `phq9_score` | INTEGER | Server-computed on submit (sum of `phq9_q1`..`phq9_q9`, 0–27) |
| `pcl5_score` | INTEGER | Server-computed on submit (sum of `pcl5_q1`..`pcl5_q20`, 0–80) |
| `submitted_at` | TIMESTAMPTZ | Set on submit |
| `certified_at` | TIMESTAMPTZ | Set on certify |
| `certified_by` | UUID FK | Provider's `service_member_id` |
| `referral_type` | VARCHAR | e.g., `BEHAVIORAL_HEALTH` |
| `referral_notes` | TEXT | |

### `red_flags`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `assessment_id` | UUID FK → assessments | |
| `type` | VARCHAR | e.g., `PHQ9_ELEVATED`, `DENTAL_CLASS_3` |
| `severity` | VARCHAR | `LOW`, `MEDIUM`, `HIGH` |
| `rule_fired` | VARCHAR | Human-readable condition string |
| `message` | TEXT | Displayed to the provider |
| `resolved_at` | TIMESTAMPTZ | NULL = open flag |

### `service_members` (updated by rule engine)

| Column | Notes |
|---|---|
| `deployable` | Set to `false` when any HIGH flag fires; `true` on certify |
| `deployable_reason` | Category string driving the commander dashboard |

---

## Red-flag rule engine

Lives in `backend/rules.py`. Pure Python — no DB calls. Three functions:

### `score(responses) → (phq9, pcl5)`

Sums `phq9_q1`..`phq9_q9` (0–27) and `pcl5_q1`..`pcl5_q20` (0–80). Missing
items count as 0 so partial drafts still score.

### `evaluate(responses, phq9_score, pcl5_score) → list[flag_dict]`

Applies every rule below. Returns a list of `{ type, severity, rule_fired, message }` dicts ready to insert.

| Flag type | Condition | Severity |
|---|---|---|
| `PHQ9_ELEVATED` | `phq9_score >= 10` | HIGH |
| `PHQ9_MILD` | `5 <= phq9_score < 10` | LOW |
| `PHQ9_SELF_HARM` | `responses.phq9_q9 > 0` | HIGH |
| `PCL5_ELEVATED` | `pcl5_score >= 31` | HIGH |
| `DENTAL_CLASS_3` | `responses.dental_class == 3` | HIGH |
| `DENTAL_CLASS_4` | `responses.dental_class == 4` | HIGH |
| `PHA_EXPIRED` | `responses.last_pha_date` older than 12 months | MEDIUM |
| `IMMUNIZATION_GAP` | `responses.immunizations_current == false` | MEDIUM |
| `PREGNANCY` | `responses.pregnancy == true` | HIGH |
| `NEW_MEDICATION` | `responses.new_medication == true` | LOW |

### `deployability(flags) → (deployable: bool, reason: str | None)`

Collapses flags into the two columns written to `service_members`:

- Any HIGH flag → `deployable=false`
- Reason comes from the first HIGH flag that maps to a category:

| Flag type | `deployable_reason` |
|---|---|
| `PHQ9_ELEVATED`, `PHQ9_SELF_HARM`, `PCL5_ELEVATED` | `Behavioral Health` |
| `DENTAL_CLASS_3`, `DENTAL_CLASS_4` | `Dental` |
| `PREGNANCY` | `Pregnancy` |
| (other HIGH flags) | `Medical` |

---

## File map

```
backend/
├── app.py                  # Flask app factory + blueprint registration
├── config.py               # Loads root .env; exposes DB/OpenAI/port settings
├── db.py                   # psycopg2 connection pool + query/execute helpers
├── rules.py                # PHQ-9/PCL-5 scoring + red-flag rule engine (pure logic)
├── blueprints/
│   ├── assessments.py      # All assessment + certify + refer routes
│   └── service_members.py  # GET list + GET detail routes
```

---

## Known issues / TODO

### Response shape mismatch with frontend (must fix before wiring frontend)

The backend's `_BASE_SELECT` JOIN returns flat columns (`rank`, `last_name`,
`unit_short_name`, etc.), but the frontend contract (`frontend/src/types/drp.ts`)
expects nested `member` and `unit` objects, and uses `flags` not `red_flags`.

A reshape helper is needed in `assessments.py` before calling `jsonify`:

```python
def _shape(row):
    row = dict(row)
    row["member"] = {
        "id":         row.pop("service_member_id"),
        "rank":       row.pop("rank"),
        "last_name":  row.pop("last_name"),
        "first_name": row.pop("first_name"),
        "edipi":      row.pop("edipi"),
    }
    row["unit"] = {
        "id":         row.pop("unit_id"),
        "short_name": row.pop("unit_short_name"),
    }
    row.pop("unit_name", None)
    row.pop("middle_initial", None)
    row["flags"] = row.pop("red_flags", [])
    return row
```

Apply to every row in both `list_assessments` and `get_assessment`.

### Certify doesn't check for other open HIGH flags

`PATCH /api/assessments/:id/certify` currently sets `deployable=true`
unconditionally. Per spec, it should only do so if no other open (unresolved)
HIGH flag exists on the same service member. Fix:

```python
open_highs = db.query_one(
    """SELECT COUNT(*) AS n FROM red_flags rf
       JOIN assessments a ON a.id = rf.assessment_id
       WHERE a.service_member_id = %s
         AND rf.severity = 'HIGH'
         AND rf.resolved_at IS NULL
         AND rf.assessment_id != %s""",
    (row["service_member_id"], str(assessment_id)),
)
if open_highs["n"] == 0:
    db.execute(
        "UPDATE service_members SET deployable = true, deployable_reason = NULL WHERE id = %s",
        (row["service_member_id"],),
        returning=False,
    )
```

---

## Wiring the frontend

Once both issues above are fixed:

1. Create `frontend/.env.local`:
   ```
   VITE_USE_MOCKS=false
   VITE_API_URL=http://localhost:3000
   ```
2. That single flag flips `frontend/src/services/api.ts` from fixture data to
   real HTTP calls — no component changes needed.

---

## Acceptance test

The seed (`db/seed/seed.sql`) contains 30 assessments with hand-authored
responses and 17 matching `red_flags`. The rule engine is correct when, run
against the seeded `responses`, it reproduces:

- **17 red flags** across 30 assessments
- **12 non-deployable soldiers** out of 90
- **Battalion 86.7% deployable** overall
- **Bravo Company 68.4% deployable** (intentionally low for the demo drill-down)

Quick check after startup:

```sh
curl http://localhost:3000/api/readiness | python3 -m json.tool
# Look for: "pct_deployable": ~86.7, "non_deployable_count": 12
```