-- Reset SPC Rodriguez (EDIPI 2000000001, the service-member demo login) to a
-- fresh NOT_STARTED state by removing all of his assessments + their red flags.
-- Leaves everyone else untouched. Re-runnable.
--   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/reset_rodriguez.sql

BEGIN;

DELETE FROM red_flags WHERE assessment_id IN (
  SELECT a.id FROM assessments a
  JOIN service_members sm ON sm.id = a.service_member_id
  WHERE sm.edipi = '2000000001'
);

DELETE FROM assessments WHERE service_member_id IN (
  SELECT id FROM service_members WHERE edipi = '2000000001'
);

-- A submitted assessment may have flipped his deployable status — restore the
-- clean default so the fresh soldier reads as deployable again.
UPDATE service_members
SET deployable = true, deployable_reason = NULL
WHERE edipi = '2000000001';

COMMIT;
