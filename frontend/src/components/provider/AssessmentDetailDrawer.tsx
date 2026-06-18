// Provider detail drawer. Opens when a queue row is clicked: full assessment with
// PHQ-9/PCL-5 screeners, highlighted red flags, the raw questionnaire responses,
// and the CERTIFY / REFER actions. Loads GET /api/assessments/:id; actions hit
// PATCH .../certify and .../refer and report the new status back to the page.

import { useEffect, useState } from 'react';
import type {
  AssessmentDetail,
  AssessmentListItem,
  AssessmentStatus,
  ReferralType,
} from '../../types/drp';
import {
  getAssessment,
  certifyAssessment,
  referAssessment,
} from '../../services/api';
import { LoadingScreen } from '../ui/LoadingScreen';
import { SeverityBadge, StatusBadge } from '../ui/Badge';
import { ScreenerCard } from './ScreenerCard';
import { ScoreComparisonPanel } from './ScoreComparisonPanel';
import { relativeTime } from '../../lib/time';

const TYPE_LABEL: Record<string, string> = {
  PRE: 'Pre-Deployment (DD 2795)',
  POST: 'Post-Deployment (DD 2796)',
  PDHRA: 'PDHRA (DD 2900)',
};

const REFERRAL_TYPES: { value: ReferralType; label: string }[] = [
  { value: 'BEHAVIORAL_HEALTH', label: 'Behavioral Health' },
  { value: 'DENTAL', label: 'Dental' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'OTHER', label: 'Other' },
];

// Human-readable rows for the raw questionnaire answers (non-screener items).
function responseRows(r: Record<string, unknown>): { label: string; value: string }[] {
  const yn = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : '—');
  const out: { label: string; value: string }[] = [];
  if (r.dental_class != null) out.push({ label: 'Dental class', value: String(r.dental_class) });
  if (r.immunizations_current != null) out.push({ label: 'Immunizations current', value: yn(r.immunizations_current) });
  if (r.pregnancy != null) out.push({ label: 'Pregnancy', value: yn(r.pregnancy) });
  if (r.new_medication != null) out.push({ label: 'New medication', value: yn(r.new_medication) });
  if (r.last_pha_date != null) out.push({ label: 'Last PHA', value: String(r.last_pha_date) });
  return out;
}

