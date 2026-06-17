// Mock data mirroring db/seed/seed.sql. Numbers match the verified seed:
// battalion 86.7% deployable, Bravo 68.4%. Used by services/api.ts in mock mode
// so the UI can be built before the backend endpoints exist. Subsets are fine —
// the readiness rollup carries the real battalion-wide aggregates.

import type {
  AssessmentDetail,
  AssessmentListItem,
  CommanderChatResponse,
  PolicyChatResponse,
  ReadinessRollup,
  RedFlag,
  RedFlagSummaryItem,
  ServiceMember,
  TrendPoint,
  Unit,
} from '../types/drp';

const BN = 'unit-bn';
const HHC = 'unit-hhc';
const A = 'unit-a';
const B = 'unit-b';
const C = 'unit-c';
const D = 'unit-d';

export const units: Unit[] = [
  { id: BN, uic: 'WJ5T00', name: '1st Battalion, 327th Infantry', short_name: '1-327 IN', parent_unit_id: null },
  { id: HHC, uic: 'WJ5THH', name: 'Headquarters and Headquarters Company', short_name: 'HHC', parent_unit_id: BN },
  { id: A, uic: 'WJ5TA0', name: 'Alpha Company', short_name: 'A CO', parent_unit_id: BN },
  { id: B, uic: 'WJ5TB0', name: 'Bravo Company', short_name: 'B CO', parent_unit_id: BN },
  { id: C, uic: 'WJ5TC0', name: 'Charlie Company', short_name: 'C CO', parent_unit_id: BN },
  { id: D, uic: 'WJ5TD0', name: 'Delta Company', short_name: 'D CO', parent_unit_id: BN },
];

// The 12 non-deployable soldiers across the battalion, plus the deployable demo
// characters. Counts per company match battalionReadiness.by_company and the
// category breakdown in redFlagSummary so commander drill-downs are consistent
// in mock mode: A 2, B 6, C 2, D 2 (HHC 0). The real backend returns all 90.
export const serviceMembers: ServiceMember[] = [
  { id: 'sm-harris', edipi: '1000000001', rank: 'LTC', last_name: 'Harris', first_name: 'Robert', middle_initial: 'J', mos: '11A', unit_id: HHC, deployable: true, deployable_reason: null },
  { id: 'sm-chen', edipi: '1000000002', rank: 'CPT', last_name: 'Chen', first_name: 'Michael', middle_initial: 'A', mos: '62B', unit_id: HHC, deployable: true, deployable_reason: null },
  { id: 'sm-rodriguez', edipi: '2000000001', rank: 'SPC', last_name: 'Rodriguez', first_name: 'Luis', middle_initial: 'M', mos: '11B', unit_id: A, deployable: true, deployable_reason: null },
  { id: 'sm-tran', edipi: '2000000004', rank: 'SPC', last_name: 'Tran', first_name: 'Kevin', middle_initial: 'H', mos: '11B', unit_id: A, deployable: true, deployable_reason: null },
  // A CO — 2 non-deployable (1 Dental Class 4, 1 Pregnancy)
  { id: 'sm-coleman', edipi: '2000000002', rank: 'SGT', last_name: 'Coleman', first_name: 'Brianne', middle_initial: 'T', mos: '68W', unit_id: A, deployable: false, deployable_reason: 'Dental' },
  { id: 'sm-okafor', edipi: '2000000003', rank: 'SPC', last_name: 'Okafor', first_name: 'Amara', middle_initial: 'N', mos: '42A', unit_id: A, deployable: false, deployable_reason: 'Pregnancy' },
  // B CO — 6 non-deployable (3 Dental, 2 Behavioral Health, 1 Pregnancy)
  { id: 'sm-bailey', edipi: '3000000001', rank: 'SPC', last_name: 'Bailey', first_name: 'Marcus', middle_initial: 'T', mos: '11B', unit_id: B, deployable: false, deployable_reason: 'Behavioral Health' },
  { id: 'sm-nguyen', edipi: '3000000002', rank: 'PFC', last_name: 'Nguyen', first_name: 'Kevin', middle_initial: 'D', mos: '11B', unit_id: B, deployable: false, deployable_reason: 'Dental' },
  { id: 'sm-fisher', edipi: '3000000003', rank: 'PFC', last_name: 'Fisher', first_name: 'Dylan', middle_initial: 'R', mos: '11B', unit_id: B, deployable: false, deployable_reason: 'Dental' },
  { id: 'sm-grant', edipi: '3000000004', rank: 'SPC', last_name: 'Grant', first_name: 'Tyrell', middle_initial: 'J', mos: '68W', unit_id: B, deployable: false, deployable_reason: 'Dental' },
  { id: 'sm-reyes', edipi: '3000000005', rank: 'SPC', last_name: 'Reyes', first_name: 'Daniela', middle_initial: 'M', mos: '42A', unit_id: B, deployable: false, deployable_reason: 'Pregnancy' },
  { id: 'sm-mendez', edipi: '3000000006', rank: 'SGT', last_name: 'Mendez', first_name: 'Hector', middle_initial: 'L', mos: '11B', unit_id: B, deployable: false, deployable_reason: 'Behavioral Health' },
  // C CO — 2 non-deployable (1 Behavioral Health, 1 Dental)
  { id: 'sm-holt', edipi: '4000000001', rank: 'SPC', last_name: 'Holt', first_name: 'Brandon', middle_initial: 'K', mos: '11B', unit_id: C, deployable: false, deployable_reason: 'Behavioral Health' },
  { id: 'sm-park', edipi: '4000000002', rank: 'SPC', last_name: 'Park', first_name: 'Jin', middle_initial: 'S', mos: '25U', unit_id: C, deployable: false, deployable_reason: 'Dental' },
  // D CO — 2 non-deployable (1 Dental, 1 Behavioral Health)
  { id: 'sm-walsh', edipi: '5000000001', rank: 'PFC', last_name: 'Walsh', first_name: 'Connor', middle_initial: 'M', mos: '11B', unit_id: D, deployable: false, deployable_reason: 'Dental' },
  { id: 'sm-dixon', edipi: '5000000002', rank: 'SPC', last_name: 'Dixon', first_name: 'Andre', middle_initial: 'A', mos: '92G', unit_id: D, deployable: false, deployable_reason: 'Behavioral Health' },
];

