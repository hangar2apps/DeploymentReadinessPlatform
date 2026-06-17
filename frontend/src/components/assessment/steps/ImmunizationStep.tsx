import type { AssessmentResponses } from '../../../types/drp';
import type { SetResponse } from '../types';
import { Field } from '../fields/Field';
import { YesNo } from '../fields/YesNo';
import { DateInput } from '../fields/DateInput';

export function ImmunizationStep({
  r,
  set,
  photoName,
  onPhoto,
}: {
  r: AssessmentResponses;
  set: SetResponse;
  photoName: string | null;
  onPhoto: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Immunizations & records</h2>
      <Field label="Are your immunizations current?">
        <YesNo
          value={r.immunizations_current as boolean | undefined}
          onChange={(v) => set('immunizations_current', v)}
        />
      </Field>
      {r.immunizations_current === false && (
        <>
          <Field label="Upload immunization record (photo)">
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-ink"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPhoto(f.name);
              }}
            />
          </Field>
          {photoName && (
            <p className="font-mono text-xs text-ok">Attached: {photoName}</p>
          )}
        </>
      )}
      <Field label="Last Periodic Health Assessment (PHA) date">
        <DateInput
          value={(r.last_pha_date as string) ?? ''}
          onChange={(v) => set('last_pha_date', v)}
        />
      </Field>
    </div>
  );
}
