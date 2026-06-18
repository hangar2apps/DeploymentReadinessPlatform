import type { AssessmentResponses, AssessmentType } from '../../../types/drp';
import type { SetResponse } from '../types';
import { PHQ9_ITEMS, PCL5_ITEMS } from '../../../lib/questionnaire';

function fmtBool(v: unknown): string {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  return '—';
}

function fmtPregnancy(v: AssessmentResponses['pregnancy_status']): string {
  if (v === 'yes') return 'Yes';
  if (v === 'no') return 'No';
  if (v === 'unknown') return "Don't know";
  return '—';
}

function countAnswered(r: AssessmentResponses, prefix: string, total: number) {
  let n = 0;
  for (let i = 1; i <= total; i++) if (r[`${prefix}_q${i}`] !== undefined) n++;
  return n;
}

export function ReviewStep({
  responses: r,
  photoName,
  type,
  set,
}: {
  responses: AssessmentResponses;
  photoName: string | null;
  type: AssessmentType;
  set: SetResponse;
}) {
  const num = (k: string) => r[k] as number | undefined;
  const listLen = (k: string) => (r[k] as string[] | undefined)?.length ?? 0;

  const preRows: [string, string][] = [
    ['Dental class', String(r.dental_class ?? '—')],
    ['Immunizations current', fmtBool(r.immunizations_current)],
    ['Immunization record', photoName ?? 'not attached'],
    ['Last PHA date', (r.last_pha_date as string) || '—'],
    ['New medication', fmtBool(r.new_medication)],
    ['Pregnant', fmtPregnancy(r.pregnancy_status)],
  ];

  const postRows: [string, string][] = [
    [
      'Blast exposure',
      r.blast_exposure === true
        ? `Yes (${num('blast_count') ?? '—'})`
        : fmtBool(r.blast_exposure),
    ],
    ['Wounded or injured', fmtBool(r.wounded)],
    ['Witnessed casualty', fmtBool(r.witnessed_casualty)],
    ['CBRN exposure', fmtBool(r.cbrn_exposure)],
    [
      'Environmental hazards',
      r.env_hazards === true
        ? `Yes (${listLen('env_hazard_types')})`
        : fmtBool(r.env_hazards),
    ],
    [
      'TBI symptoms',
      listLen('tbi_symptoms') ? `${listLen('tbi_symptoms')} reported` : 'None',
    ],
    ['Deployment health concern', fmtBool(r.deployment_health_concern)],
  ];

  const rows: [string, string][] = [
    ...(type === 'POST' ? postRows : preRows),
    [
      'PHQ-9 answered',
      `${countAnswered(r, 'phq9', PHQ9_ITEMS.length)} / ${PHQ9_ITEMS.length}`,
    ],
    [
      'PCL-5 answered',
      `${countAnswered(r, 'pcl5', PCL5_ITEMS.length)} / ${PCL5_ITEMS.length}`,
    ],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Review & submit</h2>
        <p className="mt-1 text-sm text-muted">
          Scores and red flags are calculated by the medical system after you
          submit.
        </p>
      </div>
      <dl className="divide-y divide-border rounded-md border border-border">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <dt className="text-muted">{k}</dt>
            <dd className="font-mono">{v}</dd>
          </div>
        ))}
      </dl>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={r.attestation === true}
          onChange={(e) => set('attestation', e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          I attest that the responses I have provided are true and complete to
          the best of my knowledge.
        </span>
      </label>
    </div>
  );
}