// One red flag, inline-built so list + detail share the same object.
function flag(
  assessment_id: string,
  type: string,
  severity: RedFlag['severity'],
  rule_fired: string,
  message: string,
): RedFlag {
  return { id: `rf-${assessment_id}-${type}`, assessment_id, type, severity, rule_fired, message, resolved_at: null };
}

export const assessmentList: AssessmentListItem[] = [
  // REFERRED — the PHQ-9 14 demo case (already actioned; shows the closed loop).
  {
    id: 'as-bailey', service_member_id: 'sm-bailey', type: 'PRE', status: 'REFERRED',
    responses: {
      dental_class: 1, immunizations_current: true, pregnancy: false, new_medication: false, last_pha_date: '2026-01-15',
      phq9_q1: 2, phq9_q2: 3, phq9_q3: 2, phq9_q4: 2, phq9_q5: 1, phq9_q6: 2, phq9_q7: 1, phq9_q8: 1, phq9_q9: 0,
    },
    phq9_score: 14, pcl5_score: 18, submitted_at: '2026-06-02T07:50:00Z',
    certified_at: null, certified_by: null, referral_type: 'BEHAVIORAL_HEALTH',
    referral_notes: 'PHQ-9 of 14 (moderate). Referred to Behavioral Health.',
    member: { id: 'sm-bailey', rank: 'SPC', last_name: 'Bailey', first_name: 'Marcus', edipi: '3000000001' },
    unit: { id: B, short_name: 'B CO' },
    flags: [flag('as-bailey', 'PHQ9_ELEVATED', 'HIGH', 'phq9_score >= 10', 'PHQ-9 score 14 indicates moderate or greater depression')],
  },
  // SUBMITTED + red flag, behavioral health (PCL-5 elevated). Newest, top of queue.
  {
    id: 'as-mendez', service_member_id: 'sm-mendez', type: 'POST', status: 'SUBMITTED',
    responses: {
      dental_class: 1, immunizations_current: true, pregnancy: false, last_pha_date: '2026-03-01',
      phq9_q1: 1, phq9_q2: 1, phq9_q3: 2, phq9_q4: 1, phq9_q5: 0, phq9_q6: 1, phq9_q7: 1, phq9_q8: 0, phq9_q9: 0,
      pcl5_q1: 3, pcl5_q2: 3, pcl5_q3: 2, pcl5_q4: 3, pcl5_q5: 2, pcl5_q6: 2, pcl5_q7: 2, pcl5_q15: 2, pcl5_q17: 3, pcl5_q18: 3, pcl5_q20: 3,
    },
    phq9_score: 7, pcl5_score: 38, submitted_at: '2026-06-16T19:20:00Z',
    certified_at: null, certified_by: null, referral_type: null, referral_notes: null,
    member: { id: 'sm-mendez', rank: 'SGT', last_name: 'Mendez', first_name: 'Hector', edipi: '3000000006' },
    unit: { id: B, short_name: 'B CO' },
    flags: [
      flag('as-mendez', 'PCL5_ELEVATED', 'HIGH', 'pcl5_score >= 31', 'PCL-5 score 38 indicates probable PTSD'),
      flag('as-mendez', 'PHQ9_MILD', 'LOW', 'phq9_score >= 5 AND < 10', 'PHQ-9 score 7 indicates mild depression'),
    ],
  },
  // SUBMITTED + red flag, dental class 4 (requires exam).
  {
    id: 'as-coleman', service_member_id: 'sm-coleman', type: 'PRE', status: 'SUBMITTED',
    responses: { dental_class: 4, immunizations_current: true, pregnancy: false, last_pha_date: '2025-12-10' },
    phq9_score: 1, pcl5_score: 3, submitted_at: '2026-06-14T13:05:00Z',
    certified_at: null, certified_by: null, referral_type: null, referral_notes: null,
    member: { id: 'sm-coleman', rank: 'SGT', last_name: 'Coleman', first_name: 'Brianne', edipi: '2000000002' },
    unit: { id: A, short_name: 'A CO' },
    flags: [flag('as-coleman', 'DENTAL_CLASS_4', 'HIGH', 'responses.dental_class == 4', 'Dental Class 4 — requires dental exam')],
  },
  // SUBMITTED + red flag, pregnancy (automatic non-deployable).
  {
    id: 'as-reyes', service_member_id: 'sm-reyes', type: 'PRE', status: 'SUBMITTED',
    responses: { dental_class: 1, immunizations_current: true, pregnancy: true, last_pha_date: '2026-02-20' },
    phq9_score: 2, pcl5_score: 1, submitted_at: '2026-06-15T08:40:00Z',
    certified_at: null, certified_by: null, referral_type: null, referral_notes: null,
    member: { id: 'sm-reyes', rank: 'SPC', last_name: 'Reyes', first_name: 'Daniela', edipi: '3000000005' },
    unit: { id: B, short_name: 'B CO' },
    flags: [flag('as-reyes', 'PREGNANCY', 'HIGH', 'responses.pregnancy == true', 'Pregnancy — automatic non-deployable')],
  },
  // SUBMITTED + red flag, dental class 3 (older submission — overdue).
  {
    id: 'as-nguyen', service_member_id: 'sm-nguyen', type: 'PRE', status: 'SUBMITTED',
    responses: { dental_class: 3, immunizations_current: true, pregnancy: false, last_pha_date: '2026-04-02' },
    phq9_score: 2, pcl5_score: 4, submitted_at: '2026-06-05T09:10:00Z',
    certified_at: null, certified_by: null, referral_type: null, referral_notes: null,
    member: { id: 'sm-nguyen', rank: 'PFC', last_name: 'Nguyen', first_name: 'Kevin', edipi: '3000000002' },
    unit: { id: B, short_name: 'B CO' },
    flags: [flag('as-nguyen', 'DENTAL_CLASS_3', 'HIGH', 'responses.dental_class == 3', 'Dental Class 3 — non-deployable')],
  },
  // SUBMITTED, MEDIUM only (PHA expired) — present in queue but not "red flagged".
  {
    id: 'as-grant', service_member_id: 'sm-grant', type: 'PDHRA', status: 'SUBMITTED',
    responses: { dental_class: 2, immunizations_current: true, pregnancy: false, last_pha_date: '2025-05-01' },
    phq9_score: 3, pcl5_score: 8, submitted_at: '2026-06-16T11:30:00Z',
    certified_at: null, certified_by: null, referral_type: null, referral_notes: null,
    member: { id: 'sm-grant', rank: 'SPC', last_name: 'Grant', first_name: 'Tyrell', edipi: '3000000004' },
    unit: { id: B, short_name: 'B CO' },
    flags: [flag('as-grant', 'PHA_EXPIRED', 'MEDIUM', 'responses.last_pha_date > 12 months ago', 'PHA expired — last completed 2025-05-01')],
  },
  // SUBMITTED, clean — the certify happy path for the demo.
  {
    id: 'as-tran', service_member_id: 'sm-tran', type: 'PRE', status: 'SUBMITTED',
    responses: {
      dental_class: 1, immunizations_current: true, pregnancy: false, new_medication: false, last_pha_date: '2026-03-18',
      phq9_q1: 0, phq9_q2: 0, phq9_q3: 1, phq9_q4: 0, phq9_q5: 0, phq9_q6: 0, phq9_q7: 0, phq9_q8: 0, phq9_q9: 0,
    },
    phq9_score: 1, pcl5_score: 2, submitted_at: '2026-06-17T06:55:00Z',
    certified_at: null, certified_by: null, referral_type: null, referral_notes: null,
    member: { id: 'sm-tran', rank: 'SPC', last_name: 'Tran', first_name: 'Kevin', edipi: '2000000004' },
    unit: { id: A, short_name: 'A CO' },
    flags: [],
  },
  // CERTIFIED recently — populates the "Certified (7d)" sidebar count.
  {
    id: 'as-rodriguez', service_member_id: 'sm-rodriguez', type: 'PRE', status: 'CERTIFIED',
    responses: { dental_class: 1, immunizations_current: true, pregnancy: false, new_medication: false, last_pha_date: '2026-04-10' },
    phq9_score: 3, pcl5_score: 6, submitted_at: '2026-06-12T08:15:00Z',
    certified_at: '2026-06-16T14:00:00Z', certified_by: 'sm-chen', referral_type: null, referral_notes: null,
    member: { id: 'sm-rodriguez', rank: 'SPC', last_name: 'Rodriguez', first_name: 'Luis', edipi: '2000000001' },
    unit: { id: A, short_name: 'A CO' },
    flags: [],
  },
];

