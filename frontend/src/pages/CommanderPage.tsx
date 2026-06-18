// Commander dashboard (frontend-bryan.md §2). Battalion readiness at a glance:
// KPIs, by-company bars w/ roster drill-down, attention-required, 90-day trend,
// deployment window, client-side CUB brief export, and the data-chat panel.

import { useEffect, useRef, useState } from 'react';
import type {
  CompanyReadiness as CompanyRow,
  ReadinessRollup,
  RedFlagSummaryItem,
  TrendPoint,
} from '../types/drp';
import {
  getReadiness,
  getReadinessTrend,
  getRedFlagSummary,
} from '../services/api';
import { usePersona } from '../context/RoleContext';
import { useLayout } from '../context/LayoutContext';
import { KpiCard } from '../components/ui/KpiCard';
import { Card } from '../components/ui/Card';
import { CompanyReadiness } from '../components/commander/CompanyReadiness';
import { AttentionRequired } from '../components/commander/AttentionRequired';
import { TrendChart } from '../components/commander/TrendChart';
import { CommanderChat } from '../components/commander/CommanderChat';
import { DeploymentWindow } from '../components/commander/DeploymentWindow';
import { RosterDrawer } from '../components/commander/RosterDrawer';
import { CommanderExports } from '../components/commander/CommanderExports';
import { readinessTone, TONE_TEXT } from '../lib/readiness';

export default function CommanderPage() {
  const persona = usePersona();
  const { setHeaderActions, setSidebarNav } = useLayout();
  const [readiness, setReadiness] = useState<ReadinessRollup | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagSummaryItem[]>([]);
  const [drill, setDrill] = useState<CompanyRow | null>(null);
  const [error, setError] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unit = persona.unit_id;
    let active = true;
    Promise.all([
      getReadiness(unit),
      getReadinessTrend(unit, 90),
      getRedFlagSummary(unit),
    ])
      .then(([r, t, f]) => {
        if (!active) return;
        setReadiness(r);
        setTrend(t);
        setRedFlags(f);
        setError(false);
        // Inject the export buttons into the shared top bar (right side), plus an
        // "ASK" shortcut that jumps to the data-chat panel at the bottom.
        setHeaderActions(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="shrink-0 rounded-md border border-border px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              ASK
            </button>
            <CommanderExports readiness={r} redFlags={f} />
          </div>,
        );
        // Inject the unit roster into the sidebar: company readiness, click to
        // drill into that company's non-deployable roster.
        setSidebarNav(
          <nav>
            <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted">
              {persona.unit_label} · Companies
            </div>
            {r.by_company.map((c) => (
              <button
                key={c.unit_id}
                type="button"
                onClick={() => setDrill(c)}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="font-mono text-sm text-ink">{c.short_name}</span>
                <span
                  className={`font-mono text-xs ${TONE_TEXT[readinessTone(c.pct)]}`}
                >
                  {c.pct.toFixed(0)}%
                </span>
              </button>
            ))}
          </nav>,
        );
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      setHeaderActions(null);
      setSidebarNav(null);
    };
  }, [persona.unit_id, persona.unit_label, setHeaderActions, setSidebarNav]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        Couldn't load readiness data. Check that the gateway is running, then
        reload.
      </div>
    );
  }

  if (!readiness) {
    return <div className="text-sm text-muted">Loading readiness…</div>;
  }

  return (
    <div className="space-y-5">
      {/* KPIs grouped by intent: forward-looking deployability vs the
          post-deployment compliance follow-up (PDHRA). On mobile they collapse
          into a single 2x2 grid (PDHRA as the 4th cell). */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <h2 className="col-span-2 font-mono text-[11px] uppercase tracking-wider text-muted lg:col-span-3">
          Deployment Readiness
        </h2>
        <h2 className="hidden font-mono text-[11px] uppercase tracking-wider text-muted lg:block lg:col-span-1">
          Health Compliance
        </h2>
        <KpiCard
          label="% Deployable"
          value={readiness.pct_deployable.toFixed(1)}
          unit="%"
          delta={readiness.delta_from_last_week}
          tone={readinessTone(readiness.pct_deployable)}
          hint="vs last week"
        />
        <KpiCard label="Total Assigned" value={readiness.total_assigned} />
        <KpiCard
          label="Non-Deployable"
          value={readiness.non_deployable_count}
          tone="danger"
          hint="require action"
        />
        <KpiCard
          label="PDHRA"
          value={readiness.pdhra_compliance_pct.toFixed(0)}
          unit="%"
          tone={readinessTone(readiness.pdhra_compliance_pct)}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Readiness by Company" className="lg:col-span-2">
          <CompanyReadiness rows={readiness.by_company} onDrill={setDrill} />
        </Card>
        <Card title="Attention Required">
          <AttentionRequired items={redFlags} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="90-Day Readiness Trend" className="lg:col-span-2">
          <TrendChart data={trend} />
        </Card>
        <Card title="Deployment Window">
          <DeploymentWindow pctDeployable={readiness.pct_deployable} />
        </Card>
      </div>

      {/* Data chat — the demo wow moment (ASK button in the header scrolls here) */}
      <div ref={chatRef} className="scroll-mt-4">
        <Card title="Readiness Assistant — Ask the Data">
          <div className="h-80">
            <CommanderChat unitId={persona.unit_id} />
          </div>
        </Card>
      </div>

      <RosterDrawer company={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
