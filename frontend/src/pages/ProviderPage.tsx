// Provider review surface (frontend-derrick.md §2). Red-flag-first review queue
// with a detail drawer for certify/refer, queue counts + form-type filter in the
// shared sidebar, and the RAG policy assistant. Consumes GET /api/assessments and
// PATCH .../certify | .../refer (mocked until the backend is live).

import { useEffect, useMemo, useState } from 'react';
import type {
  AssessmentListItem,
  AssessmentStatus,
  AssessmentType,
} from '../types/drp';
import { getAssessments } from '../services/api';
import { useLayout } from '../context/LayoutContext';
import { Card } from '../components/ui/Card';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ReviewQueue } from '../components/provider/ReviewQueue';
import { AssessmentDetailDrawer } from '../components/provider/AssessmentDetailDrawer';
import { PolicyChat } from '../components/provider/PolicyChat';
import { daysSince } from '../lib/time';
import { hasHighFlag } from '../lib/queue';

type TypeFilter = 'ALL' | AssessmentType;

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'ALL', label: 'All Forms' },
  { key: 'PRE', label: 'Pre-DHA' },
  { key: 'POST', label: 'Post-DHA' },
  { key: 'PDHRA', label: 'PDHRA' },
];

const PENDING: AssessmentStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];

function counts(rows: AssessmentListItem[]) {
  return {
    queue: rows.filter((a) => PENDING.includes(a.status)).length,
    redFlagged: rows.filter((a) => PENDING.includes(a.status) && hasHighFlag(a)).length,
    awaiting: rows.filter((a) => a.status === 'SUBMITTED').length,
    referred: rows.filter((a) => a.status === 'REFERRED').length,
    certified7d: rows.filter(
      (a) => a.status === 'CERTIFIED' && daysSince(a.certified_at) <= 7,
    ).length,
  };
}

export default function ProviderPage() {
  const { setSidebarNav } = useLayout();
  const [queue, setQueue] = useState<AssessmentListItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [selected, setSelected] = useState<AssessmentListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Provider reviews the whole battalion queue (no unit scoping) — the backend
  // and mock both return every assessment when unit_id is omitted.
  useEffect(() => {
    let active = true;
    getAssessments()
      .then((rows) => {
        if (!active) return;
        setQueue(rows);
        setError(false);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const c = useMemo(() => counts(queue), [queue]);

  const visible = useMemo(
    () => (typeFilter === 'ALL' ? queue : queue.filter((a) => a.type === typeFilter)),
    [queue, typeFilter],
  );

  // Inject provider queue summary + form-type filter into the shared sidebar.
  useEffect(() => {
    const items: { label: string; value: number; tone?: string }[] = [
      { label: 'My Queue', value: c.queue },
      { label: 'Red Flagged', value: c.redFlagged, tone: 'text-danger' },
      { label: 'Awaiting Review', value: c.awaiting },
      { label: 'Referred', value: c.referred, tone: 'text-warn' },
      { label: 'Certified (7d)', value: c.certified7d, tone: 'text-ok' },
    ];
    setSidebarNav(
      <div className="space-y-4">
        <div>
          <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Queue
          </div>
          <div className="space-y-0.5">
            {items.map((it) => (
              <div
                key={it.label}
                className="flex items-center justify-between rounded-md px-3 py-1.5"
              >
                <span className="text-sm text-ink">{it.label}</span>
                <span className={`font-mono text-sm tabular-nums ${it.tone ?? 'text-muted'}`}>
                  {it.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Form Type
          </div>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeFilter(t.key)}
              className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                typeFilter === t.key
                  ? 'bg-surface-2 text-accent'
                  : 'text-ink hover:bg-surface-2'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>,
    );
    return () => setSidebarNav(null);
  }, [c, typeFilter, setSidebarNav]);

  function handleResolved(id: string, status: AssessmentStatus) {
    setQueue((rows) =>
      rows.map((a) => (a.id === id ? { ...a, status } : a)),
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        Couldn't load the review queue. Check that the gateway is running, then
        reload.
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingScreen
        message="Loading review queue..."
        detail="Gathering submitted assessments and priority flags for provider review."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card title="Review Queue" className="lg:col-span-2">
        <ReviewQueue rows={visible} onSelect={setSelected} />
      </Card>

      <Card title="Policy Assistant">
        <div className="h-[28rem]">
          <PolicyChat />
        </div>
      </Card>

      {/* Keyed per selection so the drawer's local form state resets cleanly. */}
      <AssessmentDetailDrawer
        key={selected?.id ?? 'none'}
        selected={selected}
        onClose={() => setSelected(null)}
        onResolved={handleResolved}
      />
    </div>
  );
}