// Full detail for every queue row, so the provider drawer drill-down works in
// mock mode. Member/unit are joined from the entity fixtures.
export const assessmentDetails: Record<string, AssessmentDetail> = Object.fromEntries(
  assessmentList.map((a) => [
    a.id,
    {
      ...a,
      member: serviceMembers.find((m) => m.id === a.service_member_id)!,
      unit: units.find((u) => u.id === a.unit.id)!,
    },
  ]),
);

// Matches verified seed: HHC 14/14, A 17/19, B 13/19, C 17/19, D 17/19 -> 78/90.
export const battalionReadiness: ReadinessRollup = {
  unit_id: BN,
  total_assigned: 90,
  deployable_count: 78,
  non_deployable_count: 12,
  pct_deployable: 86.7,
  delta_from_last_week: -4.3,
  pdhra_compliance_pct: 72.0,
  by_company: [
    { unit_id: HHC, short_name: 'HHC', assigned: 14, deployable: 14, pct: 100.0 },
    { unit_id: A, short_name: 'A CO', assigned: 19, deployable: 17, pct: 89.5 },
    { unit_id: B, short_name: 'B CO', assigned: 19, deployable: 13, pct: 68.4 },
    { unit_id: C, short_name: 'C CO', assigned: 19, deployable: 17, pct: 89.5 },
    { unit_id: D, short_name: 'D CO', assigned: 19, deployable: 17, pct: 89.5 },
  ],
};

