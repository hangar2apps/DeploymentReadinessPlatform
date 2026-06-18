-- =============================================================================
-- DRP Manual SQL Test Queries
-- Run against the Supabase Postgres instance (session-pooler URL).
-- Sections: inspect seed | grab IDs | insert test assessments |
--           insert red flags | certify/refer | cleanup
--
-- Usage:
--   psql "$SUPABASE_CONNECTION_STRING" -f db/test_queries.sql
--   or paste individual blocks into the Supabase SQL editor.
--
-- Replace all <placeholder> values with real UUIDs before running.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — Inspect seed data
-- =============================================================================

-- Count of every core table
SELECT 'service_members' AS tbl, COUNT(*) FROM service_members
UNION ALL SELECT 'assessments',  COUNT(*) FROM assessments
UNION ALL SELECT 'red_flags',    COUNT(*) FROM red_flags
UNION ALL SELECT 'units',        COUNT(*) FROM units;


-- Non-deployable soldiers broken down by reason
SELECT deployable_reason, COUNT(*) AS soldiers
FROM service_members
WHERE deployable = false
GROUP BY deployable_reason
ORDER BY soldiers DESC;


-- Battalion-wide readiness percentage
SELECT
  COUNT(*)                                                              AS total,
  SUM(CASE WHEN deployable THEN 1 ELSE 0 END)                         AS deployable_count,
  ROUND(100.0 * SUM(CASE WHEN deployable THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct_deployable
FROM service_members;


-- Readiness percentage by company
SELECT
  u.short_name,
  COUNT(*)                                                              AS assigned,
  SUM(CASE WHEN sm.deployable THEN 1 ELSE 0 END)                      AS deployable,
  ROUND(100.0 * SUM(CASE WHEN sm.deployable THEN 1 ELSE 0 END) / COUNT(*), 1) AS pct
FROM service_members sm
JOIN units u ON u.id = sm.unit_id
GROUP BY u.short_name
ORDER BY pct;


-- All red flags with assessment + member context
SELECT sm.rank, sm.last_name, rf.type, rf.severity, rf.resolved_at, a.status
FROM red_flags rf
JOIN assessments   a  ON a.id  = rf.assessment_id
JOIN service_members sm ON sm.id = a.service_member_id
ORDER BY rf.severity, sm.last_name;


-- Open (unresolved) HIGH flags only
SELECT sm.rank, sm.last_name, rf.type, a.status
FROM red_flags rf
JOIN assessments   a  ON a.id  = rf.assessment_id
JOIN service_members sm ON sm.id = a.service_member_id
WHERE rf.severity = 'HIGH'
  AND rf.resolved_at IS NULL
ORDER BY sm.last_name;


-- =============================================================================
-- SECTION 2 — Grab IDs to use in test inserts
-- =============================================================================

-- Deployable service members + their unit
SELECT sm.id AS sm_id, sm.rank, sm.last_name, sm.unit_id, u.short_name
FROM service_members sm
JOIN units u ON u.id = sm.unit_id
WHERE sm.deployable = true
LIMIT 5;


-- Non-deployable members (useful for certify tests)
SELECT sm.id AS sm_id, sm.rank, sm.last_name, sm.deployable_reason
FROM service_members sm
WHERE sm.deployable = false
LIMIT 5;


-- SUBMITTED assessments ready to certify or refer
SELECT a.id AS assessment_id, sm.last_name, a.type, a.status
FROM assessments a
JOIN service_members sm ON sm.id = a.service_member_id
WHERE a.status = 'SUBMITTED'
LIMIT 5;


-- =============================================================================
-- SECTION 3 — Insert test assessments (rule engine scenarios)
-- Each INSERT targets a deployable member. The rule engine runs server-side
-- via POST /api/assessments; these inserts bypass it and write directly.
-- Use the API endpoint tests in test_db_integration.py for full end-to-end.
-- =============================================================================

-- PHQ-9 elevated (score 16 — q1-q8 = 2, q9 = 0)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"phq9_q1":2,"phq9_q2":2,"phq9_q3":2,"phq9_q4":2,"phq9_q5":2,"phq9_q6":2,"phq9_q7":2,"phq9_q8":2,"phq9_q9":0}'::jsonb,
  16, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, phq9_score, status;


-- PHQ-9 mild (score 6 — q1+q2 = 3 each, rest 0)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"phq9_q1":3,"phq9_q2":3,"phq9_q3":0,"phq9_q4":0,"phq9_q5":0,"phq9_q6":0,"phq9_q7":0,"phq9_q8":0,"phq9_q9":0}'::jsonb,
  6, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, phq9_score;


