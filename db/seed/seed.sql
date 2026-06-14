-- ============================================================================
-- DRP — Static seed data (1-327 IN battalion)
-- ============================================================================
-- Synthetic / fake data only. NO real PHI. Safe to load before the hackathon.
--
-- This file is PURE DATA. It does NOT run the red-flag rule engine — the
-- red_flags rows below are hand-authored to match the rules in
-- CLAUDE_CODE_BUILD.md. Building/running the actual engine is a build-day task.
--
-- Run (one command) against the shared Supabase instance:
--   psql "$SUPABASE_CONNECTION_STRING" -f db/seed/seed.sql
--
-- Re-runnable: truncates the four app tables first. It does NOT touch
-- document_chunks (the RAG embeddings), so your ingested policy docs are safe.
--
-- Readiness target: 90 soldiers, 12 non-deployable => ~87% battalion-wide.
-- Bravo Company is intentionally low (~68%) for the commander drill-down demo.
-- ============================================================================

BEGIN;

TRUNCATE TABLE red_flags, assessments, service_members, units RESTART IDENTITY CASCADE;

-- ----------------------------------------------------------------------------
-- Units — battalion -> companies (self-referencing hierarchy)
-- ----------------------------------------------------------------------------
INSERT INTO units (id, uic, name, short_name, parent_unit_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'WJ5T00', '1st Battalion, 327th Infantry', '1-327 IN', NULL),
  ('00000000-0000-0000-0000-000000000002', 'WJ5THH', 'Headquarters and Headquarters Company', 'HHC',   '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000003', 'WJ5TA0', 'Alpha Company',   'A CO', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'WJ5TB0', 'Bravo Company',   'B CO', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000005', 'WJ5TC0', 'Charlie Company', 'C CO', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000006', 'WJ5TD0', 'Delta Company',   'D CO', '00000000-0000-0000-0000-000000000001');

