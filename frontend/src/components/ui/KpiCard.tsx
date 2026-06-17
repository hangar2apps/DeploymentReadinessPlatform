import type { ReactNode } from 'react';

type Tone = 'default' | 'ok' | 'warn' | 'danger';

const valueTone: Record<Tone, string> = {
  default: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function KpiCard({
  label,
  value,
  unit,
  delta,
  tone = 'default',
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number; // signed; rendered with arrow + color
  tone?: Tone;
  hint?: ReactNode;
}) {
  const deltaColor =
    delta === undefined ? '' : delta >= 0 ? 'text-ok' : 'text-danger';
  const arrow = delta === undefined ? '' : delta >= 0 ? '▲' : '▼';

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`font-mono text-3xl font-semibold ${valueTone[tone]}`}>
          {value}
        </span>
        {unit && <span className="font-mono text-sm text-muted">{unit}</span>}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-1 flex items-center gap-2 text-xs">
          {delta !== undefined && (
            <span className={`font-mono ${deltaColor}`}>
              {arrow} {Math.abs(delta).toFixed(1)}
            </span>
          )}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </div>
  );
}
