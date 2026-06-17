import type { Severity, AssessmentStatus } from '../../types/drp';

// ---- Severity flag badge ----------------------------------------------------
// red=HIGH, yellow=MEDIUM, blue=LOW, green=NONE (frontend-bryan.md spec).

const sevStyle: Record<'HIGH' | 'MEDIUM' | 'LOW' | 'NONE', string> = {
  HIGH: 'bg-sev-high/15 text-sev-high border-sev-high/40',
  MEDIUM: 'bg-sev-medium/15 text-sev-medium border-sev-medium/40',
  LOW: 'bg-sev-low/15 text-sev-low border-sev-low/40',
  NONE: 'bg-sev-none/15 text-sev-none border-sev-none/40',
};

export function SeverityBadge({
  severity,
  label,
}: {
  severity: Severity | 'NONE';
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${sevStyle[severity]}`}
    >
      {label ?? severity}
    </span>
  );
}

// ---- Assessment status badge ------------------------------------------------

const statusStyle: Record<AssessmentStatus, string> = {
  DRAFT: 'bg-muted/15 text-muted border-muted/40',
  SUBMITTED: 'bg-sev-low/15 text-sev-low border-sev-low/40',
  UNDER_REVIEW: 'bg-warn/15 text-warn border-warn/40',
  CERTIFIED: 'bg-ok/15 text-ok border-ok/40',
  REFERRED: 'bg-danger/15 text-danger border-danger/40',
};

export function StatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${statusStyle[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
