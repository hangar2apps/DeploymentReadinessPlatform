import type { AssessmentResponses } from '../../../types/drp';
import type { SetResponse } from '../types';
import { Field } from '../fields/Field';
import { OptionGroup } from '../fields/OptionGroup';
import { controlClass } from '../fields/fieldStyles';

export function ConcernsStep({
  r,
  set,
}: {
  r: AssessmentResponses;
  set: SetResponse;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Additional concerns</h2>
      <Field label="Anything else the medical team should know?">
        <textarea
          className={controlClass}
          rows={3}
          value={(r.additional_concerns as string) ?? ''}
          onChange={(e) => set('additional_concerns', e.target.value)}
        />
      </Field>
      <Field label="FEMALES ONLY — Are you pregnant or is there a chance you could be pregnant?">
        <OptionGroup
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: "Don't know" },
          ]}
          value={r.pregnancy_status}
          onChange={(v) => {
            set('pregnancy_status', v);
            set('pregnancy', v === 'yes');
          }}
        />
      </Field>
    </div>
  );
}
