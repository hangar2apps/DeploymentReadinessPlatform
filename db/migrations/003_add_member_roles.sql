-- Migration 003: app authorization roles (multi-role) for service members
-- Run against Supabase:
--   psql "$SUPABASE_CONNECTION_STRING" -f db/migrations/003_add_member_roles.sql
--
-- The DB (roster) is the single source of truth for what a user may DO in DRP; Keycloak only authenticates the person and asserts their EDIPI. A member holds zero or more additive duty-position roles here. The baseline "service_member" role is NOT stored — it is implied by having a service_members row — so this table lists only the privileged appointments.
--
-- unit_id is the command/scope unit for the appointment; NULL means "scope to the member's own unit" (service_members.unit_id). It lets a commander's command unit differ from their assigned unit if that ever matters.

CREATE TABLE IF NOT EXISTS member_roles (
  id                SERIAL PRIMARY KEY,
  service_member_id UUID NOT NULL REFERENCES service_members(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('provider', 'commander')),
  unit_id           UUID REFERENCES units(id) ON DELETE SET NULL,
  UNIQUE (service_member_id, role)
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles (service_member_id);
