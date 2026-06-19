-- Reset SGM Dalton (EDIPI 1000000004, the post-deployment demo login) so the
-- post-deployment flow can be shown again: remove his POST assessment(s) while
-- keeping his certified PRE baseline — so he reads as "needs POST" and the
-- pre->post comparison still has a baseline. Re-runnable.
--   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/reset_dalton.sql

BEGIN;

-- Drop his POST assessment(s) + their red flags (the PRE baseline is kept).
DELETE FROM red_flags WHERE assessment_id IN (
  SELECT a.id FROM assessments a
  JOIN service_members sm ON sm.id = a.service_member_id
  WHERE sm.edipi = '1000000004' AND a.type = 'POST'
);

DELETE FROM assessments WHERE id IN (
  SELECT a.id FROM assessments a
  JOIN service_members sm ON sm.id = a.service_member_id
  WHERE sm.edipi = '1000000004' AND a.type = 'POST'
);

-- A submitted POST / referral may have flipped his deployable status — restore
-- the clean default.
UPDATE service_members
SET deployable = true, deployable_reason = NULL
WHERE edipi = '1000000004';

COMMIT;
