// Header export control. EXPORT opens a small menu so the commander chooses what
// to generate: the executive CUB brief, the 1SG action list, or both. The CUB
// brief uses already-loaded dashboard data; the action list fetches the
// non-deployable roster on demand (it needs individual soldiers, which the
// dashboard aggregates don't carry).

import { useEffect, useState } from 'react';
import type { ReadinessRollup, RedFlagSummaryItem } from '../../types/drp';
import { getServiceMembers } from '../../services/api';
import { exportCubBrief, exportActionList } from '../../lib/exportBrief';
import { LATEST_ARRIVAL } from '../../lib/deployment';

const UNIT_NAME = '1st Battalion, 327th Infantry Regiment';

type Choice = 'cub' | 'actions' | 'both';

export function CommanderExports({
  readiness,
  redFlags,
}: {
  readiness: ReadinessRollup;
  redFlags: RedFlagSummaryItem[];
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Close the menu on Escape while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const buildCub = (now: Date) =>
    exportCubBrief({ unitName: UNIT_NAME, generatedAt: now, readiness, redFlags });

  const buildActions = async (now: Date) => {
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
  };

  const run = async (choice: Choice) => {
    if (busy) return;
    setOpen(false);
    setBusy(true);
    try {
      const now = new Date();
      if (choice === 'cub' || choice === 'both') buildCub(now);
      if (choice === 'actions' || choice === 'both') await buildActions(now);
    } finally {
      setBusy(false);
    }
  };

  const items: { choice: Choice; label: string; hint: string }[] = [
    { choice: 'cub', label: 'CUB Readiness Brief', hint: 'Executive summary' },
    { choice: 'actions', label: 'Action List', hint: 'Non-deployable roster' },
    { choice: 'both', label: 'Both PDFs', hint: 'CUB brief + action list' },
  ];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md bg-accent px-4 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Preparing…' : 'EXPORT'}
      </button>

      {open && (
        <>
          {/* Click-away catcher. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-md border border-border bg-surface shadow-xl"
          >
            <div className="border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
              Export PDF
            </div>
            {items.map((it) => (
              <button
                key={it.choice}
                type="button"
                role="menuitem"
                onClick={() => run(it.choice)}
                className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-surface-2"
              >
                <span className="text-sm text-ink">{it.label}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {it.hint}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
