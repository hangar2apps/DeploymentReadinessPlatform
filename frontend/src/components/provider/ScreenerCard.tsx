// One mental-health screener (PHQ-9 or PCL-5) in the provider detail view:
// total score, clinical band + severity badge, and a per-item breakdown of what
// the soldier answered (when item-level data is present).

import type { AssessmentResponses } from '../../types/drp';
import { SeverityBadge } from '../ui/Badge';
import {
  phq9Band,
  pcl5Band,
  screenerItems,
  type ScreenerBand,
} from '../../lib/screeners';

const META = {
  phq9: { title: 'PHQ-9', subtitle: 'Depression', max: 27, band: phq9Band },
  pcl5: { title: 'PCL-5', subtitle: 'PTSD', max: 80, band: pcl5Band },
} as const;

export function ScreenerCard({
  kind,
  score,
  responses,
}: {
  kind: 'phq9' | 'pcl5';
  score: number | null;
  responses: AssessmentResponses;
}) {
  const meta = META[kind];
  const band: ScreenerBand =
    score == null ? { label: 'Not scored', severity: 'NONE' } : meta.band(score);
  const items = screenerItems(kind, responses as Record<string, unknown>);

  return (
    <div className="rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm font-semibold text-ink">
            {meta.title}
          </span>{' '}
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {meta.subtitle}
          </span>
        </div>
        <SeverityBadge severity={band.severity} label={band.label} />
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
          {score ?? '—'}
        </span>
        <span className="font-mono text-xs text-muted">/ {meta.max}</span>
      </div>

      {items.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
          {items.map((it) => {
            const flagged = it.value >= (kind === 'phq9' ? 2 : 3);
            return (
              <li key={it.index} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-[10px] text-muted">
                  Q{it.index}
                </span>
                <span className="min-w-0 flex-1 leading-snug text-muted">
                  {it.question}
                </span>
                <span
                  className={`shrink-0 font-mono tabular-nums ${
                    flagged ? 'text-warn' : 'text-muted'
                  }`}
                >
                  {it.value} · {it.option}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
