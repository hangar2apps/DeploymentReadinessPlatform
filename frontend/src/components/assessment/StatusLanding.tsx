// Assessment landing screen: shows the service member's current status before
// they start (frontend-derrick.md §1). Drives the primary CTA — start a new
// assessment, resume a draft, or show the post-submit "under review" state.

import type { Assessment } from '../../types/drp';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';

const STATUS_COPY: Record<
  Assessment['status'] | 'NOT_STARTED',
  { headline: string; detail: string }
> = {
  NOT_STARTED: {
    headline: 'No assessment started',
    detail:
      'Complete your Pre-Deployment Health Assessment so the medical team can clear you for deployment.',
  },
  DRAFT: {
    headline: 'Assessment in progress',
    detail: 'You have a saved draft. Pick up where you left off.',
  },
  SUBMITTED: {
    headline: 'Submitted — under provider review',
    detail:
      'Your responses are with the medical team. You will be notified when a provider certifies your readiness.',
  },
  UNDER_REVIEW: {
    headline: 'Under provider review',
    detail: 'A provider is reviewing your assessment. No action needed.',
  },
  CERTIFIED: {
    headline: 'Certified — deployable',
    detail: 'A provider has reviewed and certified your assessment.',
  },
  REFERRED: {
    headline: 'Referred for follow-up',
    detail:
      'A provider has referred you for additional evaluation. Your unit medical office will follow up.',
  },
};

export function StatusLanding({
  memberName,
  status,
  type,
  onStart,
}: {
  memberName: string;
  status: Assessment['status'] | 'NOT_STARTED';
  type: Assessment['type'];
  onStart: () => void;
}) {
  const copy = STATUS_COPY[status];
  const canStart = status === 'NOT_STARTED' || status === 'DRAFT';

  return (
    <Card title="Deployment Health Assessment">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {type}-DEPLOYMENT · {memberName}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{copy.headline}</h2>
          </div>
          {status !== 'NOT_STARTED' && <StatusBadge status={status} />}
        </div>

        <p className="text-sm text-muted">{copy.detail}</p>

        {canStart && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg hover:opacity-90"
          >
            {status === 'DRAFT' ? 'RESUME ASSESSMENT' : 'START ASSESSMENT'}
          </button>
        )}
      </div>
    </Card>
  );
}
