-- Migration 002: track when a referral notification was last sent per assessment
-- Run against Supabase:
--   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/002_add_referral_notified_at.sql

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS referral_notified_at TIMESTAMPTZ;
