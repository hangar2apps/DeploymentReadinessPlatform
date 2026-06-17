# Testing — Backend Assessments & Red-Flag Engine

How to run and verify the Flask backend for the assessments slice. Covers
environment setup, automated tests (no DB required), and the full curl command
set for live endpoint tests once the DB connection is working.

## Automated tests (run these first)

```sh
cd backend

# Install deps (first time only)
uv sync --dev

# All 75 tests — rule engine + HTTP layer, no DB needed
uv run pytest tests/ -v

# Rule engine only (52 tests)
uv run pytest tests/test_rules.py -v

# HTTP layer only (23 tests)
uv run pytest tests/test_http.py -v
```

**Current status: 75/75 passing.**

| File | What it covers |
|---|---|
| [tests/test_rules.py](../backend/tests/test_rules.py) | `score()`, all 10 flag rules, boundary values, `deployability()` reason mapping, 10 seeded non-deployable scenarios |
| [tests/test_http.py](../backend/tests/test_http.py) | Health endpoint, input validation (400s), all 7 route registrations, rule engine fires on POST |

---

---

## Prerequisites

### 1. Install uv (package manager)

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env    # or restart your shell
```

### 2. Install dependencies

```sh
cd backend
uv sync
```

### 3. Root `.env` — fix the DB connection

The default `SUPABASE_CONNECTION_STRING` in `.env` uses the **direct** Supabase
host (`db.<project>.supabase.co`), which is **IPv6-only**. On most development
machines this fails with:

```
psycopg2.OperationalError: ... No route to host
```

Fix: swap to the **session pooler** (IPv4) from Supabase Dashboard → your
project → Connect → Session pooler:

```
# .env — replace the direct host with the session pooler
SUPABASE_CONNECTION_STRING=postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

> Without this fix, all endpoints that touch the database return a 500 HTML
> error page. The health endpoint and input-validation errors still work.

---

## Starting the backend

```sh
cd backend
uv run python app.py
# -> http://localhost:3000
```

Expected startup output:

```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://127.0.0.1:3000
```

Port 3000 must be free. If not:

```sh
lsof -ti:3000 | xargs kill -9
```

---

## Test tiers

| Tier | Requires DB? | What it covers |
|---|---|---|
| **Tier 1 — Rule engine unit tests** | No | Scoring, flag evaluation, deployability logic |
| **Tier 2 — HTTP input validation** | No | 400 errors, missing fields, bad types |
| **Tier 3 — Live endpoint tests** | Yes (pooler URL) | Full CRUD against real seed data |

---

## Tier 1 — Rule engine unit tests (no DB)

Run directly with `uv run python3 -c "..."` from the `backend/` directory, or
paste into a test file.

### All 10 rule scenarios

