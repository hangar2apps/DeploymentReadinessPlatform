import type { AssessmentResponses } from '../../../types/drp';
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
  responses,
  photoName,
}: {
  responses: AssessmentResponses;
  photoName: string | null;
}) {
  const rows: [string, string][] = [
    ['Dental class', String(responses.dental_class ?? '—')],
    ['Immunizations current', fmtBool(responses.immunizations_current)],
    ['Immunization record', photoName ?? 'not attached'],
    ['Last PHA date', (responses.last_pha_date as string) || '—'],
    ['New medication', fmtBool(responses.new_medication)],
    ['Pregnant', fmtPregnancy(responses.pregnancy_status)],
    [
      'PHQ-9 answered',
      `${countAnswered(responses, 'phq9', PHQ9_ITEMS.length)} / ${PHQ9_ITEMS.length}`,
    ],
    [
      'PCL-5 answered',
      `${countAnswered(responses, 'pcl5', PCL5_ITEMS.length)} / ${PCL5_ITEMS.length}`,
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
    </div>
  );
}