-- PHQ-9 self-harm only (q9=2, total=2 — below MILD threshold but still HIGH)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'POST', 'SUBMITTED',
  '{"phq9_q1":0,"phq9_q2":0,"phq9_q3":0,"phq9_q4":0,"phq9_q5":0,"phq9_q6":0,"phq9_q7":0,"phq9_q8":0,"phq9_q9":2}'::jsonb,
  2, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, phq9_score;


-- PCL-5 elevated (score 40 — 20 items x 2)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"pcl5_q1":2,"pcl5_q2":2,"pcl5_q3":2,"pcl5_q4":2,"pcl5_q5":2,"pcl5_q6":2,"pcl5_q7":2,"pcl5_q8":2,"pcl5_q9":2,"pcl5_q10":2,"pcl5_q11":2,"pcl5_q12":2,"pcl5_q13":2,"pcl5_q14":2,"pcl5_q15":2,"pcl5_q16":2,"pcl5_q17":2,"pcl5_q18":2,"pcl5_q19":2,"pcl5_q20":2}'::jsonb,
  0, 40, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, pcl5_score;


-- PCL-5 boundary — score 30 (should NOT fire)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"pcl5_q1":3,"pcl5_q2":3,"pcl5_q3":3,"pcl5_q4":3,"pcl5_q5":3,"pcl5_q6":3,"pcl5_q7":3,"pcl5_q8":3,"pcl5_q9":3,"pcl5_q10":3,"pcl5_q11":0,"pcl5_q12":0,"pcl5_q13":0,"pcl5_q14":0,"pcl5_q15":0,"pcl5_q16":0,"pcl5_q17":0,"pcl5_q18":0,"pcl5_q19":0,"pcl5_q20":0}'::jsonb,
  0, 30, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, pcl5_score;


-- PCL-5 boundary — score 31 (should fire)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"pcl5_q1":3,"pcl5_q2":3,"pcl5_q3":3,"pcl5_q4":3,"pcl5_q5":3,"pcl5_q6":3,"pcl5_q7":3,"pcl5_q8":3,"pcl5_q9":3,"pcl5_q10":3,"pcl5_q11":1,"pcl5_q12":0,"pcl5_q13":0,"pcl5_q14":0,"pcl5_q15":0,"pcl5_q16":0,"pcl5_q17":0,"pcl5_q18":0,"pcl5_q19":0,"pcl5_q20":0}'::jsonb,
  0, 31, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, pcl5_score;


-- Dental Class 3 (HIGH)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED', '{"dental_class":3}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- Dental Class 4 (HIGH)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED', '{"dental_class":4}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- Dental Class 1 — should produce no flag
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED', '{"dental_class":1}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- PHA expired (last visit > 12 months ago)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PDHRA', 'SUBMITTED', '{"last_pha_date":"2024-01-01"}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- PHA current (last visit < 12 months ago — should NOT fire)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PDHRA', 'SUBMITTED', '{"last_pha_date":"2025-12-01"}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- Immunization gap (MEDIUM)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED', '{"immunizations_current":false}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- Pregnancy (HIGH)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED', '{"pregnancy":true}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- New medication (LOW — member stays deployable)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'POST', 'SUBMITTED', '{"new_medication":true}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- Multi-flag — Dental Class 3 + PHQ-9 elevated (Behavioral Health reason wins)
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"dental_class":3,"phq9_q1":2,"phq9_q2":2,"phq9_q3":2,"phq9_q4":2,"phq9_q5":2,"phq9_q6":1,"phq9_q7":1,"phq9_q8":1,"phq9_q9":0}'::jsonb,
  15, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id, phq9_score;


-- Clean assessment — no flags expected
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'PRE', 'SUBMITTED',
  '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2025-12-01"}'::jsonb,
  0, 0, now()
