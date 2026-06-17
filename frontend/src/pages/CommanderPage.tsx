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
import { useRole } from '../context/RoleContext';
import { KpiCard } from '../components/ui/KpiCard';
import { Card } from '../components/ui/Card';
import { CompanyReadiness } from '../components/commander/CompanyReadiness';
import { AttentionRequired } from '../components/commander/AttentionRequired';
import { TrendChart } from '../components/commander/TrendChart';
import { CommanderChat } from '../components/commander/CommanderChat';
import { DeploymentWindow } from '../components/commander/DeploymentWindow';
import { RosterDrawer } from '../components/commander/RosterDrawer';
import { readinessTone } from '../lib/readiness';
import { exportCubBrief } from '../lib/exportBrief';

export default function CommanderPage() {
  const { persona } = useRole();
  const [readiness, setReadiness] = useState<ReadinessRollup | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagSummaryItem[]>([]);
  const [drill, setDrill] = useState<CompanyRow | null>(null);

  useEffect(() => {
    const unit = persona.unit_id;
    getReadiness(unit).then(setReadiness);
    getReadinessTrend(unit, 90).then(setTrend);
    getRedFlagSummary(unit).then(setRedFlags);
  }, [persona.unit_id]);

  if (!readiness) {
    return <div className="text-sm text-muted">Loading readiness…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header + export */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Commander Readiness Dashboard</h1>
          <p className="font-mono text-xs text-muted">
            {persona.unit_label} · medical deployment readiness
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportCubBrief({
              unitName: '1st Battalion, 327th Infantry Regiment',
              generatedAt: new Date(),
              readiness,
              redFlags,
            })
          }
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
        >
          EXPORT CUB BRIEF
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          label="PDHRA Compliance"
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
