import type { AssessmentResponses } from '../../types/drp';
import type { Persona } from '../../lib/roles';
import type { ScreenDef, SectionDef, SetResponse } from './types';
import { ScaleQuestion } from './ScaleQuestion';
import { PersonalStep } from './steps/PersonalStep';
import { MedicalStep } from './steps/MedicalStep';
import { DentalStep } from './steps/DentalStep';
import { ImmunizationStep } from './steps/ImmunizationStep';
import { ConcernsStep } from './steps/ConcernsStep';
import { AttestationStep } from './steps/AttestationStep';
import { ReviewStep } from './steps/ReviewStep';
import {
  personalDone,
  medicalDone,
  dentalDone,
  immunizationDone,
  concernsDone,
  attestationDone,
} from './steps/predicates';
import {
  PHQ9_ITEMS,
  PHQ9_PROMPT,
  PHQ9_SCALE,
  PCL5_ITEMS,
  PCL5_PROMPT,
  PCL5_SCALE,
} from '../../lib/questionnaire';

export interface SectionsContext {
  responses: AssessmentResponses;
  set: SetResponse;
  persona: Persona;
  photoName: string | null;
  onPhoto: (name: string) => void;
}

function scaleScreens(
  r: AssessmentResponses,
  set: SetResponse,
  prefix: string,
  prompt: string,
  items: string[],
  scale: { value: number; label: string }[],
): ScreenDef[] {
  return items.map((question, i) => {
    const key = `${prefix}_q${i + 1}`;
    const value = r[key] as number | undefined;
    return {
      key,
      done: value !== undefined,
      node: (
        <ScaleQuestion
          prompt={prompt}
          question={question}
          options={scale}
          value={value}
          onChange={(v) => set(key, v)}
        />
      ),
    };
  });
}

export function buildSections({
  responses: r,
  set,
  persona,
  photoName,
  onPhoto,
}: SectionsContext): SectionDef[] {
  return [
    {
      key: 'personal',
      title: 'Personal',
      screens: [
        {
          key: 'personal',
          done: personalDone(r),
          node: <PersonalStep r={r} set={set} persona={persona} />,
        },
      ],
    },
    {
      key: 'medical',
      title: 'Medical',
      screens: [
        {
          key: 'medical',
          done: medicalDone(r),
          node: <MedicalStep r={r} set={set} />,
        },
      ],
    },
    {
      key: 'dental',
      title: 'Dental',
      screens: [
        {
          key: 'dental',
          done: dentalDone(r),
          node: <DentalStep r={r} set={set} />,
        },
      ],
    },
    {
      key: 'immunization',
      title: 'Immunization',
      screens: [
        {
          key: 'immunization',
          done: immunizationDone(r),
          node: (
            <ImmunizationStep
              r={r}
              set={set}
              photoName={photoName}
              onPhoto={onPhoto}
            />
          ),
        },
      ],
    },
    {
      key: 'phq9',
      title: 'PHQ-9',
      screens: scaleScreens(r, set, 'phq9', PHQ9_PROMPT, PHQ9_ITEMS, PHQ9_SCALE),
    },
    {
      key: 'pcl5',
      title: 'PCL-5',
      screens: scaleScreens(r, set, 'pcl5', PCL5_PROMPT, PCL5_ITEMS, PCL5_SCALE),
    },
    {
      key: 'concerns',
      title: 'Concerns',
      screens: [
        {
          key: 'concerns',
          done: concernsDone(),
          node: <ConcernsStep r={r} set={set} />,
        },
      ],
    },
    {
      key: 'attestation',
      title: 'Attest',
      screens: [
        {
          key: 'attestation',
          done: attestationDone(r),
          node: <AttestationStep r={r} set={set} />,
        },
      ],
    },
    {
      key: 'review',
      title: 'Review',
      screens: [
        {
          key: 'review',
          done: true,
          node: <ReviewStep responses={r} photoName={photoName} />,
        },
      ],
    },
  ];
}