```sh
cd backend
uv run python3 - <<'EOF'
import rules

cases = [
    # (label, responses, expected_flag_types, expect_deployable, expected_reason)
    ("PHQ-9 elevated (score 14)",
     {f'phq9_q{i}': 2 for i in range(1,8)} | {'phq9_q8':0,'phq9_q9':0},
     ['PHQ9_ELEVATED'], False, 'Behavioral Health'),

    ("PHQ-9 self-harm (q9 > 0)",
     {f'phq9_q{i}': 1 for i in range(1,10)} | {'phq9_q9':2},
     ['PHQ9_ELEVATED','PHQ9_SELF_HARM'], False, 'Behavioral Health'),

    ("PCL-5 elevated (score 40)",
     {f'pcl5_q{i}': 2 for i in range(1,21)},
     ['PCL5_ELEVATED'], False, 'Behavioral Health'),

    ("Dental Class 3",
     {'dental_class': 3},
     ['DENTAL_CLASS_3'], False, 'Dental'),

    ("Dental Class 4",
     {'dental_class': 4},
     ['DENTAL_CLASS_4'], False, 'Dental'),

    ("Pregnancy",
     {'pregnancy': True},
     ['PREGNANCY'], False, 'Pregnancy'),

    ("PHA expired — MEDIUM only, still deployable",
     {'last_pha_date': '2024-01-01'},
     ['PHA_EXPIRED'], True, None),

    ("Immunization gap — MEDIUM only, still deployable",
     {'immunizations_current': False},
     ['IMMUNIZATION_GAP'], True, None),

    ("New medication — LOW only, still deployable",
     {'new_medication': True},
     ['NEW_MEDICATION'], True, None),

    ("PHQ-9 mild (score 6) — LOW only, still deployable",
     {f'phq9_q{i}': 1 for i in range(1,7)} | {f'phq9_q{i}': 0 for i in range(7,10)},
     ['PHQ9_MILD'], True, None),

    ("Clean assessment — no flags",
     {'dental_class':1,'immunizations_current':True,'pregnancy':False,'new_medication':False,'last_pha_date':'2025-12-01'},
     [], True, None),

    ("Multi-flag — Dental + PHQ-9 elevated; Behavioral Health wins reason",
     {'dental_class':3} | {f'phq9_q{i}': 2 for i in range(1,10)},
     ['PHQ9_ELEVATED','DENTAL_CLASS_3'], False, 'Behavioral Health'),
]

passed = 0
for label, responses, expected_types, expect_deployable, expected_reason in cases:
    phq9, pcl5 = rules.score(responses)
    flags = rules.evaluate(responses, phq9, pcl5)
    flag_types = [f['type'] for f in flags]
    deployable, reason = rules.deployability(flags)

    missing = [t for t in expected_types if t not in flag_types]
    ok = not missing and deployable == expect_deployable and reason == expected_reason
    print(f"{'PASS' if ok else 'FAIL'}: {label}")
    if not ok:
        if missing:            print(f"  Missing flags:  {missing}")
        if deployable != expect_deployable: print(f"  deployable:    expected={expect_deployable} got={deployable}")
        if reason != expected_reason:       print(f"  reason:        expected={expected_reason} got={reason}")
    passed += ok

print(f"\n{passed}/{len(cases)} passed")
EOF
```

Expected output: `12/12 passed`

### Boundary tests

```sh
cd backend
uv run python3 - <<'EOF'
import rules

# PCL-5 boundary: 30 should NOT fire, 31 SHOULD fire
r30 = {f'pcl5_q{i}': 3 for i in range(1,11)} | {f'pcl5_q{i}': 0 for i in range(11,21)}
_, pcl5 = rules.score(r30)
assert pcl5 == 30
assert all(f['type'] != 'PCL5_ELEVATED' for f in rules.evaluate(r30, 0, 30)), "PCL5=30 must NOT fire"

r31 = dict(r30) | {'pcl5_q11': 1}
_, pcl5 = rules.score(r31)
assert pcl5 == 31
assert any(f['type'] == 'PCL5_ELEVATED' for f in rules.evaluate(r31, 0, 31)), "PCL5=31 must fire"

# PHQ-9 self-harm fires independently of the total score
r_sh_only = {f'phq9_q{i}': 0 for i in range(1,10)} | {'phq9_q9': 1}
phq9, _ = rules.score(r_sh_only)
assert phq9 == 1  # not enough to fire PHQ9_ELEVATED or PHQ9_MILD
flags = rules.evaluate(r_sh_only, phq9, 0)
types = [f['type'] for f in flags]
assert 'PHQ9_SELF_HARM' in types and 'PHQ9_MILD' not in types and 'PHQ9_ELEVATED' not in types

# Empty responses score 0/0 and fire no flags
phq9, pcl5 = rules.score({})
assert phq9 == 0 and pcl5 == 0
assert rules.evaluate({}, 0, 0) == []

print("All boundary tests PASSED")
EOF
```

---

## Tier 2 — HTTP input validation (no DB)

These tests work before the DB connection is fixed.