-- ----------------------------------------------------------------------------
-- Service members — 90 soldiers across 5 companies
--   deployable=false rows carry a category reason: 'Dental' | 'Behavioral
--   Health' | 'Pregnancy'. These mirror the HIGH red_flags authored below.
-- ----------------------------------------------------------------------------
INSERT INTO service_members (edipi, rank, last_name, first_name, middle_initial, mos, unit_id, deployable, deployable_reason)
SELECT v.edipi, v.rank, v.last_name, v.first_name, v.middle_initial, v.mos, u.id, v.deployable, v.deployable_reason
FROM (
  VALUES
  -- HHC (uic WJ5THH) — command, staff, signal, medics, HR. All deployable.
  ('1000000001','LTC','Harris','Robert','J','11A','WJ5THH', true,  NULL),            -- battalion commander
  ('1000000002','CPT','Chen','Michael','A','62B','WJ5THH', true,  NULL),             -- battalion surgeon (provider)
  ('1000000003','MAJ','Whitfield','Anita','R','11A','WJ5THH', true,  NULL),
  ('1000000004','SGM','Dalton','Wayne','E','11Z','WJ5THH', true,  NULL),
  ('1000000005','SFC','Greer','Marcus','L','42A','WJ5THH', true,  NULL),
  ('1000000006','SSG','Nunez','Carla','M','25U','WJ5THH', true,  NULL),
  ('1000000007','SGT','Patel','Anil','K','25U','WJ5THH', true,  NULL),
  ('1000000008','SPC','Okafor','James','O','68W','WJ5THH', true,  NULL),
  ('1000000009','SPC','Lindqvist','Erik','S','42A','WJ5THH', true,  NULL),           -- LOW flag (new med), still deployable
  ('1000000010','PFC','Romero','Diego','A','92G','WJ5THH', true,  NULL),
  ('1000000011','1LT','Brooks','Sandra','P','70B','WJ5THH', true,  NULL),
  ('1000000012','SGT','Avery','Thomas','D','11B','WJ5THH', true,  NULL),
  ('1000000013','SPC','Donovan','Kyle','R','25U','WJ5THH', true,  NULL),
  ('1000000014','PV2','Hassan','Omar','N','92G','WJ5THH', true,  NULL),

  -- Alpha Company (uic WJ5TA0) — 2 non-deployable
  ('2000000001','SPC','Rodriguez','Luis','M','11B','WJ5TA0', true,  NULL),            -- clean / certified (demo)
  ('2000000002','SGT','Coleman','Brianne','T','68W','WJ5TA0', false, 'Dental'),       -- Dental Class 4
  ('2000000003','SPC','Vargas','Maria','E','42A','WJ5TA0', false, 'Pregnancy'),
  ('2000000004','1LT','Bryant','Cole','A','11A','WJ5TA0', true,  NULL),
  ('2000000005','SSG','Schultz','Derek','W','11B','WJ5TA0', true,  NULL),
  ('2000000006','SGT','Iverson','Maya','L','11B','WJ5TA0', true,  NULL),
  ('2000000007','SPC','Mendez','Hector','J','11B','WJ5TA0', true,  NULL),
  ('2000000008','SPC','Walsh','Connor','P','68W','WJ5TA0', true,  NULL),
  ('2000000009','PFC','Tran','Kevin','H','25U','WJ5TA0', true,  NULL),
  ('2000000010','PFC','Abbott','Reese','D','11B','WJ5TA0', true,  NULL),
  ('2000000011','SPC','Devlin','Sean','M','11B','WJ5TA0', true,  NULL),
  ('2000000012','SGT','Ramsey','Tara','N','42A','WJ5TA0', true,  NULL),
  ('2000000013','SPC','Cho','Daniel','Y','25U','WJ5TA0', true,  NULL),
  ('2000000014','PFC','Salazar','Mateo','R','92G','WJ5TA0', true,  NULL),
  ('2000000015','SPC','Pope','Andre','L','11B','WJ5TA0', true,  NULL),
  ('2000000016','PV2','Frye','Jordan','K','11B','WJ5TA0', true,  NULL),
  ('2000000017','SPC','Quinn','Patrick','S','68W','WJ5TA0', true,  NULL),
  ('2000000018','SSG','Hardin','Bryce','T','11Z','WJ5TA0', true,  NULL),
  ('2000000019','SPC','Maddox','Trevor','J','11B','WJ5TA0', true,  NULL),

  -- Bravo Company (uic WJ5TB0) — intentionally low readiness, 6 non-deployable
  ('3000000001','SPC','Bailey','Marcus','T','11B','WJ5TB0', false, 'Behavioral Health'), -- PHQ-9 = 14
  ('3000000002','PFC','Nguyen','Kevin','D','11B','WJ5TB0', false, 'Dental'),
  ('3000000003','SPC','Foster','Aaliyah','J','92G','WJ5TB0', false, 'Dental'),
  ('3000000004','SGT','Mitchell','Dustin','R','11B','WJ5TB0', false, 'Behavioral Health'), -- PCL-5 = 35
  ('3000000005','SPC','Reyes','Daniela','M','42A','WJ5TB0', false, 'Pregnancy'),
  ('3000000006','PFC','Castillo','Hector','L','68W','WJ5TB0', false, 'Dental'),
  ('3000000007','1LT','Dawson','Grant','A','11A','WJ5TB0', true,  NULL),
  ('3000000008','SSG','Pruitt','Lamar','E','11B','WJ5TB0', true,  NULL),
  ('3000000009','SGT','Lockhart','Renee','S','25U','WJ5TB0', true,  NULL),
  ('3000000010','SPC','Espinoza','Julian','A','11B','WJ5TB0', true,  NULL),
  ('3000000011','SPC','Bauer','Heath','M','11B','WJ5TB0', true,  NULL),
  ('3000000012','PFC','Childers','Wyatt','D','92G','WJ5TB0', true,  NULL),
  ('3000000013','SPC','Mayfield','Devin','R','68W','WJ5TB0', true,  NULL),
  ('3000000014','PV2','Hooper','Caleb','J','11B','WJ5TB0', true,  NULL),
  ('3000000015','SGT','Valdez','Sofia','L','42A','WJ5TB0', true,  NULL),
  ('3000000016','SPC','Sherman','Blake','T','11B','WJ5TB0', true,  NULL),
  ('3000000017','PFC','Knox','Tyrese','A','25U','WJ5TB0', true,  NULL),
  ('3000000018','SPC','Rhodes','Garrett','M','11B','WJ5TB0', true,  NULL),
  ('3000000019','SSG','Beasley','Marcus','D','11Z','WJ5TB0', true,  NULL),

  -- Charlie Company (uic WJ5TC0) — 2 non-deployable
  ('4000000001','SPC','Holt','Brandon','K','11B','WJ5TC0', false, 'Behavioral Health'), -- PHQ-9 self-harm
  ('4000000002','SGT','Marsh','Tyler','J','11B','WJ5TC0', false, 'Dental'),
  ('4000000003','SPC','Underwood','Grace','A','25U','WJ5TC0', true,  NULL),            -- MEDIUM (PHA expired)
  ('4000000004','1LT','Carrillo','Ana','M','11A','WJ5TC0', true,  NULL),
  ('4000000005','SPC','Stein','Howard','L','11B','WJ5TC0', true,  NULL),
  ('4000000006','SSG','Lowery','Damon','E','11B','WJ5TC0', true,  NULL),
  ('4000000007','SGT','Bridges','Erica','N','68W','WJ5TC0', true,  NULL),
  ('4000000008','PFC','Pham','Long','T','25U','WJ5TC0', true,  NULL),
  ('4000000009','SPC','Mccall','Devon','R','11B','WJ5TC0', true,  NULL),
  ('4000000010','PFC','Dunlap','Cody','A','11B','WJ5TC0', true,  NULL),
  ('4000000011','SPC','Suarez','Ramon','J','92G','WJ5TC0', true,  NULL),
  ('4000000012','SGT','Ortega','Bianca','M','42A','WJ5TC0', true,  NULL),
  ('4000000013','SPC','Hayden','Logan','D','11B','WJ5TC0', true,  NULL),
  ('4000000014','PV2','Crane','Isaiah','L','11B','WJ5TC0', true,  NULL),
  ('4000000015','SPC','Booker','Marquis','T','68W','WJ5TC0', true,  NULL),
  ('4000000016','PFC','Naylor','Shane','A','11B','WJ5TC0', true,  NULL),
  ('4000000017','SSG','Ferrell','Drew','M','11Z','WJ5TC0', true,  NULL),
  ('4000000018','SPC','Stokes','Vince','R','25U','WJ5TC0', true,  NULL),
  ('4000000019','SGT','Yang','Peter','H','11B','WJ5TC0', true,  NULL),

  -- Delta Company (uic WJ5TD0) — 2 non-deployable
  ('5000000001','SPC','Park','Daniel','S','11B','WJ5TD0', false, 'Dental'),
  ('5000000002','SGT','Boateng','Kwame','A','11B','WJ5TD0', false, 'Behavioral Health'), -- PCL-5 = 33
  ('5000000003','PFC','Sanders','Olivia','R','68W','WJ5TD0', true,  NULL),            -- MEDIUM (immunization gap)
  ('5000000004','1LT','Galloway','Reid','M','11A','WJ5TD0', true,  NULL),
  ('5000000005','SPC','Reece','Jamal','T','11B','WJ5TD0', true,  NULL),
  ('5000000006','SSG','Mccoy','Brett','L','11B','WJ5TD0', true,  NULL),
  ('5000000007','SGT','Tillman','Noah','D','25U','WJ5TD0', true,  NULL),
  ('5000000008','SPC','Burgess','Elliot','J','11B','WJ5TD0', true,  NULL),
  ('5000000009','PFC','Conley','Shaun','A','11B','WJ5TD0', true,  NULL),
  ('5000000010','SPC','Hewitt','Carson','M','92G','WJ5TD0', true,  NULL),
  ('5000000011','SGT','Vance','Lori','E','42A','WJ5TD0', true,  NULL),
  ('5000000012','SPC','Odom','Travis','R','11B','WJ5TD0', true,  NULL),
  ('5000000013','PFC','Shah','Rohan','K','25U','WJ5TD0', true,  NULL),
  ('5000000014','SPC','Leblanc','Andre','J','68W','WJ5TD0', true,  NULL),
  ('5000000015','PV2','Frost','Dylan','L','11B','WJ5TD0', true,  NULL),
  ('5000000016','SPC','Barron','Keith','M','11B','WJ5TD0', true,  NULL),
  ('5000000017','SSG','Cisneros','Hugo','A','11Z','WJ5TD0', true,  NULL),
  ('5000000018','SPC','Mead','Spencer','T','11B','WJ5TD0', true,  NULL),
  ('5000000019','SGT','Whitaker','Lance','D','11B','WJ5TD0', true,  NULL)
) AS v(edipi, rank, last_name, first_name, middle_initial, mos, uic, deployable, deployable_reason)
JOIN units u ON u.uic = v.uic;

