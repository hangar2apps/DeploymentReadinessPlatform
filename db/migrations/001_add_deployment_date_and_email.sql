-- Migration 001: add deployment_date to units, email to service_members
-- Run against Supabase:
--   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/001_add_deployment_date_and_email.sql

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS deployment_date DATE;

ALTER TABLE service_members
  ADD COLUMN IF NOT EXISTS email TEXT;