```sh
# Health check
curl -s http://localhost:3000/api/health
# Expected: {"service":"drp-backend","status":"ok"}

# POST /api/assessments — missing service_member_id
curl -s -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d '{"type":"PRE","responses":{}}'
# Expected: {"error":"service_member_id and a valid type are required"}  HTTP 400

# POST /api/assessments — invalid type
curl -s -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d '{"service_member_id":"uuid","type":"INVALID"}'
# Expected: {"error":"service_member_id and a valid type are required"}  HTTP 400

# PATCH certify — valid UUID route, no DB yet (will fail at DB layer but proves routing)
curl -s -X PATCH http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000001/certify \
  -H "Content-Type: application/json" -d '{}'

# PATCH refer — missing referral_type (caught before DB)
curl -s -X PATCH http://localhost:3000/api/assessments/00000000-0000-0000-0000-000000000001/refer \
  -H "Content-Type: application/json" -d '{}'
# Expected: {"error":"referral_type is required"}  HTTP 400
```

---

## Tier 3 — Live endpoint tests (requires DB connection)

Run after fixing the pooler URL in `.env`. The seed must already be loaded:

```sh
psql "$SUPABASE_CONNECTION_STRING" -f db/seed/seed.sql
```

### Service members

```sh
# List all
curl -s "http://localhost:3000/api/service-members" | python3 -m json.tool | head -40
# Expected: array of 90 soldiers

# Filter by unit — Bravo Company (unit 4)
curl -s "http://localhost:3000/api/service-members?unit_id=00000000-0000-0000-0000-000000000004"
# Expected: 19 Bravo soldiers

# Filter non-deployable
curl -s "http://localhost:3000/api/service-members?deployable=false"
# Expected: 12 soldiers with non-null deployable_reason

# Detail — includes assessment history
curl -s "http://localhost:3000/api/service-members/<uuid>" | python3 -m json.tool
# Expected: single member with "assessments": [...]
```

### Assessments — read paths

```sh
# List all — red-flagged first
curl -s "http://localhost:3000/api/assessments" | python3 -m json.tool | head -60

# Filter by status
curl -s "http://localhost:3000/api/assessments?status=SUBMITTED"

# Filter by unit (Bravo) + type
curl -s "http://localhost:3000/api/assessments?unit_id=00000000-0000-0000-0000-000000000004&type=PRE"

# Detail
curl -s "http://localhost:3000/api/assessments/<uuid>" | python3 -m json.tool
```

What to verify in the response shape:
- `member` is a nested object (`{ id, rank, last_name, first_name, edipi }`)
- `unit` is a nested object (`{ id, short_name }`)
- `flags` key (not `red_flags`)

> **Note:** Until the response reshape fix is applied (see
> `docs/backend-assessments.md` → Known Issues), the backend returns flat JOIN
> columns instead of nested `member`/`unit` objects and uses `red_flags` instead
> of `flags`. The response is otherwise correct.

### Assessments — submit with rule engine

```sh
# Get a real service_member_id first
SM_ID=$(curl -s "http://localhost:3000/api/service-members" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# Submit a PRE assessment with a HIGH flag (Dental Class 3)
curl -s -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d "{
    \"service_member_id\": \"$SM_ID\",
    \"type\": \"PRE\",
    \"status\": \"SUBMITTED\",
    \"responses\": {
      \"dental_class\": 3,
      \"immunizations_current\": true,
      \"pregnancy\": false
    }
  }" | python3 -m json.tool
# Expected: assessment with red_flags containing DENTAL_CLASS_3 (HIGH)
# Also check: service member's deployable=false, deployable_reason=Dental

# Submit with PHQ-9 self-harm + elevated score
curl -s -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d "{
    \"service_member_id\": \"$SM_ID\",
    \"type\": \"POST\",
    \"status\": \"SUBMITTED\",
    \"responses\": {
      \"phq9_q1\": 2, \"phq9_q2\": 2, \"phq9_q3\": 2,
      \"phq9_q4\": 2, \"phq9_q5\": 2, \"phq9_q6\": 1,
      \"phq9_q7\": 1, \"phq9_q8\": 1, \"phq9_q9\": 1,
      \"dental_class\": 1
    }
  }" | python3 -m json.tool
# Expected: PHQ9_ELEVATED + PHQ9_SELF_HARM flags, reason=Behavioral Health

# Save as DRAFT (no rule engine runs)
curl -s -X POST http://localhost:3000/api/assessments \
  -H "Content-Type: application/json" \
  -d "{
    \"service_member_id\": \"$SM_ID\",
    \"type\": \"PRE\",
    \"status\": \"DRAFT\",
    \"responses\": {\"dental_class\": 4}
  }" | python3 -m json.tool
# Expected: assessment created, red_flags=[], member deployable unchanged
```

