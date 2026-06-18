import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AssessmentType } from '../types/drp';

export interface SeedActions {
  clean: () => void;
  partial: () => void;
  done: () => void;
}

// A surface (the assessment page) can expose its current type + setter so the
// dev panel can switch it without seeding different DB states.
export interface TypeControl {
  value: AssessmentType;
  set: (t: AssessmentType) => void;
}

interface DevContextValue {
  seed: SeedActions | null;
  setSeed: (s: SeedActions | null) => void;
  typeControl: TypeControl | null;
  setTypeControl: (t: TypeControl | null) => void;
}

const DevContext = createContext<DevContextValue | null>(null);

export function DevProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<SeedActions | null>(null);
  const [typeControl, setTypeControl] = useState<TypeControl | null>(null);
  const value = useMemo(
    () => ({ seed, setSeed, typeControl, setTypeControl }),
    [seed, typeControl],
  );
  return <DevContext.Provider value={value}>{children}</DevContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDev() {
  const ctx = useContext(DevContext);
  if (!ctx) throw new Error('useDev must be used within DevProvider');
  return ctx;
}