FROM service_members WHERE deployable = true LIMIT 1
RETURNING id;


-- DRAFT — no red flags should be written
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score)
SELECT id, 'PRE', 'DRAFT', '{"dental_class":4}'::jsonb, 0, 0
FROM service_members LIMIT 1
RETURNING id, status;


-- =============================================================================
-- SECTION 4 — Insert red flags manually (certify guard testing)
-- Use this to set up a member with two open HIGH flags, then certify one
-- via the API and confirm the member stays non-deployable.
-- =============================================================================

-- Step 1: create a second assessment for a non-deployable member
INSERT INTO assessments (service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at)
SELECT id, 'POST', 'SUBMITTED', '{"dental_class":4}'::jsonb, 0, 0, now()
FROM service_members WHERE deployable = false LIMIT 1
RETURNING id AS new_assessment_id, service_member_id;


-- Step 2: attach a HIGH red flag to that assessment
-- Replace <new_assessment_id> with the value returned above
INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
VALUES (
  '<new_assessment_id>',
  'DENTAL_CLASS_4', 'HIGH',
  'responses.dental_class == 4',
  'Dental Class 4 — requires dental exam'
)
RETURNING id, type, severity;


-- Verify: member should now have 2 open HIGH flags
-- Replace <sm_id> with the service_member_id from Step 1
SELECT rf.type, rf.severity, rf.resolved_at, a.id AS assessment_id
FROM red_flags rf
JOIN assessments a ON a.id = rf.assessment_id
WHERE a.service_member_id = '<sm_id>'
  AND rf.severity = 'HIGH'
  AND rf.resolved_at IS NULL;


-- =============================================================================
-- SECTION 5 — Certify and refer directly
-- =============================================================================

-- Certify an assessment (sets status + timestamp)
-- Replace <assessment_id>
UPDATE assessments
SET status = 'CERTIFIED', certified_at = now()
WHERE id = '<assessment_id>'
RETURNING id, status, certified_at;


-- Resolve all open flags for an assessment (simulates certify side-effect)
UPDATE red_flags SET resolved_at = now()
WHERE assessment_id = '<assessment_id>'
  AND resolved_at IS NULL
RETURNING id, type, resolved_at;


-- Set member deployable after certify (only run if no other open HIGH flags)
UPDATE service_members
SET deployable = true, deployable_reason = NULL
WHERE id = '<sm_id>'
RETURNING id, deployable, deployable_reason;


-- Refer an assessment
UPDATE assessments
SET status = 'REFERRED',
    referral_type = 'BEHAVIORAL_HEALTH',
    referral_notes = 'PHQ-9 score warrants follow-up'
WHERE id = '<assessment_id>'
RETURNING id, status, referral_type, referral_notes;


-- Set member non-deployable after referral
UPDATE service_members
SET deployable = false, deployable_reason = 'Behavioral Health'
WHERE id = '<sm_id>'
RETURNING id, deployable, deployable_reason;


-- Check remaining open HIGH flags for a member after certifying one assessment
SELECT rf.type, rf.severity, rf.resolved_at, a.id AS assessment_id, a.status
FROM red_flags rf
JOIN assessments a ON a.id = rf.assessment_id
WHERE a.service_member_id = '<sm_id>'
  AND rf.severity = 'HIGH'
  AND rf.resolved_at IS NULL;


-- =============================================================================
-- SECTION 6 — Acceptance / seed validation
-- =============================================================================

-- Confirm spec: >= 12 non-deployable soldiers
SELECT COUNT(*) AS non_deployable_count
FROM service_members
WHERE deployable = false;


-- Confirm spec: >= 17 red flags in DB
SELECT COUNT(*) AS total_red_flags FROM red_flags;


-- Flag distribution by severity
SELECT severity, COUNT(*) AS count
FROM red_flags
GROUP BY severity
ORDER BY CASE severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END;


-- Flag distribution by type
SELECT type, severity, COUNT(*) AS count
FROM red_flags
GROUP BY type, severity
ORDER BY severity, type;


-- =============================================================================
-- SECTION 7 — Cleanup
-- =============================================================================