-- ----------------------------------------------------------------------------
-- Assessments — ~30 records across types (PRE/POST/PDHRA) and all statuses.
--   service_member_id resolved by EDIPI; certified_by resolved to CPT Chen.
--   Explicit UUIDs so red_flags can reference them below.
-- ----------------------------------------------------------------------------
INSERT INTO assessments (id, service_member_id, type, status, responses, phq9_score, pcl5_score, submitted_at, certified_at, certified_by, referral_type, referral_notes)
SELECT v.id::uuid, sm.id, v.type, v.status, v.responses::jsonb,
       v.phq9_score::int, v.pcl5_score::int,
       v.submitted_at::timestamptz, v.certified_at::timestamptz,
       c.id, v.referral_type, v.referral_notes
FROM (
  VALUES
  -- id, edipi, type, status, responses(json), phq9, pcl5, submitted_at, certified_at, certifier_edipi, referral_type, referral_notes
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001','2000000001','PRE','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-02-10"}',3,6,
    '2026-05-28 08:15:00+00','2026-05-29 14:00:00+00','1000000002',NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002','3000000001','PRE','REFERRED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"phq9_q9":0,"last_pha_date":"2026-01-20"}',14,18,
    '2026-06-02 07:50:00+00',NULL,'1000000002','BEHAVIORAL_HEALTH','PHQ-9 of 14 (moderate). Referred to Behavioral Health; not deployable pending evaluation.'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003','3000000002','PRE','SUBMITTED',
    '{"dental_class":3,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-05"}',2,4,
    '2026-06-05 09:10:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000004','3000000003','PRE','SUBMITTED',
    '{"dental_class":3,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-04-12"}',1,2,
    '2026-06-05 09:25:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000005','3000000004','PRE','UNDER_REVIEW',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"phq9_q9":1,"last_pha_date":"2025-12-01"}',11,35,
    '2026-06-06 10:40:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000006','3000000005','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":true,"new_medication":false,"last_pha_date":"2026-03-18"}',3,5,
    '2026-06-04 11:05:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000007','3000000006','PRE','SUBMITTED',
    '{"dental_class":3,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-02-22"}',4,7,
    '2026-06-07 08:30:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000008','2000000002','PRE','SUBMITTED',
    '{"dental_class":4,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-01-15"}',2,3,
    '2026-06-03 13:20:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000009','2000000003','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":true,"new_medication":false,"last_pha_date":"2026-04-01"}',1,4,
    '2026-06-06 15:45:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000010','4000000001','PRE','UNDER_REVIEW',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"phq9_q9":2,"last_pha_date":"2025-11-20"}',12,22,
    '2026-06-06 09:00:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000011','4000000002','PRE','SUBMITTED',
    '{"dental_class":3,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-30"}',3,6,
    '2026-06-07 10:15:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000012','5000000001','PRE','SUBMITTED',
    '{"dental_class":3,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-02-08"}',2,5,
    '2026-06-08 08:50:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000013','5000000002','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"phq9_q9":0,"last_pha_date":"2026-01-05"}',8,33,
    '2026-06-07 14:30:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000014','4000000003','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2025-04-10"}',3,5,
    '2026-06-05 12:00:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000015','5000000003','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":false,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-12"}',1,3,
    '2026-06-06 16:10:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000016','1000000009','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":true,"last_pha_date":"2026-02-28"}',2,4,
    '2026-06-08 11:30:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000017','1000000008','PRE','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-02-14"}',2,3,
    '2026-05-30 08:00:00+00','2026-05-31 09:30:00+00','1000000002',NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000018','1000000012','PRE','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-01"}',4,8,
    '2026-05-30 08:20:00+00','2026-05-31 09:45:00+00','1000000002',NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000019','1000000007','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-04-05"}',1,2,
    '2026-06-09 07:40:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000020','1000000010','PRE','DRAFT',
    '{}',NULL,NULL,NULL,NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000021','1000000013','PRE','DRAFT',
    '{"dental_class":1,"immunizations_current":true}',NULL,NULL,NULL,NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000022','3000000007','PRE','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-22"}',3,7,
    '2026-05-29 09:00:00+00','2026-05-30 10:00:00+00','1000000002',NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000023','3000000008','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-04-18"}',0,1,
    '2026-06-09 10:25:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000024','2000000004','PRE','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-02-02"}',1,2,
    '2026-05-28 08:45:00+00','2026-05-29 13:15:00+00','1000000002',NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000025','4000000004','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-28"}',2,3,
    '2026-06-09 11:50:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000026','5000000004','PRE','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-04-22"}',1,4,
    '2026-06-09 13:05:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000027','1000000006','POST','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"blast_exposure":false,"last_pha_date":"2026-01-30"}',4,9,
    '2026-05-20 08:00:00+00','2026-05-22 10:30:00+00','1000000002',NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000028','2000000005','POST','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"blast_exposure":false,"last_pha_date":"2026-02-26"}',3,11,
    '2026-06-08 09:35:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000029','2000000006','PDHRA','SUBMITTED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-03-09"}',6,14,
    '2026-06-07 12:45:00+00',NULL,NULL,NULL,NULL),

  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000030','4000000005','PDHRA','CERTIFIED',
    '{"dental_class":1,"immunizations_current":true,"pregnancy":false,"new_medication":false,"last_pha_date":"2026-02-19"}',2,5,
    '2026-05-26 08:10:00+00','2026-05-27 11:00:00+00','1000000002',NULL,NULL)
) AS v(id, edipi, type, status, responses, phq9_score, pcl5_score, submitted_at, certified_at, certifier_edipi, referral_type, referral_notes)
JOIN service_members sm ON sm.edipi = v.edipi
LEFT JOIN service_members c ON c.edipi = v.certifier_edipi;

