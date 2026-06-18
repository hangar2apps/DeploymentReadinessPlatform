-- ============================================================================
-- Migration: columns required by the notification feature (blueprints/notifications.py)
-- ============================================================================
-- The email-notification endpoints reference three columns that the original
-- schema didn't have. Without them, POST /api/assessments/:id/notify-referral
-- 422s ("no email address on record") and the dedup UPDATE would fail.
--
-- Idempotent (IF NOT EXISTS) — safe to run more than once. Adds structure only;
-- demo data (member emails, a battalion deployment_date) is set in seed.sql so
-- it survives reseeds.
--
-- Run once against the shared instance:
--   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/0001_add_notification_columns.sql
-- ============================================================================

-- Member email — recipient for referral / deployment notifications.
ALTER TABLE service_members ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Marks when a referral notification was sent, so a second send is a 409 (dedup).
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS referral_notified_at TIMESTAMPTZ;

-- Unit deployment date — required by POST /api/units/:id/notify-deployment.
ALTER TABLE units ADD COLUMN IF NOT EXISTS deployment_date DATE;
