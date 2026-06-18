-- ============================================================================
-- DRP — POST-deployment assessment seed (Issue 3)
-- ============================================================================
-- Adds realistic POST (DD 2796) assessments so the provider queue and commander
-- dashboard have post-deployment data to work with. Synthetic data only — NO
-- real PHI.
--
-- Run AFTER the base seed (it depends on the units + service members it loads):
--   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/seed.sql
--   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/seed_post.sql
--
-- Re-runnable on its own: it removes the POST rows it owns first (the
-- 'bbbbbbbb-…' assessment ids + their red flags) and upserts the three new
-- soldiers by EDIPI. It does NOT truncate, so the base PRE/PDHRA seed is safe.
--
-- Like seed.sql, the red_flags below are HAND-AUTHORED to match the rule engine
-- (backend/rules.py) — this file is pure data and never runs the engine. The
-- POST-only narrative fields (blast_exposure, tbi_symptoms, wounded, …) are
-- display flavor; the engine only reads phq9/pcl5 scores + the PRE-style keys,
-- so the flags produced are exactly the depression/PTSD ones below.
--
-- ----------------------------------------------------------------------------
-- Roster reconciliation vs. the ticket (mapped to the real seed.sql):
--   * SPC Rodriguez  -> EDIPI 2000000001 (A CO)   — existing
--   * SPC Bailey     -> EDIPI 3000000001 (B CO)   — existing
--   * PFC Nguyen     -> EDIPI 3000000002 (B CO)   — existing (ticket said
--                       "Alpha Co"; he is actually Bravo Co — kept his real unit)
--   * SGT Okonkwo    -> EDIPI 6000000001 (B CO)   — NEW (not in base seed)
--   * SPC Williams   -> EDIPI 6000000002 (A CO)   — NEW
--   * SSG Harrington -> EDIPI 6000000003 (B CO)   — NEW
--
-- Readiness impact of the three new soldiers (was 90 assigned / 78 deployable
-- ≈ 86.7%): now 93 / 80 ≈ 86.0%; A CO 20/18 (90.0%); B CO 21/14 (66.7%). The
-- "Bravo is the outlier" demo story still holds. Remap the new soldiers onto
-- existing deployable members instead if you want the exact original numbers.
-- ============================================================================

BEGIN;

-- ---- Idempotency: drop the POST rows this script owns ----------------------
-- red_flags has no ON DELETE CASCADE, so clear the children first.
DELETE FROM red_flags  WHERE assessment_id::text LIKE 'bbbbbbbb-%';
DELETE FROM assessments WHERE id::text          LIKE 'bbbbbbbb-%';

-- ---- New service members (the three not present in the base seed) ----------
-- deployable reflects their POST flags: Okonkwo (PHQ-9 11 -> HIGH) is
-- non-deployable; Williams and Harrington have no HIGH flag, so deployable.
INSERT INTO service_members (edipi, rank, last_name, first_name, middle_initial, mos, unit_id, deployable, deployable_reason)
SELECT v.edipi, v.rank, v.last_name, v.first_name, v.middle_initial, v.mos, u.id, v.deployable, v.deployable_reason
FROM (
  VALUES
  ('6000000001','SGT','Okonkwo','David','C','11B','WJ5TB0', false, 'Behavioral Health'), -- POST PHQ-9 = 11
  ('6000000002','SPC','Williams','Jordan','R','11B','WJ5TA0', true,  NULL),              -- clean return
  ('6000000003','SSG','Harrington','Paul','M','11B','WJ5TB0', true,  NULL)               -- TBI screen +, no HIGH flag
) AS v(edipi, rank, last_name, first_name, middle_initial, mos, uic, deployable, deployable_reason)
JOIN units u ON u.uic = v.uic
ON CONFLICT (edipi) DO UPDATE
  SET deployable        = EXCLUDED.deployable,
      deployable_reason = EXCLUDED.deployable_reason;

-- ---- POST assessments ------------------------------------------------------
--   service_member_id resolved by EDIPI; certified_by resolved to CPT Chen.
--   Explicit 'bbbbbbbb-…' UUIDs so the red_flags below can reference them.
INSERT INTO assessments (id, service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at, certified_at, certified_by, referral_type, referral_notes)
SELECT v.id::uuid, sm.id, v.type, v.status, v.responses::jsonb,
       v.phq9_score::int, v.pcl5_score::int,
       v.submitted_at::timestamptz, v.certified_at::timestamptz,
       c.id, v.referral_type, v.referral_notes
