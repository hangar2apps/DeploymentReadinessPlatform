import type { AssessmentResponses } from '../../../types/drp';
import type { Persona } from '../../../lib/roles';
import type { SetResponse } from '../types';

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function PersonalStep({
  r,
  set,
  persona,
}: {
  r: AssessmentResponses;
  set: SetResponse;
  persona: Persona;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Verify your information</h2>
      <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-bg p-3 text-sm">
        <Info label="Name" value={`${persona.rank} ${persona.name}`} />
        <Info label="Unit" value={persona.unit_label} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={r.info_confirmed === true}
          onChange={(e) => set('info_confirmed', e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>The information above is correct.</span>
      </label>
    </div>
  );
}
