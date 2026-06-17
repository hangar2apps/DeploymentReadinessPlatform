// Active-role state, persisted to localStorage. This is the app's mock-auth
// seam — components read the current persona; the role switcher sets it.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PERSONAS, type Persona, type Role } from '../lib/roles';

const STORAGE_KEY = 'drp.role';

interface RoleContextValue {
  role: Role;
  persona: Persona;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readInitialRole(): Role {
  const stored = localStorage.getItem(STORAGE_KEY) as Role | null;
  return stored && stored in PERSONAS ? stored : 'commander';
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(readInitialRole);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, role);
  }, [role]);

  const value = useMemo<RoleContextValue>(
    () => ({ role, persona: PERSONAS[role], setRole: setRoleState }),
    [role],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