export function AssessmentDetailDrawer({
  selected,
  onClose,
  onResolved,
}: {
  selected: AssessmentListItem | null;
  onClose: () => void;
  onResolved: (id: string, status: AssessmentStatus) => void;
}) {
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const [referType, setReferType] = useState<ReferralType>('BEHAVIORAL_HEALTH');
  const [referNotes, setReferNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  // After a certify/refer succeeds, holds the confirmation popup contents
  // (heading + the address the member email went to, or null if not sent).
  const [confirm, setConfirm] = useState<{ heading: string; to: string | null } | null>(null);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    getAssessment(selected.id)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        setLoadedFor(selected.id);
      })
      .catch(() => {
        if (!active) return;
        setDetail(null);
        setLoadedFor(selected.id);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onClose]);

  if (!selected) return null;

  const loading = loadedFor !== selected.id;
  const a = detail ?? null;
  const m = a?.member ?? selected.member;
  const currentStatus = a?.status ?? selected.status;
  const pending = currentStatus === 'SUBMITTED' || currentStatus === 'UNDER_REVIEW';

  // Post-deployment forms (DD 2796 / DD 2900) aren't a deployability gate — the
  // provider is screening a returned soldier for care, so the actions read as
  // "clear / refer for care" rather than "deployable / non-deployable".
  const isPostDeployment = selected.type === 'POST' || selected.type === 'PDHRA';
  const certifyLabel = isPostDeployment ? 'Clear — No Referral' : 'Certify — Deployable';
  const referLabel = isPostDeployment ? 'Refer for Care' : 'Refer — Non-Deployable';

  async function certify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await certifyAssessment(selected!.id);
      onResolved(selected!.id, 'CERTIFIED');
      setConfirm({
        heading: isPostDeployment ? 'Cleared — No Referral' : 'Certified — Deployable',
        to: res.notified_to ?? null,
      });
    } catch {
      setError('Could not clear the assessment. Check the gateway and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRefer() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await referAssessment(selected!.id, {
        referral_type: referType,
        referral_notes: referNotes.trim(),
      });
      onResolved(selected!.id, 'REFERRED');
      setConfirm({
        heading: isPostDeployment ? 'Referred for Care' : 'Referred — Non-Deployable',
        to: res.notified_to ?? null,
      });
    } catch {
      setError('Could not refer. Check the gateway and try again.');
    } finally {
      setBusy(false);
    }
  }

  const status: AssessmentStatus = a?.status ?? selected.status;
  const flags = a?.flags ?? selected.flags;
  const responses = (a?.responses ?? selected.responses) as Record<string, unknown>;
  const hasUnresolvedHighFlags = flags.some((f) => f.severity === 'HIGH' && f.resolved_at === null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assessment detail"
        className="relative flex w-full max-w-2xl flex-col border-l border-border bg-surface shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">
              {m.rank} {m.last_name}, {m.first_name}
            </h2>
            <p className="font-mono text-xs text-muted">
              EDIPI {m.edipi} · {selected.unit.short_name} ·{' '}
              {TYPE_LABEL[selected.type] ?? selected.type}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              Submitted {relativeTime(selected.submitted_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {loading ? (
            <LoadingScreen
              variant="panel"
              message="Loading assessment..."
              detail="Retrieving questionnaire responses, screeners, and referral context."
            />
          ) : (
            <>
              {/* Red flags — surfaced first; review is confirmation, not discovery. */}
              <section>
                <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                  Red Flags
                </h3>
                {flags.length === 0 ? (
                  <p className="rounded-md border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">
                    No red flags fired. Clear to certify.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {flags.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-start gap-2 rounded-md border border-border bg-bg px-3 py-2"
                      >
                        <SeverityBadge severity={f.severity} />
                        <div className="min-w-0">
                          <p className="text-sm leading-snug text-ink">{f.message}</p>
                          <p className="font-mono text-[10px] text-muted">
                            {f.rule_fired}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Pre→Post comparison — POST assessments only. */}
              {selected.type === 'POST' && (
                <ScoreComparisonPanel
                  comparison={a?.comparison}
                  postPhq9={selected.phq9_score}
                  postPcl5={selected.pcl5_score}
                  responses={responses}
                />
              )}

              {/* Screeners */}
              <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <ScreenerCard kind="phq9" score={selected.phq9_score} responses={responses} />
                <ScreenerCard kind="pcl5" score={selected.pcl5_score} responses={responses} />
              </section>

              {/* Raw responses */}
              <section>
                <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                  Questionnaire Responses
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-bg px-3 py-2.5 text-sm">
                  {responseRows(responses).map((row) => (
                    <div key={row.label} className="flex justify-between gap-2">
                      <dt className="text-muted">{row.label}</dt>
                      <dd className="font-mono text-ink">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Existing referral note, if this was already referred. */}
              {status === 'REFERRED' && a?.referral_notes && (
                <section>
                  <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">
                    Referral
                  </h3>
                  <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-ink">
                    {a.referral_notes}
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Action bar */}
        {pending && !loading && (
          <div className="border-t border-border p-4">
            {error && (
              <p className="mb-2 text-xs text-danger">{error}</p>
            )}
            {hasUnresolvedHighFlags && !showRefer && (
              <p className="mb-2 text-xs text-danger">
                Unresolved HIGH red flags are present. Refer this member before certifying.
              </p>
            )}
            {!showRefer ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || hasUnresolvedHighFlags}
                  title={hasUnresolvedHighFlags ? 'Cannot certify while HIGH red flags are unresolved' : undefined}
                  onClick={certify}
                  className="flex-1 rounded-md bg-ok px-3 py-2 text-sm font-medium text-bg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {certifyLabel}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowRefer(true)}
                  className="flex-1 rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
                >
                  {referLabel}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={referType}
                  onChange={(e) => setReferType(e.target.value as ReferralType)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                >
                  {REFERRAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      Refer to: {t.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={referNotes}
                  onChange={(e) => setReferNotes(e.target.value)}
                  rows={2}
                  placeholder="Referral notes (optional)…"
                  className="w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-accent"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowRefer(false)}
                    className="rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={submitRefer}
                    className="flex-1 rounded-md bg-danger px-3 py-2 text-sm font-medium text-bg disabled:opacity-40"
                  >
                    Confirm Referral
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation popup after a certify/refer decision (with email status). */}
      {confirm && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setConfirm(null);
              onClose();
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-xl"
          >
            <h3 className="text-sm font-semibold text-ink">{confirm.heading}</h3>
            <p className="mt-2 text-sm text-muted">
              {confirm.to ? (
                <>
                  Email successfully sent to{' '}
                  <span className="font-mono text-ink">{confirm.to}</span>.
                </>
              ) : (
                'Decision saved. No email was sent — the member has no address on record or the email service is unavailable.'
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirm(null);
                onClose();
              }}
              className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
