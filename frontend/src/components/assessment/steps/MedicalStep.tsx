import type { AssessmentResponses } from '../../../types/drp';
import type { SetResponse } from '../types';
import { Field } from '../fields/Field';
import { YesNo } from '../fields/YesNo';
import { controlClass } from '../fields/fieldStyles';

export function MedicalStep({
  r,
  set,
}: {
  r: AssessmentResponses;
  set: SetResponse;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Medical history</h2>
      <Field label="Started any new medication in the last 90 days?">
        <YesNo
          value={r.new_medication as boolean | undefined}
          onChange={(v) => set('new_medication', v)}
        />
      </Field>
      {r.new_medication === true && (
        <Field label="List your medications (name, dose, frequency)">
          <textarea
            className={controlClass}
            rows={4}
            placeholder="List each medication"
            value={(r.medications as string) ?? ''}
            onChange={(e) => set('medications', e.target.value)}
          />
        </Field>
      )}
      <Field label="Any hospitalization in the last 12 months?">
        <YesNo
          value={r.recent_hospitalization as boolean | undefined}
          onChange={(v) => set('recent_hospitalization', v)}
        />
      </Field>
      {r.recent_hospitalization === true && (
        <Field label="Explain each hospitalization (date, reason, outcome)">
          <textarea
            className={controlClass}
            rows={4}
            placeholder="Explain each occurrence"
            value={(r.hospitalization_details as string) ?? ''}
            onChange={(e) => set('hospitalization_details', e.target.value)}
          />
        </Field>
      )}
      <Field label="Chronic conditions (BLANK IF NONE)">
        <textarea
          className={controlClass}
          rows={2}
          value={(r.chronic_conditions as string) ?? ''}
          onChange={(e) => set('chronic_conditions', e.target.value)}
        />
      </Field>
    </div>
  );
}
