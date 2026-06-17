import type { AssessmentResponses } from '../../../types/drp';

export const personalDone = (r: AssessmentResponses) => r.info_confirmed === true;

export const medicalDone = (r: AssessmentResponses) =>
  r.new_medication !== undefined &&
  r.recent_hospitalization !== undefined &&
  (r.new_medication !== true ||
    ((r.medications as string)?.trim().length ?? 0) > 0) &&
  (r.recent_hospitalization !== true ||
    ((r.hospitalization_details as string)?.trim().length ?? 0) > 0);

export const dentalDone = (r: AssessmentResponses) => r.dental_class !== undefined;

export const immunizationDone = (r: AssessmentResponses) =>
  r.immunizations_current !== undefined;

// Concerns + pregnancy are voluntary (DD2795 pregnancy item is FEMALES ONLY and
// we hold no sex to gate on) — nothing here blocks advancing.
export const concernsDone = () => true;

export const attestationDone = (r: AssessmentResponses) =>
  r.attestation === true;
