import type { AssessmentResponses } from '../../../types/drp';
import type { SetResponse } from '../types';

export function AttestationStep({
  r,
  set,
}: {
  r: AssessmentResponses;
  set: SetResponse;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Attestation</h2>
      <p className="text-sm text-muted">
        Review your responses, then attest before submitting.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={r.attestation === true}
          onChange={(e) => set('attestation', e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          I attest that the responses I have provided are true and complete to
          the best of my knowledge.
        </span>
      </label>
    </div>
  );
}
