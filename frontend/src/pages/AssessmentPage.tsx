import { Activity, useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Assessment,
  AssessmentResponses,
  AssessmentType,
  ServiceMember,
} from '../types/drp';
import type { Persona } from '../lib/roles';
import {
  createAssessment,
  getMyAssessment,
  getServiceMemberByEdipi,
  loadDraft,
  saveDraft,
  clearDraft,
} from '../services/api';
import { usePersona } from '../context/RoleContext';
import { useDev } from '../context/DevContext';
import { Card } from '../components/ui/Card';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { StatusLanding } from '../components/assessment/StatusLanding';
import { SectionNav, type NavSection } from '../components/assessment/SectionNav';
import { buildSections } from '../components/assessment/sections';
import type {
  ScreenDef,
  SectionDef,
  SetResponse,
} from '../components/assessment/types';
import { fullResponses, partialResponses } from '../lib/assessmentDev';

type Status = Assessment['status'] | 'NOT_STARTED' | null; // null = loading
type Phase = 'landing' | 'form' | 'submitted';

export default function AssessmentPage() {
  const persona = usePersona();
  const [phase, setPhase] = useState<Phase>('landing');
  const [status, setStatus] = useState<Status>(null);
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<AssessmentResponses>({});
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<AssessmentType>('PRE');
  // The real service member record (resolved from the persona's EDIPI), so the
  // screen shows the actual logged-in soldier's rank/name/unit — not the mock
  // persona's hardcoded values.
  const [member, setMember] = useState<ServiceMember | null>(null);
  const [assessedType, setAssessedType] = useState<AssessmentType | null>(null);
  // The real (UUID) service member id, resolved from the persona's EDIPI. The
  // persona.member_id is a fixture string, so the backend can't accept it.
  const [memberId, setMemberId] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let active = true;
    getServiceMemberByEdipi(persona.edipi)
      .then((m) => {
        const id = m?.id ?? persona.member_id;
        if (active) {
          setMemberId(id);
          setMember(m);
        }
        return getMyAssessment(id);
      })
      .then(async (a) => {
        if (!active) return;
        if (a) {
          setStatus(a.status);
          setAssessedType(a.type);
          if (a.status === 'DRAFT') {
            // Resume an in-progress assessment under its own type.
            setType(a.type);
          } else if (a.type === 'PRE') {
            // Completed pre-deployment screen -> the post-deployment assessment
            // is now due. Present it as a fresh start (reset status, since the
            // status above reflected the already-finished PRE) so the landing
            // shows START instead of the PRE's "certified" view.
            setType('POST');
            setStatus('NOT_STARTED');
          } else {
            setPhase('submitted');
          }
          return;
        }
        const d = await loadDraft(persona.member_id);
        if (!active) return;
        if (d) {
          setResponses(d.responses ?? {});
          setPhotoName(d.photoName ?? null);
          setStep(d.step ?? 0);
          setType(d.type ?? 'PRE');
          setStatus('DRAFT');
        } else {
          setStatus('NOT_STARTED');
        }
      })
      .catch(() => {
        if (active) setStatus('NOT_STARTED');
      })
      .finally(() => {
        if (active) setBootstrapping(false);
      });
    return () => {
      active = false;
    };
  }, [persona.edipi, persona.member_id]);

  useEffect(() => {
    if (phase !== 'form') return;
    void saveDraft(persona.member_id, { step, responses, photoName, type });
  }, [phase, step, responses, photoName, type, persona.member_id]);

  const set: SetResponse = (key, value) =>
    setResponses((r) => ({ ...r, [key]: value }));

  const handlePhoto = (name: string | null) => setPhotoName(name);

  // Persona overlaid with the real service member's identity, so the displayed
  // rank/name/unit reflect whoever is actually logged in.
  const effectivePersona = useMemo<Persona>(() => {
    if (!member) return persona;
    const mi = member.middle_initial ? ` ${member.middle_initial}.` : '';
    return {
      ...persona,
      rank: member.rank,
      name: `${member.last_name}, ${member.first_name}${mi}`,
      unit_label: member.unit_short_name ?? persona.unit_label,
    };
  }, [member, persona]);

  const sections = useMemo<SectionDef[]>(
    () =>
      buildSections({
        responses,
        set,
        persona: effectivePersona,
        photoName,
        onPhoto: handlePhoto,
        type,
      }),
    [responses, photoName, effectivePersona, type],
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
    if (!memberId) {
      setError('Still loading your record — try again in a moment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAssessment({
        service_member_id: memberId,
        type,
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

  const { setSeed, setTypeControl } = useDev();

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

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setTypeControl({ value: type, set: setType });
    return () => setTypeControl(null);
  }, [setTypeControl, type]);

  if (bootstrapping) {
    return (
      <LoadingScreen
        message="Loading assessment..."
        detail="Checking your record and restoring any saved draft before you continue."
      />
    );
  }

  let body;

  if (phase === 'landing') {
    // Show the selected type's status; switching to a not-yet-done type reads
    // as NOT_STARTED so its Start button appears.
    const landingStatus =
      assessedType && type === assessedType ? status : 'NOT_STARTED';
    body = (
      <div className="mx-auto max-w-3xl space-y-4">
        <StatusLanding
          memberName={`${effectivePersona.rank} ${effectivePersona.name}`}
          status={landingStatus}
          type={type}
          onStart={() => {
            if (landingStatus !== 'DRAFT') {
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
          memberName={`${effectivePersona.rank} ${effectivePersona.name}`}
          status={status}
          type={type}
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
    // Submit requires every screen done (incl. attestation), so jump-nav can't
    // skip required answers and submit incomplete.
    const allDone = flat.every((f) => f.screen.done);

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
            Back
          </button>

          {isLast ? (
            <button
              type="button"
              disabled={submitting || !allDone}
              onClick={handleSubmit}
              className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