// Synthetic 90-day decline ending at today's real number (demo data — see
// team/backend-readiness-chat.md note: no historical snapshots are seeded).
export const readinessTrend: TrendPoint[] = [
  { date: '2026-03-23', pct_deployable: 92.1 },
  { date: '2026-04-06', pct_deployable: 91.5 },
  { date: '2026-04-20', pct_deployable: 91.0 },
  { date: '2026-05-04', pct_deployable: 90.2 },
  { date: '2026-05-18', pct_deployable: 89.6 },
  { date: '2026-06-01', pct_deployable: 91.0 },
  { date: '2026-06-08', pct_deployable: 89.1 },
  { date: '2026-06-15', pct_deployable: 86.7 },
];

export const redFlagSummary: RedFlagSummaryItem[] = [
  { category: 'Dental Class 3 — blocking deployment', severity: 'HIGH', soldier_count: 5, units: ['B CO', 'C CO', 'D CO'] },
  { category: 'Behavioral health referral pending', severity: 'HIGH', soldier_count: 4, units: ['B CO', 'C CO', 'D CO'] },
  { category: 'Pregnancy — non-deployable', severity: 'HIGH', soldier_count: 2, units: ['A CO', 'B CO'] },
  { category: 'Dental Class 4 — requires exam', severity: 'HIGH', soldier_count: 1, units: ['A CO'] },
  { category: 'PHA expired', severity: 'MEDIUM', soldier_count: 1, units: ['C CO'] },
  { category: 'Immunization gap', severity: 'MEDIUM', soldier_count: 1, units: ['D CO'] },
];

