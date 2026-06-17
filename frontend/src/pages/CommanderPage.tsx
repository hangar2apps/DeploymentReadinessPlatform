// Commander dashboard (frontend-bryan.md §2). Battalion readiness at a glance:
// KPIs, by-company bars w/ roster drill-down, attention-required, 90-day trend,
// deployment window, client-side CUB brief export, and the data-chat panel.

import { useEffect, useState } from 'react';
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
        // Inject the export buttons into the shared top bar (right side).
        setHeaderActions(
          <CommanderExports readiness={r} redFlags={f} trend={t} />,
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
          post-deployment compliance follow-up (PDHRA). */}
      <div className="grid gap-4 lg:grid-cols-4">
        <section className="lg:col-span-3">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            Deployment Readiness
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          </div>
        </section>
        <section className="flex flex-col lg:col-span-1">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            Health Compliance
          </h2>
          <div className="max-w-xs flex-1 lg:max-w-none">
            <KpiCard
              label="PDHRA"
              value={readiness.pdhra_compliance_pct.toFixed(0)}
              unit="%"
              tone={readinessTone(readiness.pdhra_compliance_pct)}
            />
          </div>
        </section>
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

      {/* Data chat — the demo wow moment */}
      <Card title="Readiness Assistant — Ask the Data">
        <div className="h-80">
          <CommanderChat unitId={persona.unit_id} />
        </div>
      </Card>

      <RosterDrawer company={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