-- Delete test assessments created in the last hour (cascades to red_flags)
DELETE FROM assessments
WHERE created_at > now() - interval '1 hour'
  AND service_member_id IN (
    SELECT id FROM service_members WHERE deployable = true
  )
RETURNING id, type, status;


-- Reset a specific member back to deployable (undo test side-effects)
-- Replace <sm_id>
UPDATE service_members
SET deployable = true, deployable_reason = NULL
WHERE id = '<sm_id>'
RETURNING id, deployable, deployable_reason;


-- Reset ALL service members to deployable (full seed restore — use with care)
UPDATE service_members SET deployable = true, deployable_reason = NULL;


-- Delete all red_flags created in the last hour
DELETE FROM red_flags
WHERE created_at > now() - interval '1 hour'
RETURNING id, type, severity;


-- Hard reset: delete all non-seed assessments and their flags
-- Safe if your seed was loaded before a known timestamp — adjust as needed
DELETE FROM assessments
WHERE created_at > '2026-06-17 00:00:00+00'
RETURNING id, type, status;


-- =============================================================================
-- SECTION 8 — Toggle deployability via underlying attributes
-- These queries change the actual response data or flag rows that DRIVE
-- deployability — not the deployable column directly.
-- After each change, re-run the rule engine via POST /api/assessments or
-- manually sync the service_members row using the sync queries at the bottom.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 8A — Dental class
-- ---------------------------------------------------------------------------

-- Make a member non-deployable via Dental Class 3
UPDATE assessments
SET responses = jsonb_set(responses, '{dental_class}', '3')
WHERE id = (
    SELECT a.id FROM assessments a
    JOIN service_members sm ON sm.id = a.service_member_id
    WHERE sm.last_name = '<last_name>'
    ORDER BY a.created_at DESC LIMIT 1
)
RETURNING id, responses->>'dental_class' AS dental_class;

-- Make a member deployable by clearing dental issue (Class 1)
UPDATE assessments
SET responses = jsonb_set(responses, '{dental_class}', '1')
WHERE id = (
    SELECT a.id FROM assessments a
    JOIN service_members sm ON sm.id = a.service_member_id
    WHERE sm.last_name = '<last_name>'
    ORDER BY a.created_at DESC LIMIT 1
)
RETURNING id, responses->>'dental_class' AS dental_class;

-- Change dental class on a specific assessment
UPDATE assessments
SET responses = jsonb_set(responses, '{dental_class}', '4')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'dental_class' AS dental_class;


-- ---------------------------------------------------------------------------
-- 8B — PHQ-9
-- ---------------------------------------------------------------------------

-- Set PHQ-9 to elevated (score 18 — all items = 2)
UPDATE assessments
SET responses = responses
    || '{"phq9_q1":2,"phq9_q2":2,"phq9_q3":2,"phq9_q4":2,"phq9_q5":2,"phq9_q6":2,"phq9_q7":2,"phq9_q8":2,"phq9_q9":0}'::jsonb,
    phq9_score = 16
WHERE id = '<assessment_id>'
RETURNING id, phq9_score;

-- Set PHQ-9 to mild (score 6)
UPDATE assessments
SET responses = responses
    || '{"phq9_q1":3,"phq9_q2":3,"phq9_q3":0,"phq9_q4":0,"phq9_q5":0,"phq9_q6":0,"phq9_q7":0,"phq9_q8":0,"phq9_q9":0}'::jsonb,
    phq9_score = 6
WHERE id = '<assessment_id>'
RETURNING id, phq9_score;

-- Clear PHQ-9 (all zeros — no flag)
UPDATE assessments
SET responses = responses
    || '{"phq9_q1":0,"phq9_q2":0,"phq9_q3":0,"phq9_q4":0,"phq9_q5":0,"phq9_q6":0,"phq9_q7":0,"phq9_q8":0,"phq9_q9":0}'::jsonb,
    phq9_score = 0
WHERE id = '<assessment_id>'
RETURNING id, phq9_score;

-- Set self-harm flag only (q9=1, total stays below MILD threshold)
UPDATE assessments
SET responses = jsonb_set(responses, '{phq9_q9}', '1'),
    phq9_score = (phq9_score - (responses->>'phq9_q9')::int + 1)
