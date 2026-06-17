import type { ReactNode } from 'react';
import type { AssessmentResponses } from '../../types/drp';

export type SetResponse = <K extends keyof AssessmentResponses>(
  key: K,
  value: AssessmentResponses[K],
) => void;

export interface ScreenDef {
  key: string;
  done: boolean;
  node: ReactNode;
}

export interface SectionDef {
  key: string;
  title: string;
  screens: ScreenDef[];
}
