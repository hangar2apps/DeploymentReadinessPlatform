// Lets a page inject content into the shared shell: the commander's EXPORT
// button into the top bar (headerActions), and the unit-nav into the sidebar
// (sidebarNav). The page sets nodes when its data is ready and clears them on
// unmount. Other roles leave the slots empty.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface LayoutContextValue {
  headerActions: ReactNode;
  setHeaderActions: (node: ReactNode) => void;
  sidebarNav: ReactNode;
  setSidebarNav: (node: ReactNode) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [sidebarNav, setSidebarNav] = useState<ReactNode>(null);
  const value = useMemo(
    () => ({ headerActions, setHeaderActions, sidebarNav, setSidebarNav }),
    [headerActions, sidebarNav],
  );
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