WHERE id = '<assessment_id>'
RETURNING id, phq9_score, responses->>'phq9_q9' AS q9;

-- Clear self-harm (q9 back to 0)
UPDATE assessments
SET responses = jsonb_set(responses, '{phq9_q9}', '0'),
    phq9_score = (phq9_score - (responses->>'phq9_q9')::int)
WHERE id = '<assessment_id>'
RETURNING id, phq9_score, responses->>'phq9_q9' AS q9;


-- ---------------------------------------------------------------------------
-- 8C — PCL-5
-- ---------------------------------------------------------------------------

-- Set PCL-5 to elevated (score 40 — all 20 items = 2)
UPDATE assessments
SET responses = responses || '{
    "pcl5_q1":2,"pcl5_q2":2,"pcl5_q3":2,"pcl5_q4":2,"pcl5_q5":2,
    "pcl5_q6":2,"pcl5_q7":2,"pcl5_q8":2,"pcl5_q9":2,"pcl5_q10":2,
    "pcl5_q11":2,"pcl5_q12":2,"pcl5_q13":2,"pcl5_q14":2,"pcl5_q15":2,
    "pcl5_q16":2,"pcl5_q17":2,"pcl5_q18":2,"pcl5_q19":2,"pcl5_q20":2
}'::jsonb,
    pcl5_score = 40
WHERE id = '<assessment_id>'
RETURNING id, pcl5_score;

-- Clear PCL-5 (all zeros — no flag)
UPDATE assessments
SET responses = responses || '{
    "pcl5_q1":0,"pcl5_q2":0,"pcl5_q3":0,"pcl5_q4":0,"pcl5_q5":0,
    "pcl5_q6":0,"pcl5_q7":0,"pcl5_q8":0,"pcl5_q9":0,"pcl5_q10":0,
    "pcl5_q11":0,"pcl5_q12":0,"pcl5_q13":0,"pcl5_q14":0,"pcl5_q15":0,
    "pcl5_q16":0,"pcl5_q17":0,"pcl5_q18":0,"pcl5_q19":0,"pcl5_q20":0
}'::jsonb,
    pcl5_score = 0
WHERE id = '<assessment_id>'
RETURNING id, pcl5_score;


-- ---------------------------------------------------------------------------
-- 8D — Pregnancy
-- ---------------------------------------------------------------------------

-- Set pregnancy = true on latest assessment for a member
UPDATE assessments
SET responses = jsonb_set(responses, '{pregnancy}', 'true')
WHERE id = (
    SELECT id FROM assessments
    WHERE service_member_id = '<sm_id>'
    ORDER BY created_at DESC LIMIT 1
)
RETURNING id, responses->>'pregnancy' AS pregnancy;

-- Clear pregnancy
UPDATE assessments
SET responses = jsonb_set(responses, '{pregnancy}', 'false')
WHERE id = (
    SELECT id FROM assessments
    WHERE service_member_id = '<sm_id>'
    ORDER BY created_at DESC LIMIT 1
)
RETURNING id, responses->>'pregnancy' AS pregnancy;


-- ---------------------------------------------------------------------------
-- 8E — PHA date
-- ---------------------------------------------------------------------------

-- Set PHA expired (over 12 months ago)
UPDATE assessments
SET responses = jsonb_set(responses, '{last_pha_date}', '"2024-01-01"')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'last_pha_date' AS last_pha_date;

-- Set PHA current (within 12 months — clears the flag)
UPDATE assessments
SET responses = jsonb_set(responses, '{last_pha_date}', '"2025-12-01"')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'last_pha_date' AS last_pha_date;

-- Remove PHA date entirely (missing key — no flag fires)
UPDATE assessments
SET responses = responses - 'last_pha_date'
WHERE id = '<assessment_id>'
RETURNING id, responses;


-- ---------------------------------------------------------------------------
-- 8F — Immunizations
-- ---------------------------------------------------------------------------

-- Set immunizations not current (triggers IMMUNIZATION_GAP MEDIUM flag)
UPDATE assessments
SET responses = jsonb_set(responses, '{immunizations_current}', 'false')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'immunizations_current' AS immunizations_current;