-- ----------------------------------------------------------------------------
-- Red flags — hand-authored to match the rule set (NOT engine-generated).
--   HIGH severity == non-deployable (already reflected in service_members).
-- ----------------------------------------------------------------------------
INSERT INTO red_flags (assessment_id, type, severity, rule_fired, message)
SELECT v.assessment_id::uuid, v.type, v.severity, v.rule_fired, v.message
FROM (
  VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002','PHQ9_ELEVATED','HIGH','phq9_score >= 10','PHQ-9 score 14 indicates moderate or greater depression'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003','DENTAL_CLASS_3','HIGH','responses.dental_class == 3','Dental Class 3 — non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000004','DENTAL_CLASS_3','HIGH','responses.dental_class == 3','Dental Class 3 — non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000005','PCL5_ELEVATED','HIGH','pcl5_score >= 31','PCL-5 score 35 indicates probable PTSD'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000005','PHQ9_ELEVATED','HIGH','phq9_score >= 10','PHQ-9 score 11 indicates moderate or greater depression'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000006','PREGNANCY','HIGH','responses.pregnancy == true','Pregnancy — automatic non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000007','DENTAL_CLASS_3','HIGH','responses.dental_class == 3','Dental Class 3 — non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000008','DENTAL_CLASS_4','HIGH','responses.dental_class == 4','Dental Class 4 — requires dental exam'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000009','PREGNANCY','HIGH','responses.pregnancy == true','Pregnancy — automatic non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000010','PHQ9_ELEVATED','HIGH','phq9_score >= 10','PHQ-9 score 12 indicates moderate or greater depression'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000010','PHQ9_SELF_HARM','HIGH','responses.phq9_q9 > 0','Positive response to self-harm ideation question'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000011','DENTAL_CLASS_3','HIGH','responses.dental_class == 3','Dental Class 3 — non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000012','DENTAL_CLASS_3','HIGH','responses.dental_class == 3','Dental Class 3 — non-deployable'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000013','PCL5_ELEVATED','HIGH','pcl5_score >= 31','PCL-5 score 33 indicates probable PTSD'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000014','PHA_EXPIRED','MEDIUM','responses.last_pha_date > 12 months ago','PHA expired — last completed 2025-04-10'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000015','IMMUNIZATION_GAP','MEDIUM','responses.immunizations_current == false','Immunization records incomplete or expired'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000016','NEW_MEDICATION','LOW','responses.new_medication == true','New medication started — provider review recommended')
) AS v(assessment_id, type, severity, rule_fired, message);

COMMIT;

-- ============================================================================
-- Quick verification (run manually after load):
--   SELECT u.short_name,
--          count(*) AS assigned,
--          count(*) FILTER (WHERE sm.deployable) AS deployable,
--          round(100.0 * count(*) FILTER (WHERE sm.deployable) / count(*), 1) AS pct
--   FROM service_members sm JOIN units u ON u.id = sm.unit_id
--   GROUP BY u.short_name ORDER BY u.short_name;
-- Expect ~87% battalion-wide; Bravo (B CO) notably low (~68%).
-- ============================================================================
