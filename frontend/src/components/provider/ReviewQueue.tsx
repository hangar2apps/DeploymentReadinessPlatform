// Provider review queue. Red-flagged assessments first, then most recent. Filter
// chips narrow by ALL / RED FLAG / OVERDUE / NEW; clicking a row opens the detail
// drawer. Backed by GET /api/assessments (mocked until the backend is live).

import { useMemo, useState } from 'react';
import type { AssessmentListItem } from '../../types/drp';
import { DataTable, type Column } from '../ui/DataTable';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { relativeTime, daysSince } from '../../lib/time';
import { hasHighFlag } from '../../lib/queue';

export type QueueFilter = 'ALL' | 'RED_FLAG' | 'OVERDUE' | 'NEW';

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'RED_FLAG', label: 'Red Flag' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'NEW', label: 'New' },
];

// An assessment is "overdue" if it's been waiting on a provider for over a week.
const OVERDUE_DAYS = 7;
const NEW_DAYS = 2;

const TYPE_LABEL: Record<string, string> = {
  PRE: 'Pre-DHA',
  POST: 'Post-DHA',
  PDHRA: 'PDHRA',
};

// Distinct chip per assessment type so POST (the return-phase form) stands out.
const TYPE_STYLE: Record<string, string> = {
  PRE: 'border-border/60 text-muted',
  POST: 'border-accent/40 bg-accent/10 text-accent',
  PDHRA: 'border-sev-low/40 bg-sev-low/10 text-sev-low',
};

function matchesFilter(a: AssessmentListItem, filter: QueueFilter): boolean {
  switch (filter) {
    case 'RED_FLAG':
      return hasHighFlag(a);
    case 'OVERDUE':
      return daysSince(a.submitted_at) >= OVERDUE_DAYS;
    case 'NEW':
      return daysSince(a.submitted_at) <= NEW_DAYS;
    default:
      return true;
  }
}

export function ReviewQueue({
  rows,
  onSelect,
}: {
  rows: AssessmentListItem[];
  onSelect: (a: AssessmentListItem) => void;
}) {
  const [filter, setFilter] = useState<QueueFilter>('ALL');

  const visible = useMemo(
    () => rows.filter((a) => matchesFilter(a, filter)),
    [rows, filter],
  );

  const columns: Column<AssessmentListItem>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (a) => (
        <div className="min-w-0">
          <div className="truncate text-ink">
            <span className="font-mono text-xs text-muted">{a.member.rank}</span>{' '}
            {a.member.last_name}, {a.member.first_name}
          </div>
          <div className="font-mono text-[10px] text-muted">
            EDIPI {a.member.edipi}
          </div>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (a) => (
        <span className="font-mono text-xs text-muted">{a.unit.short_name}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (a) => (
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
            TYPE_STYLE[a.type] ?? 'border-border/60 text-muted'
          }`}
        >
          {TYPE_LABEL[a.type] ?? a.type}
        </span>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (a) =>
        a.flags.length === 0 ? (
          <SeverityBadge severity="NONE" label="Clear" />
        ) : (
          <div className="flex flex-wrap gap-1">
            {a.flags.map((f) => (
              <SeverityBadge
                key={f.id}
                severity={f.severity}
                label={f.type.replace(/_/g, ' ')}
              />
            ))}
          </div>
        ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (a) => (
        <span className="font-mono text-xs text-muted">
          {relativeTime(a.submitted_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (a) => <StatusBadge status={a.status} />,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count = rows.filter((a) => matchesFilter(a, f.key)).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted hover:border-accent hover:text-accent'
              }`}
            >
              {f.label} <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(a) => a.id}
        onRowClick={onSelect}
        empty="No assessments match this filter."
      />
    </div>
  );
}
