import type { CompanyReadiness as CompanyRow } from '../../types/drp';
import { readinessTone, TONE_BAR, TONE_TEXT } from '../../lib/readiness';

export function CompanyReadiness({
  rows,
  onDrill,
}: {
  rows: CompanyRow[];
  onDrill: (row: CompanyRow) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const tone = readinessTone(row.pct);
        return (
          <button
            key={row.unit_id}
            type="button"
            onClick={() => onDrill(row)}
            className="group block w-full text-left"
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-sm text-ink group-hover:text-accent">
                {row.short_name}
              </span>
              <span className="font-mono text-xs text-muted">
                {row.deployable}/{row.assigned}{' '}
                <span className={`ml-1 font-semibold ${TONE_TEXT[tone]}`}>
                  {row.pct.toFixed(1)}%
                </span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg">
              <div
                className={`h-full rounded-full ${TONE_BAR[tone]} transition-all`}
                style={{ width: `${row.pct}%` }}
              />
            </div>
          </button>
        );
      })}
      <p className="pt-1 text-[10px] uppercase tracking-wider text-muted">
        Click a company to drill into its roster
      </p>
    </div>
  );
}
