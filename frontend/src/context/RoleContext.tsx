// Mock-auth session. A role is chosen on the login page and persisted to
// localStorage; there's no in-app role switching (real auth via Keycloak later).
// `role`/`persona` are null when signed out.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PERSONAS, type Persona, type Role } from '../lib/roles';

const STORAGE_KEY = 'drp.role';

interface RoleContextValue {
  role: Role | null;
  persona: Persona | null;
  login: (role: Role) => void;
  logout: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readInitialRole(): Role | null {
  const stored = localStorage.getItem(STORAGE_KEY) as Role | null;
  return stored && stored in PERSONAS ? stored : null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(readInitialRole);

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      persona: role ? PERSONAS[role] : null,
      login: (r: Role) => {
        localStorage.setItem(STORAGE_KEY, r);
        setRole(r);
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setRole(null);
      },
    }),
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

// For surfaces rendered behind the auth guard, where a persona is guaranteed.
// eslint-disable-next-line react-refresh/only-export-components
export function usePersona(): Persona {
  const { persona } = useRole();
  if (!persona) throw new Error('usePersona used outside an authenticated route');
  return persona;
}
