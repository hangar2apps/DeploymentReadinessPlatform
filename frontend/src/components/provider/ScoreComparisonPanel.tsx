// Pre→Post deployment comparison for a POST assessment: the member's baseline
// PRE scores next to the POST scores with color-coded deltas, plus the
// deployment experiences they reported. Shown only on POST assessments (issue 24).

import type { ScoreComparison } from '../../types/drp';
import { phq9Band, pcl5Band } from '../../lib/screeners';

type Tone = 'ok' | 'warn' | 'danger' | 'flat';

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  flat: 'text-muted',
};

// Green: decreased / same. Yellow: +1–9. Red: +10 or more, or crossed into the
// HIGH clinical band (PHQ-9 ≥ 10 / PCL-5 ≥ 31).
function deltaTone(kind: 'phq9' | 'pcl5', pre: number, post: number): Tone {
  const d = post - pre;
  if (d === 0) return 'flat';
  if (d < 0) return 'ok';
  const band = kind === 'phq9' ? phq9Band : pcl5Band;
  const crossed = band(post).severity === 'HIGH' && band(pre).severity !== 'HIGH';
  if (d >= 10 || crossed) return 'danger';
  return 'warn';
}

function arrow(d: number): string {
  return d > 0 ? '▲' : d < 0 ? '▼' : '▬';
}

function ScoreRow({
  label,
  kind,
  pre,
  post,
}: {
  label: string;
  kind: 'phq9' | 'pcl5';
  pre: number | null;
  post: number | null;
}) {
  const band = kind === 'phq9' ? phq9Band : pcl5Band;
  if (pre == null || post == null) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-16 font-mono text-xs text-muted">{label}</span>
        <span className="text-muted">—</span>
      </div>
    );
  }
  const d = post - pre;
  const tone = deltaTone(kind, pre, post);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="w-16 font-mono text-xs text-muted">{label}</span>
      <span className="font-mono tabular-nums text-ink">{pre}</span>
      <span className="text-muted">({band(pre).label})</span>
      <span className="text-muted">→</span>
      <span className="font-mono tabular-nums text-ink">{post}</span>
      <span className="text-muted">({band(post).label})</span>
      <span className={`ml-auto font-mono tabular-nums ${TONE_TEXT[tone]}`}>
        {arrow(d)} {d > 0 ? '+' : ''}{d}
      </span>
    </div>
  );
}

// Build the "Deployment Experiences Reported" rows from the POST responses.
function experiences(r: Record<string, unknown>): { label: string; value: string }[] {
  const isTrue = (v: unknown) => v === true;
  const rows: { label: string; value: string }[] = [];

  if ('blast_exposure' in r) {
    const events = r.blast_events;
    rows.push({
      label: 'Blast exposure',
      value: isTrue(r.blast_exposure)
        ? events != null
          ? `${events} event${Number(events) === 1 ? '' : 's'}`
          : 'Yes'
        : 'None reported',
    });
  }
  if ('witnessed_death' in r) {
    rows.push({
      label: 'Witnessed death / serious injury',
      value: isTrue(r.witnessed_death) ? 'Yes' : 'No',
    });
  }
  if ('wounded' in r) {
    const detail = typeof r.wound_detail === 'string' ? r.wound_detail : '';
    rows.push({
      label: 'Wounded',
      value: isTrue(r.wounded) ? detail || 'Yes' : 'No',
    });
  }
  if ('tbi_screen_positive' in r) {
    rows.push({
      label: 'TBI screening',
      value: isTrue(r.tbi_screen_positive) ? 'Positive' : 'Negative',
    });
  }
  if ('tinnitus' in r) {
    rows.push({
      label: 'Tinnitus / ringing in ears',
      value: isTrue(r.tinnitus) ? 'Yes' : 'No',
    });
  }
  if ('environmental_exposure' in r) {
    const raw = String(r.environmental_exposure ?? '').toLowerCase();
    const map: Record<string, string> = {
      burn_pit: 'Burn pit',
      minor_dust: 'Minor dust / sand',
      none: 'None reported',
      '': 'None reported',
    };
    rows.push({
      label: 'Environmental hazards',
      value: map[raw] ?? raw.replace(/_/g, ' '),
    });
  }
  return rows;
}

export function ScoreComparisonPanel({
  comparison,
  postPhq9,
  postPcl5,
  responses,
}: {
  comparison: ScoreComparison | null | undefined;
  postPhq9: number | null;
  postPcl5: number | null;
  responses: Record<string, unknown>;
}) {
  const exp = experiences(responses);

  return (
    <section>
      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
        Score Comparison · Pre → Post Deployment
      </h3>
      <div className="space-y-2 rounded-md border border-border bg-bg px-3 py-2.5">
        {comparison ? (
          <div className="space-y-1.5">
            <ScoreRow label="PHQ-9" kind="phq9" pre={comparison.pre_phq9_score} post={postPhq9} />
            <ScoreRow label="PCL-5" kind="pcl5" pre={comparison.pre_pcl5_score} post={postPcl5} />
          </div>
        ) : (
          <p className="text-sm text-muted">No pre-deployment baseline available.</p>
        )}

        {exp.length > 0 && (
          <div className="border-t border-border/60 pt-2">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              Deployment Experiences Reported
            </p>
            <ul className="space-y-0.5">
              {exp.map((e) => (
                <li key={e.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted">{e.label}</span>
                  <span className="text-right text-ink">{e.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
