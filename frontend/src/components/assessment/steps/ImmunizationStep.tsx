import { useEffect, useRef, useState } from 'react';
import type { AssessmentResponses } from '../../../types/drp';
import type { SetResponse } from '../types';
import { Field } from '../fields/Field';
import { YesNo } from '../fields/YesNo';
import { DateInput } from '../fields/DateInput';
import {
  uploadImmunizationRecord,
  MAX_UPLOAD_BYTES,
} from '../../../services/api';

export function ImmunizationStep({
  r,
  set,
  memberId,
  photoName,
  onPhoto,
}: {
  r: AssessmentResponses;
  set: SetResponse;
  memberId: string;
  photoName: string | null;
  onPhoto: (name: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Latest immunizations answer, read inside the async upload callback.
  const immunCurrent = useRef(r.immunizations_current);
  useEffect(() => {
    immunCurrent.current = r.immunizations_current;
  }, [r.immunizations_current]);

  // Reset the native input so re-selecting the same file fires onChange again.
  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = () => {
    set('immunization_record_path', undefined);
    set('immunization_record_filename', undefined);
    onPhoto(null);
    setError(null);
    clearInput();
  };

  const onFile = (file: File) => {
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('File too large. Max 50 MB.');
      clearInput();
      return;
    }
    setUploading(true);
    // No unmount guard: <Activity> keeps this step mounted across navigation,
    // so the result still lands (path stored, "Uploading…" cleared) even if the
    // member advances before the upload finishes.
    uploadImmunizationRecord(memberId, file)
      .then(({ path }) => {
        // Switched to "immunizations current" mid-upload -> discard, so no
        // record reference sticks to a "current" answer.
        if (immunCurrent.current !== false) return;
        set('immunization_record_path', path);
        set('immunization_record_filename', file.name);
        onPhoto(file.name);
      })
      .catch((err) => {
        console.error('immunization upload failed', err);
        setError('Upload failed. Check your connection and try again.');
        clearInput();
      })
      .finally(() => setUploading(false));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Immunizations & records</h2>
      <Field label="Are your immunizations current?">
        <YesNo
          value={r.immunizations_current as boolean | undefined}
          disabled={uploading}
          onChange={(v) => {
            set('immunizations_current', v);
            // No record needed when current — drop any prior upload reference.
            if (v) removeFile();
          }}
        />
      </Field>
      {r.immunizations_current === false && (
        <>
          <Field label="Upload immunization record (photo or PDF)">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              disabled={uploading}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:text-ink disabled:opacity-50"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <p className="mt-1 font-mono text-[11px] text-muted">
              JPG, PNG, WEBP, HEIC or PDF · max 50 MB
            </p>
          </Field>
          {uploading && (
            <p className="font-mono text-xs text-muted">Uploading…</p>
          )}
          {error && <p className="font-mono text-xs text-danger">{error}</p>}
          {!uploading && !error && photoName && (
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs text-ok">Attached: {photoName}</p>
              <button
                type="button"
                onClick={removeFile}
                className="cursor-pointer font-mono text-xs text-muted underline hover:text-danger"
              >
                Remove
              </button>
            </div>
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