// Canned chat answers keyed loosely; api.ts picks the closest or a default.
export function mockCommanderChat(question: string): CommanderChatResponse {
  const q = question.toLowerCase();
  if (q.includes('bravo') || q.includes('b co') || q.includes('drop')) {
    return {
      answer:
        'Bravo Company is at 68.4% deployable (13 of 19). 6 soldiers are non-deployable: 3 Dental Class 3, 2 pending behavioral health referrals, and 1 pregnancy. Dental is the primary driver — recommend coordinating a readiness push with the dental clinic.',
    };
  }
  if (q.includes('dental')) {
    return { answer: '6 soldiers across the battalion are non-deployable for dental reasons: 5 Dental Class 3 (B/C/D CO) and 1 Dental Class 4 (A CO).' };
  }
  if (q.includes('cub') || q.includes('summary') || q.includes('brief')) {
    return {
      answer:
        'CUB readiness summary — 1-327 IN: 86.7% medically deployable (78/90), down 4.3% from last week. Non-deployable drivers: dental (6), behavioral health (4), pregnancy (2). Bravo Company is the outlier at 68.4%. PDHRA compliance 72%.',
    };
  }
  return { answer: 'Battalion is at 86.7% deployable (78/90). Top non-deployable categories: dental (6), behavioral health (4), pregnancy (2). Bravo Company is lowest at 68.4%.' };
}

export function mockPolicyChat(question: string): PolicyChatResponse {
  const q = question.toLowerCase();
  if (q.includes('dental')) {
    return {
      answer: 'Dental Readiness Classification 3 or 4 renders a service member non-deployable. Class 3 indicates a dental condition likely to cause an emergency within 12 months; Class 4 indicates an undetermined status requiring an exam.',
      sources: [
        { document_name: 'AR 40-35 Preventive Dentistry and Dental Readiness', similarity_score: 0.89 },
        { document_name: 'DoDI 6490.03 Deployment Health', similarity_score: 0.81 },
      ],
    };
  }
  if (q.includes('pcl') || q.includes('ptsd')) {
    return {
      answer: 'A PCL-5 score of 31–33 or higher is considered a positive screen for probable PTSD and warrants a behavioral health referral.',
      sources: [{ document_name: 'using-PCL5 (VA National Center for PTSD)', similarity_score: 0.92 }],
    };
  }
  return {
    answer: 'I can answer questions grounded in the ingested DoD deployment-health policy documents. Try asking about dental classification, PCL-5/PHQ-9 thresholds, PHA validity, or CENTCOM immunization requirements.',
    sources: [{ document_name: 'DoDI 6490.03 Deployment Health', similarity_score: 0.74 }],
  };
}