-- Set immunizations current (clears flag)
UPDATE assessments
SET responses = jsonb_set(responses, '{immunizations_current}', 'true')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'immunizations_current' AS immunizations_current;


-- ---------------------------------------------------------------------------
-- 8G — New medication
-- ---------------------------------------------------------------------------

-- Set new medication = true (LOW flag — member stays deployable)
UPDATE assessments
SET responses = jsonb_set(responses, '{new_medication}', 'true')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'new_medication' AS new_medication;

-- Clear new medication
UPDATE assessments
SET responses = jsonb_set(responses, '{new_medication}', 'false')
WHERE id = '<assessment_id>'
RETURNING id, responses->>'new_medication' AS new_medication;


-- ---------------------------------------------------------------------------
-- 8H — Direct red_flags manipulation
-- Insert, resolve, or delete individual flags without touching the assessment.
-- ---------------------------------------------------------------------------

-- Add a specific HIGH flag to an existing assessment
INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
VALUES (
    '<assessment_id>',
    'DENTAL_CLASS_3', 'HIGH',
    'responses.dental_class == 3',
    'Dental Class 3 — non-deployable'
)
RETURNING id, type, severity;

-- Add a MEDIUM flag
INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
VALUES (
    '<assessment_id>',
    'PHA_EXPIRED', 'MEDIUM',
    'responses.last_pha_date > 12 months ago',
    'PHA expired'
)
RETURNING id, type, severity;

-- Add a LOW flag
INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
VALUES (
    '<assessment_id>',
    'NEW_MEDICATION', 'LOW',
    'responses.new_medication == true',
    'New medication started — provider review recommended'
)
RETURNING id, type, severity;

-- Resolve a specific flag by type on an assessment (simulates provider clearing it)
UPDATE red_flags
SET resolved_at = now()
WHERE assessment_id = '<assessment_id>'
  AND type = 'DENTAL_CLASS_3'
  AND resolved_at IS NULL
RETURNING id, type, resolved_at;

-- Resolve all flags for an assessment
UPDATE red_flags
SET resolved_at = now()
WHERE assessment_id = '<assessment_id>'
  AND resolved_at IS NULL
RETURNING id, type, severity, resolved_at;

-- Re-open a resolved flag (set resolved_at back to NULL)
UPDATE red_flags
SET resolved_at = NULL
WHERE assessment_id = '<assessment_id>'
  AND type = 'DENTAL_CLASS_3'
RETURNING id, type, resolved_at;

-- Delete a specific flag entirely
DELETE FROM red_flags
WHERE assessment_id = '<assessment_id>'
  AND type = '<flag_type>'
RETURNING id, type, severity;


-- ---------------------------------------------------------------------------
-- 8I — Sync service_members deployable after attribute changes
-- Run after any Section 8A-8H change to keep the SM row consistent.
-- The rule engine does this automatically on submit; these are manual equivalents.
-- ---------------------------------------------------------------------------

-- Mark member non-deployable with a specific reason
UPDATE service_members
SET deployable = false,
    deployable_reason = 'Dental'  -- or 'Behavioral Health', 'Pregnancy', 'Medical'
WHERE id = '<sm_id>'
RETURNING id, deployable, deployable_reason;

-- Mark member deployable (only use after confirming no open HIGH flags remain)
UPDATE service_members
SET deployable = true, deployable_reason = NULL
WHERE id = '<sm_id>'
  AND NOT EXISTS (
    SELECT 1 FROM red_flags rf
    JOIN assessments a ON a.id = rf.assessment_id
    WHERE a.service_member_id = '<sm_id>'
      AND rf.severity = 'HIGH'
      AND rf.resolved_at IS NULL
  )
RETURNING id, deployable, deployable_reason;

-- Check what's driving a member's non-deployable status before changing it
SELECT rf.type, rf.severity, rf.resolved_at,
       a.id AS assessment_id, a.status, a.type AS assessment_type
FROM red_flags rf
JOIN assessments a ON a.id = rf.assessment_id
WHERE a.service_member_id = '<sm_id>'
  AND rf.resolved_at IS NULL
ORDER BY rf.severity, rf.created_at;