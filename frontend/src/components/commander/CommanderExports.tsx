// The two header export buttons. CUB brief uses already-loaded dashboard data;
// the 1SG action list fetches the non-deployable roster on demand (it needs
// individual soldiers, which the dashboard aggregates don't carry).

import { useState } from 'react';
import type {
  ReadinessRollup,
  RedFlagSummaryItem,
  TrendPoint,
} from '../../types/drp';
import { getServiceMembers } from '../../services/api';
import { exportCubBrief, exportActionList } from '../../lib/exportBrief';
import { LATEST_ARRIVAL } from '../../lib/deployment';

const UNIT_NAME = '1st Battalion, 327th Infantry Regiment';

export function CommanderExports({
  readiness,
  redFlags,
  trend,
}: {
  readiness: ReadinessRollup;
  redFlags: RedFlagSummaryItem[];
  trend: TrendPoint[];
}) {
  const [busy, setBusy] = useState(false);

  // One click produces both PDFs: the executive CUB brief and the 1SG action
  // list (which needs the non-deployable roster, fetched on demand).
  const exportAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date();
      exportCubBrief({
        unitName: UNIT_NAME,
        generatedAt: now,
        readiness,
        redFlags,
        trend,
      });
      const members = await getServiceMembers({ deployable: false });
      const daysToLad = Math.max(
        0,
        Math.round((LATEST_ARRIVAL.getTime() - Date.now()) / 86_400_000),
      );
      exportActionList({
        unitName: UNIT_NAME,
        generatedAt: now,
        members,
        companies: readiness.by_company,
        daysToLad,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={exportAll}
      disabled={busy}
      className="shrink-0 rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {busy ? 'Preparing…' : 'EXPORT'}
    </button>
  );
}
