import type { RedFlagSummaryItem } from '../../types/drp';
import { SeverityBadge } from '../ui/Badge';

export function AttentionRequired({ items }: { items: RedFlagSummaryItem[] }) {
  return (
    <div className="divide-y divide-border/60">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0">
          <span className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-ink">
            {item.soldier_count}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-ink">{item.category}</span>
              <SeverityBadge severity={item.severity} />
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {item.units.map((u) => (
                <span
                  key={u}
                  className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] text-muted"
                >
                  {u}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
