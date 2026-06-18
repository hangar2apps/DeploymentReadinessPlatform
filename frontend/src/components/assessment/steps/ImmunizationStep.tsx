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
  onPhoto: (name: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  const onFile = (file: File) => {
    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('File too large. Max 50 MB.');
      return;
    }
    setUploading(true);
    uploadImmunizationRecord(memberId, file)
      .then(({ path }) => {
        if (!mounted.current) return;
        set('immunization_record_path', path);
        set('immunization_record_filename', file.name);
        onPhoto(file.name);
      })
      .catch((err) => {
        console.error('immunization upload failed', err);
        if (mounted.current) {
          setError('Upload failed. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (mounted.current) setUploading(false);
      });
  };

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
          <Field label="Upload immunization record (photo or PDF)">
            <input
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
