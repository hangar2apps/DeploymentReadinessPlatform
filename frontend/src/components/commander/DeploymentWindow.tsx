// Deployment window tracker. No mobilization date is seeded, so this uses a
// fixed demo D-date to show the "days to LAD" countdown the commander briefs to.

import { LATEST_ARRIVAL, WINDOW_OPEN } from '../../lib/deployment';

export function DeploymentWindow({ pctDeployable }: { pctDeployable: number }) {
  const now = new Date();
  const msDay = 86_400_000;
  const daysOut = Math.max(0, Math.round((LATEST_ARRIVAL.getTime() - now.getTime()) / msDay));
  const total = LATEST_ARRIVAL.getTime() - WINDOW_OPEN.getTime();
  const elapsed = Math.min(total, Math.max(0, now.getTime() - WINDOW_OPEN.getTime()));
  const pctElapsed = (elapsed / total) * 100;

  const onTrack = pctDeployable >= 90;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="font-mono text-3xl font-semibold text-ink">{daysOut}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            days to latest arrival date
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm text-ink">
            {LATEST_ARRIVAL.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div
            className={`font-mono text-[10px] uppercase tracking-wider ${onTrack ? 'text-ok' : 'text-warn'}`}
          >
            {onTrack ? 'On track' : 'Behind readiness goal'}
          </div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pctElapsed}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-muted">
        <span>Window open</span>
        <span>LAD</span>
      </div>
    </div>
  );
}