### Assessments — certify and refer

```sh
# Get a SUBMITTED assessment ID
AS_ID=$(curl -s "http://localhost:3000/api/assessments?status=SUBMITTED" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# Certify it
curl -s -X PATCH "http://localhost:3000/api/assessments/$AS_ID/certify" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool
# Expected: status=CERTIFIED, certified_at set
# Also check: if no other open HIGH flags, service member deployable=true

# Refer a different assessment
AS_ID2=$(curl -s "http://localhost:3000/api/assessments?status=SUBMITTED" | \
  python3 -c "import sys,json; data=json.load(sys.stdin); print(data[1]['id'] if len(data)>1 else data[0]['id'])")

curl -s -X PATCH "http://localhost:3000/api/assessments/$AS_ID2/refer" \
  -H "Content-Type: application/json" \
  -d '{
    "referral_type": "BEHAVIORAL_HEALTH",
    "referral_notes": "PHQ-9 score warrants follow-up"
  }' | python3 -m json.tool
# Expected: status=REFERRED, referral_type set, member deployable=false, deployable_reason=BEHAVIORAL_HEALTH
```

### Acceptance test — verify seed numbers

```sh
# Battalion-wide readiness (requires readiness endpoint — backend-readiness-chat lane)
curl -s "http://localhost:3000/api/readiness" | python3 -m json.tool
# Expected: pct_deployable ~86.7, non_deployable_count 12

# Quick count check against DB
curl -s "http://localhost:3000/api/service-members?deployable=false" | \
  python3 -c "import sys,json; data=json.load(sys.stdin); print(f'Non-deployable: {len(data)} (expected 12)')"

# Count open red flags
curl -s "http://localhost:3000/api/assessments" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
flags = [f for a in data for f in a.get('red_flags', a.get('flags', []))]
print(f'Total flags: {len(flags)} (expected 17)')
highs = [f for f in flags if f['severity'] == 'HIGH']
print(f'HIGH flags: {len(highs)}')
"
```

---

## Current test status (as of 2026-06-17)

| Test | Status | Notes |
|---|---|---|
| Health endpoint | ✅ Passing | `{"status":"ok"}` |
| Input validation — POST missing fields | ✅ Passing | Returns 400 + error message |
| Input validation — POST invalid type | ✅ Passing | Returns 400 + error message |
| Input validation — PATCH refer missing type | ✅ Passing | Returns 400 + error message |
| Rule engine — 12 scenario tests | ✅ Passing | All HIGH/LOW/MEDIUM rules fire correctly |
| Rule engine — boundary tests | ✅ Passing | PCL-5 30/31 boundary, self-harm isolation |
| Rule engine — seed scenario validation | ✅ Passing | 10/10 non-deployable soldier scenarios reproduced |
| Live DB endpoints (all) | ❌ Blocked | IPv6 connection fails on this network |

### Blocker: IPv6 / session pooler

All Tier 3 tests are blocked until `SUPABASE_CONNECTION_STRING` in the root
`.env` is updated to the session pooler URL (IPv4). Get it from:
**Supabase Dashboard → your project → Connect → Session pooler**.

Format:
```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

---

## Known issues to fix before Tier 3 tests pass cleanly

See `docs/backend-assessments.md` → Known Issues for the fix code.

1. **Response shape mismatch** — `assessments.py` returns flat JOIN columns;
   frontend expects nested `member` and `unit` objects and key `flags` (not
   `red_flags`). A `_shape()` helper is needed.

2. **Certify doesn't check for remaining HIGH flags** — currently sets
   `deployable=true` unconditionally; should only do so if no other open HIGH
   flag exists for that service member.
