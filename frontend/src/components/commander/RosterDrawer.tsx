// Company drill-down. Opens when a commander clicks a company bar; lists the
// non-deployable soldiers for that unit (GET /api/service-members?unit_id=&
// deployable=false). Commander sees deployability category only — no clinical
// detail (HIPAA).

import { useEffect, useState } from 'react';
import type { CompanyReadiness, ServiceMember } from '../../types/drp';
import { getServiceMembers } from '../../services/api';
import { DataTable, type Column } from '../ui/DataTable';
import { SeverityBadge } from '../ui/Badge';
import { LoadingScreen } from '../ui/LoadingScreen';

const columns: Column<ServiceMember>[] = [
  {
    key: 'rank',
    header: 'Rank',
    render: (m) => <span className="font-mono text-xs text-muted">{m.rank}</span>,
  },
  {
    key: 'name',
    header: 'Name',
    render: (m) => (
      <span className="text-ink">
        {m.last_name}, {m.first_name} {m.middle_initial ?? ''}
      </span>
    ),
  },
  {
    key: 'mos',
    header: 'MOS',
    render: (m) => <span className="font-mono text-xs text-muted">{m.mos}</span>,
  },
  {
    key: 'reason',
    header: 'Reason',
    render: (m) =>
      m.deployable_reason ? (
        <SeverityBadge severity="HIGH" label={m.deployable_reason} />
      ) : (
        <span className="text-muted">—</span>
      ),
  },
];

export function RosterDrawer({
  company,
  onClose,
}: {
  company: CompanyReadiness | null;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<ServiceMember[]>([]);
  // Track which company the loaded members belong to so `loading` is derived,
  // not set synchronously in the effect (react-hooks/set-state-in-effect). The
  // active flag drops out-of-order responses from rapid company switching.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!company) return;
    let active = true;
    getServiceMembers({ unit_id: company.unit_id, deployable: false })
      .then((m) => {
        if (!active) return;
        setMembers(m);
        setLoadedFor(company.unit_id);
      })
      .catch(() => {
        if (!active) return;
        setMembers([]);
        setLoadedFor(company.unit_id);
      });
    return () => {
      active = false;
    };
  }, [company]);

  // Close on Escape while the drawer is open.
  useEffect(() => {
    if (!company) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [company, onClose]);

  const loading = !!company && loadedFor !== company.unit_id;

  if (!company) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${company.short_name} non-deployable roster`}
        className="relative flex w-full max-w-xl flex-col border-l border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {company.short_name} — Non-Deployable Roster
            </h2>
            <p className="font-mono text-xs text-muted">
              {company.deployable}/{company.assigned} deployable ·{' '}
              {company.assigned - company.deployable} require action
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <LoadingScreen
              variant="panel"
              message="Loading roster..."
              detail={`Pulling non-deployable personnel for ${company.short_name}.`}
            />
          ) : (
            <DataTable
              columns={columns}
              rows={members}
              rowKey={(m) => m.id}
              empty="No non-deployable soldiers in this company."
            />
          )}
        </div>
      </div>
    </div>
  );
}
