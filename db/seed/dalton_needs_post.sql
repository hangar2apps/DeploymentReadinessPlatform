-- Put SGM Dalton (EDIPI 1000000004) into a "needs POST" state: one completed
-- (certified) PRE and no POST. The app then presents the post-deployment
-- assessment for him to fill out, and the PRE scores below become the baseline
-- for the provider's pre->post comparison.
--   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/dalton_needs_post.sql

BEGIN;

-- Clear any existing assessments so the certified PRE below is his latest.
DELETE FROM red_flags WHERE assessment_id IN (
  SELECT id FROM assessments WHERE service_member_id = '15143ce1-ddd6-4308-ae96-ebcbab16bb20'
);
DELETE FROM assessments WHERE service_member_id = '15143ce1-ddd6-4308-ae96-ebcbab16bb20';

-- Certified PRE baseline (PHQ-9 4 / PCL-5 10).
INSERT INTO assessments
  (service_member_id, type, status, responses, phq9_score, pcl5_score,
   submitted_at, certified_at, certified_by)
VALUES (
  '15143ce1-ddd6-4308-ae96-ebcbab16bb20', 'PRE', 'CERTIFIED',
  '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-01-10"}',
  4, 10,
  '2026-05-10 08:00:00+00', '2026-05-12 10:00:00+00',
  (SELECT id FROM service_members WHERE edipi = '1000000002')   -- CPT Chen (certifier)
);

COMMIT;
