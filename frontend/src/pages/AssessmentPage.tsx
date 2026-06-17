import { Activity, useCallback, useEffect, useMemo, useState } from 'react';
import type { Assessment, AssessmentResponses } from '../types/drp';
import {
  createAssessment,
  getMyAssessment,
  loadDraft,
  saveDraft,
  clearDraft,
} from '../services/api';
import { usePersona } from '../context/RoleContext';
import { useDev } from '../context/DevContext';
import { Card } from '../components/ui/Card';
import { StatusLanding } from '../components/assessment/StatusLanding';
import { SectionNav, type NavSection } from '../components/assessment/SectionNav';
import { buildSections } from '../components/assessment/sections';
import type {
  ScreenDef,
  SectionDef,
  SetResponse,
} from '../components/assessment/types';
import { fullResponses, partialResponses } from '../lib/assessmentDev';

type Status = Assessment['status'] | 'NOT_STARTED';
type Phase = 'landing' | 'form' | 'submitted';

export default function AssessmentPage() {
  const persona = usePersona();
  const [phase, setPhase] = useState<Phase>('landing');
  const [status, setStatus] = useState<Status>('NOT_STARTED');
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<AssessmentResponses>({});
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyAssessment(persona.member_id)
      .then(async (a) => {
        if (!active) return;
        if (a) {
          setStatus(a.status);
          return;
        }
        const d = await loadDraft(persona.member_id);
        if (!active) return;
        if (d) {
          setResponses(d.responses ?? {});
          setPhotoName(d.photoName ?? null);
          setStep(d.step ?? 0);
          setStatus('DRAFT');
        } else {
          setStatus('NOT_STARTED');
        }
      })
      .catch(() => {
        if (active) setStatus('NOT_STARTED');
      });
    return () => {
      active = false;
    };
  }, [persona.member_id]);

  useEffect(() => {
    if (phase !== 'form') return;
    void saveDraft(persona.member_id, { step, responses, photoName });
  }, [phase, step, responses, photoName, persona.member_id]);

  const set: SetResponse = (key, value) =>
    setResponses((r) => ({ ...r, [key]: value }));

  const handlePhoto = (name: string) => {
    setPhotoName(name);
    set('immunization_record_filename', name);
  };

  const sections = useMemo<SectionDef[]>(
    () =>
      buildSections({ responses, set, persona, photoName, onPhoto: handlePhoto }),
    // `set`/`handlePhoto` are stable updaters; only data deps matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [responses, photoName, persona],
  );

  const flat = useMemo(() => {
    const out: {
      section: SectionDef;
      screen: ScreenDef;
      idxInSection: number;
    }[] = [];
    sections.forEach((s) =>
      s.screens.forEach((screen, j) =>
        out.push({ section: s, screen, idxInSection: j }),
      ),
    );
    return out;
  }, [sections]);

  const navSections = useMemo<NavSection[]>(
    () =>
      sections.map((s, i) => ({
        key: s.key,
        title: s.title,
        count: s.screens.length,
        startIndex: sections
          .slice(0, i)
          .reduce((n, prev) => n + prev.screens.length, 0),
        complete: s.screens.every((scr) => scr.done),
      })),
    [sections],
  );

  const phq9Start = useMemo(
    () => navSections.find((s) => s.key === 'phq9')?.startIndex ?? 0,
    [navSections],
  );

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAssessment({
        service_member_id: persona.member_id,
        type: 'PRE',
        responses,
      });
      setStatus(created.status);
      void clearDraft(persona.member_id);
      setPhase('submitted');
    } catch {
      setError('Could not submit. Check the gateway is running and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const { setSeed } = useDev();

  const devClean = useCallback(() => {
    setResponses({});
    setPhotoName(null);
    setStep(0);
    setStatus('NOT_STARTED');
    setPhase('landing');
    void clearDraft(persona.member_id);
  }, [persona.member_id]);
  const devPartial = useCallback(() => {
    setResponses(partialResponses());
    setPhotoName(null);
    setStatus('DRAFT');
    setPhase('form');
    setStep(phq9Start + 4);
  }, [phq9Start]);
  const devDone = useCallback(() => {
    setResponses(fullResponses());
    setPhotoName(null);
    setStatus('DRAFT');
    setPhase('form');
    setStep(flat.length - 1);
  }, [flat.length]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setSeed({ clean: devClean, partial: devPartial, done: devDone });
    return () => setSeed(null);
  }, [setSeed, devClean, devPartial, devDone]);

  let body;

  if (phase === 'landing') {
    body = (
      <div className="mx-auto max-w-3xl">
        <StatusLanding
          memberName={`${persona.rank} ${persona.name}`}
          status={status}
          type="PRE"
          onStart={() => {
            if (status !== 'DRAFT') {
              setStep(0);
              setResponses({});
              setPhotoName(null);
            }
            setPhase('form');
          }}
        />
      </div>
    );
  } else if (phase === 'submitted') {
    body = (
      <div className="mx-auto max-w-3xl">
        <StatusLanding
          memberName={`${persona.rank} ${persona.name}`}
          status={status}
          type="PRE"
          onStart={() => {}}
        />
      </div>
    );
  } else {
    const current = flat[step];
    const isLast = step === flat.length - 1;
    const section = current.section;
    const answerable = flat.filter((f) => f.screen.key !== 'review');
    const completed = answerable.filter((f) => f.screen.done).length;

    body = (
      <div className="mx-auto max-w-2xl space-y-4">
        <SectionNav
          sections={navSections}
          step={step}
          completed={completed}
          total={answerable.length}
          onJump={(startIndex) => setStep(startIndex)}
        />

        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">{section.title}</span>
          {section.screens.length > 1 && (
            <span className="font-mono text-xs text-muted">
              {current.idxInSection + 1} of {section.screens.length}
            </span>
          )}
        </div>

        <Card>
          <div className="min-h-[18rem]">
            {flat.map((f, i) => (
              <Activity
                key={f.screen.key}
                mode={i === step ? 'visible' : 'hidden'}
              >
                {f.screen.node}
              </Activity>
            ))}
          </div>
        </Card>

        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (step > 0) {
                setStep((s) => s - 1);
                return;
              }
              if (Object.keys(responses).length > 0) setStatus('DRAFT');
              setPhase('landing');
            }}
            className="rounded-md border border-border px-4 py-2 text-sm text-ink hover:border-muted"
          >
            {step === 0 ? 'Save & exit' : 'Back'}
          </button>

          {isLast ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit assessment'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!current.screen.done}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  return body;
}