FROM (
  VALUES
  -- 1. SPC Rodriguez (A CO) — CERTIFIED, clean return (happy path).
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000001','2000000001','POST','CERTIFIED',
    '{"blast_exposure":false,"witnessed_death":false,"new_medication":false,"phq9_q9":0,"environmental_exposure":"none","last_pha_date":"2026-05-20"}',2,6,
    '2026-06-10 08:00:00+00','2026-06-11 10:30:00+00','1000000002',NULL,NULL),

  -- 2. SPC Bailey (B CO) — SUBMITTED, significant deterioration (key demo case).
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002','3000000001','POST','SUBMITTED',
    '{"blast_exposure":true,"blast_events":2,"witnessed_death":true,"new_medication":false,"phq9_q9":0,"last_pha_date":"2026-05-15"}',18,38,
    '2026-06-12 07:45:00+00',NULL,NULL,NULL,NULL),

  -- 3. SGT Okonkwo (B CO) — UNDER_REVIEW, TBI symptoms + burn-pit exposure.
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003','6000000001','POST','UNDER_REVIEW',
    '{"blast_exposure":true,"blast_events":1,"tbi_symptoms":["headaches","memory_problems"],"environmental_exposure":"burn_pit","new_medication":false,"phq9_q9":0,"last_pha_date":"2026-05-18"}',11,29,
    '2026-06-11 09:20:00+00',NULL,NULL,NULL,NULL),

  -- 4. SPC Williams (A CO) — CERTIFIED, minor environmental exposure, deployable.
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000004','6000000002','POST','CERTIFIED',
    '{"blast_exposure":false,"environmental_exposure":"minor_dust","new_medication":false,"phq9_q9":0,"last_pha_date":"2026-05-19"}',3,12,
    '2026-06-10 08:30:00+00','2026-06-11 11:00:00+00','1000000002',NULL,NULL),

  -- 5. PFC Nguyen (B CO) — REFERRED to behavioral health (PCL-5 35).
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005','3000000002','POST','REFERRED',
    '{"blast_exposure":true,"blast_events":1,"new_medication":false,"phq9_q9":0,"last_pha_date":"2026-05-16"}',8,35,
    '2026-06-09 10:15:00+00',NULL,'1000000002','BEHAVIORAL_HEALTH','PCL-5 of 35 (probable PTSD) following blast exposure. Referred to Behavioral Health.'),

  -- 6. SSG Harrington (B CO) — SUBMITTED, wounded (minor shrapnel), TBI screen +.
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000006','6000000003','POST','SUBMITTED',
    '{"blast_exposure":true,"blast_events":1,"wounded":true,"wound_detail":"shrapnel, minor","tinnitus":true,"tbi_screen_positive":true,"new_medication":false,"phq9_q9":0,"last_pha_date":"2026-05-17"}',6,22,
    '2026-06-12 11:10:00+00',NULL,NULL,NULL,NULL)
) AS v(id, edipi, type, status, responses, phq9_score, pcl5_score, submitted_at, certified_at, certifier_edipi, referral_type, referral_notes)
JOIN service_members sm ON sm.edipi = v.edipi
LEFT JOIN service_members c ON c.edipi = v.certifier_edipi;

-- ---- Red flags (hand-authored to match backend/rules.py) -------------------
--   PHQ-9 >= 10 -> HIGH (PHQ9_ELEVATED); 5–9 -> LOW (PHQ9_MILD).
--   PCL-5 >= 31 -> HIGH (PCL5_ELEVATED). HIGH == non-deployable.
INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
SELECT v.assessment_id::uuid, v.type, v.severity, v.rule_fired, v.message
FROM (
  VALUES
  -- Bailey: PHQ-9 18 + PCL-5 38 -> two HIGH flags.
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002','PHQ9_ELEVATED','HIGH','phq9_score >= 10','PHQ-9 score 18 indicates moderate or greater depression'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000002','PCL5_ELEVATED','HIGH','pcl5_score >= 31','PCL-5 score 38 indicates probable PTSD'),
  -- Okonkwo: PHQ-9 11 -> HIGH (PCL-5 29 is below the 31 threshold, no flag).
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000003','PHQ9_ELEVATED','HIGH','phq9_score >= 10','PHQ-9 score 11 indicates moderate or greater depression'),
  -- Nguyen: PCL-5 35 -> HIGH; PHQ-9 8 -> LOW (mild).
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005','PCL5_ELEVATED','HIGH','pcl5_score >= 31','PCL-5 score 35 indicates probable PTSD'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000005','PHQ9_MILD','LOW','phq9_score >= 5 AND < 10','PHQ-9 score 8 indicates mild depression'),
  -- Harrington: PHQ-9 6 -> LOW (mild). No deployability impact.
  ('bbbbbbbb-bbbb-bbbb-bbbb-000000000006','PHQ9_MILD','LOW','phq9_score >= 5 AND < 10','PHQ-9 score 6 indicates mild depression')
) AS v(assessment_id, type, severity, rule_fired, message);

COMMIT;

-- ============================================================================
-- Quick verification (run manually after load):
--
--   -- POST assessments now in the queue, newest first:
--   SELECT a.status, sm.rank, sm.last_name, u.short_name, a.phq9_score, a.pcl5_score
--   FROM assessments a
--   JOIN service_members sm ON sm.id = a.service_member_id
--   JOIN units u ON u.id = sm.unit_id
--   WHERE a.type = 'POST'
--   ORDER BY a.submitted_at DESC NULLS LAST;
--
--   -- Red flags generated for the POST assessments:
--   SELECT sm.last_name, rf.type, rf.severity
--   FROM red_flags rf
--   JOIN assessments a ON a.id = rf.assessment_id
--   JOIN service_members sm ON sm.id = a.service_member_id
--   WHERE a.type = 'POST'
--   ORDER BY sm.last_name;
--
--   -- Battalion readiness reflects PRE + POST:
--   SELECT u.short_name,
--          count(*) AS assigned,
--          count(*) FILTER (WHERE sm.deployable) AS deployable,
--          round(100.0 * count(*) FILTER (WHERE sm.deployable) / count(*), 1) AS pct
--   FROM service_members sm JOIN units u ON u.id = sm.unit_id
--   GROUP BY u.short_name ORDER BY u.short_name;
-- ============================================================================
