// PHQ-9 (depression) and PCL-5 (PTSD) screener reference data + severity banding.
// Bands mirror the backend rule engine thresholds (rules.py) so the provider's
// labels match the red flags the engine fires: PHQ-9 >=10 and PCL-5 >=31 are the
// deployability-blocking cutoffs. Question text lets the detail view render a
// per-item breakdown of what the soldier answered.

import type { Severity } from '../types/drp';

export type ScreenerSeverity = Severity | 'NONE';

export interface ScreenerBand {
  label: string;
  severity: ScreenerSeverity;
}

// PHQ-9: 9 items, 0–3 each, total 0–27. Standard clinical bands.
export function phq9Band(score: number): ScreenerBand {
  if (score >= 20) return { label: 'Severe', severity: 'HIGH' };
  if (score >= 15) return { label: 'Moderately severe', severity: 'HIGH' };
  if (score >= 10) return { label: 'Moderate', severity: 'HIGH' };
  if (score >= 5) return { label: 'Mild', severity: 'LOW' };
  return { label: 'Minimal', severity: 'NONE' };
}

// PCL-5: 20 items, 0–4 each, total 0–80. Provisional PTSD cutoff is 31–33.
export function pcl5Band(score: number): ScreenerBand {
  if (score >= 31) return { label: 'Probable PTSD', severity: 'HIGH' };
  if (score >= 21) return { label: 'Subthreshold', severity: 'LOW' };
  return { label: 'Below threshold', severity: 'NONE' };
}

// 0–3 response scale shared by all PHQ-9 items.
export const PHQ9_OPTIONS = [
  'Not at all',
  'Several days',
  'More than half the days',
  'Nearly every day',
];

// 0–4 response scale shared by all PCL-5 items.
export const PCL5_OPTIONS = [
  'Not at all',
  'A little bit',
  'Moderately',
  'Quite a bit',
  'Extremely',
];

export const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling/staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure',
  'Trouble concentrating on things',
  'Moving/speaking slowly, or being fidgety/restless',
  'Thoughts that you would be better off dead, or of hurting yourself',
];

export const PCL5_QUESTIONS = [
  'Repeated, disturbing memories of the stressful experience',
  'Repeated, disturbing dreams of the stressful experience',
  'Suddenly feeling or acting as if the experience were happening again',
  'Feeling very upset when reminded of the experience',
  'Strong physical reactions when reminded of the experience',
  'Avoiding memories, thoughts, or feelings about the experience',
  'Avoiding external reminders of the experience',
  'Trouble remembering important parts of the experience',
  'Strong negative beliefs about yourself, others, or the world',
  'Blaming yourself or someone else for the experience',
  'Strong negative feelings such as fear, horror, anger, guilt, or shame',
  'Loss of interest in activities you used to enjoy',
  'Feeling distant or cut off from other people',
  'Trouble experiencing positive feelings',
  'Irritable behavior, angry outbursts, or acting aggressively',
  'Taking too many risks or doing things that could cause you harm',
  'Being superalert, watchful, or on guard',
  'Feeling jumpy or easily startled',
  'Having difficulty concentrating',
  'Trouble falling or staying asleep',
];

export interface ScreenerItem {
  index: number; // 1-based question number
  question: string;
  value: number; // raw answer
  option: string; // human label for the answer
}

// Pull the per-question answers for a screener out of the responses blob.
// Returns only the items that were actually answered (key present), so a sparse
// or summary-only assessment renders cleanly instead of as a wall of zeros.
export function screenerItems(
  kind: 'phq9' | 'pcl5',
  responses: Record<string, unknown>,
): ScreenerItem[] {
  const questions = kind === 'phq9' ? PHQ9_QUESTIONS : PCL5_QUESTIONS;
  const options = kind === 'phq9' ? PHQ9_OPTIONS : PCL5_OPTIONS;
  const items: ScreenerItem[] = [];
  questions.forEach((question, i) => {
    const raw = responses[`${kind}_q${i + 1}`];
    if (raw == null) return;
    const value = Number(raw);
    items.push({
      index: i + 1,
      question,
      value,
      option: options[value] ?? String(value),
    });
  });
  return items;
}
