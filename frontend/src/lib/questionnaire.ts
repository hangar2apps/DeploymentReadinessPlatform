// Questionnaire item banks for the service-member assessment flow.
// Scores are computed server-side on submit (frontend-derrick.md §Gotchas) —
// we only collect raw per-item answers into the `responses` JSONB payload.
//
// PHQ-9 text: CLAUDE_CODE_BUILD.md §1. PCL-5 text: frontend/documents/
// PCL5_Questions_for_PCL-5.pdf (DSM-5 standard, National Center for PTSD).

export interface ScaleOption {
  value: number;
  label: string;
}

// ---- PHQ-9 (depression) — 9 items, 0-3 scale --------------------------------
// Stem: "Over the last 2 weeks, how often have you been bothered by…"

export const PHQ9_PROMPT =
  'Over the last 2 weeks, how often have you been bothered by:';

export const PHQ9_SCALE: ScaleOption[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

export const PHQ9_ITEMS: string[] = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading or watching television',
  'Moving or speaking so slowly that other people could have noticed — or the opposite, being so fidgety or restless that you have been moving a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
];

// Item 9 (index 8) is the self-harm screen the rule engine reads as
// responses.phq9_q9 (see types/drp.ts + backend-assessments.md).
export const PHQ9_SELF_HARM_INDEX = 8;

// ---- PCL-5 (PTSD) — 20 items, 0-4 scale -------------------------------------
// Stem: "In the past month, how much were you bothered by…"

export const PCL5_PROMPT = 'In the past month, how much were you bothered by:';

export const PCL5_SCALE: ScaleOption[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'A little bit' },
  { value: 2, label: 'Moderately' },
  { value: 3, label: 'Quite a bit' },
  { value: 4, label: 'Extremely' },
];

export const PCL5_ITEMS: string[] = [
  'Repeated, disturbing, and unwanted memories of the stressful experience?',
  'Repeated, disturbing dreams of the stressful experience?',
  'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?',
  'Feeling very upset when something reminded you of the stressful experience?',
  'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?',
  'Avoiding memories, thoughts, or feelings related to the stressful experience?',
  'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?',
  'Trouble remembering important parts of the stressful experience?',
  'Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?',
  'Blaming yourself or someone else for the stressful experience or what happened after it?',
  'Having strong negative feelings such as fear, horror, anger, guilt, or shame?',
  'Loss of interest in activities that you used to enjoy?',
  'Feeling distant or cut off from other people?',
  'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?',
  'Irritable behavior, angry outbursts, or acting aggressively?',
  'Taking too many risks or doing things that could cause you harm?',
  'Being "super alert" or watchful or on guard?',
  'Feeling jumpy or easily startled?',
  'Having difficulty concentrating?',
  'Trouble falling or staying asleep?',
];
