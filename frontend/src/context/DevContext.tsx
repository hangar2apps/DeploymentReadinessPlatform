import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface SeedActions {
  clean: () => void;
  partial: () => void;
  done: () => void;
}

interface DevContextValue {
  seed: SeedActions | null;
  setSeed: (s: SeedActions | null) => void;
}

const DevContext = createContext<DevContextValue | null>(null);

export function DevProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<SeedActions | null>(null);
  const value = useMemo(() => ({ seed, setSeed }), [seed]);
  return <DevContext.Provider value={value}>{children}</DevContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDev() {
  const ctx = useContext(DevContext);
  if (!ctx) throw new Error('useDev must be used within DevProvider');
  return ctx;
}
