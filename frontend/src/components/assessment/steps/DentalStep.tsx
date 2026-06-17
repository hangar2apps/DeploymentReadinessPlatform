import type { AssessmentResponses } from '../../../types/drp';
import type { SetResponse } from '../types';
import { Field } from '../fields/Field';
import { DateInput } from '../fields/DateInput';
import { controlClass } from '../fields/fieldStyles';

export function DentalStep({
  r,
  set,
}: {
  r: AssessmentResponses;
  set: SetResponse;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Dental readiness</h2>
      <Field label="Self-reported dental class">
        <select
          className={controlClass}
          value={(r.dental_class as number | undefined) ?? ''}
          onChange={(e) =>
            set('dental_class', Number(e.target.value) as 1 | 2 | 3 | 4)
          }
        >
          <option value="" disabled>
            Select…
          </option>
          <option value={1}>Class 1 — no treatment needed</option>
          <option value={2}>Class 2 — routine treatment needed</option>
          <option value={3}>Class 3 — urgent (non-deployable)</option>
          <option value={4}>Class 4 — exam overdue</option>
        </select>
      </Field>
      <Field label="Last dental visit">
        <DateInput
          value={(r.last_dental_visit as string) ?? ''}
          onChange={(v) => set('last_dental_visit', v)}
        />
      </Field>
    </div>
  );
}
