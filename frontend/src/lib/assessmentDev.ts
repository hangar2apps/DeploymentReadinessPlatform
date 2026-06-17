// Dev-only response seeders for the assessment flow. Used by the dev panel in
// AssessmentPage (gated behind import.meta.env.DEV) to jump straight to a
// clean / partial / done state instead of clicking through every screen.

import type { AssessmentResponses } from '../types/drp';
import { PHQ9_ITEMS, PCL5_ITEMS } from './questionnaire';

// Fully answered, valid, low-score responses — ready to review and submit.
export function fullResponses(): AssessmentResponses {
  const r: AssessmentResponses = {
    info_confirmed: true,
    medications: '',
    new_medication: false,
    recent_hospitalization: false,
    chronic_conditions: '',
    dental_class: 1,
    last_dental_visit: '2026-02-10',
    immunizations_current: true,
    last_pha_date: '2025-11-01',
    additional_concerns: '',
    pregnancy: false,
    pregnancy_status: 'no',
    attestation: true,
  };
  // Low alternating values; phq9_q9 (self-harm item) lands on 0.
  PHQ9_ITEMS.forEach((_, i) => {
    r[`phq9_q${i + 1}`] = i % 2;
  });
  PCL5_ITEMS.forEach((_, i) => {
    r[`pcl5_q${i + 1}`] = i % 2;
  });
  return r;
}

// First four sections done + first four PHQ-9 items — i.e. mid-questionnaire.
// First incomplete screen is PHQ-9 item 5.
export function partialResponses(): AssessmentResponses {
  const r: AssessmentResponses = {
    info_confirmed: true,
    medications: '',
    new_medication: false,
    recent_hospitalization: false,
    chronic_conditions: '',
    dental_class: 1,
    last_dental_visit: '2026-02-10',
    immunizations_current: true,
    last_pha_date: '2025-11-01',
  };
  for (let i = 0; i < 4; i++) r[`phq9_q${i + 1}`] = 1;
  return r;
}
