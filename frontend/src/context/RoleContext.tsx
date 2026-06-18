// Mock-auth session. A role is chosen on the login page and persisted to
// localStorage; there's no in-app role switching (real auth via Keycloak later).
// `role`/`persona` are null when signed out.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PERSONAS, type Persona, type Role } from '../lib/roles';
import { clearAllDrafts } from '../services/api';

const STORAGE_KEY = 'drp.persona';

interface RoleContextValue {
  role: Role | null;
  persona: Persona | null;
  login: (personaId: string) => void;
  logout: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readInitialPersonaId(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored in PERSONAS ? stored : null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [personaId, setPersonaId] = useState<string | null>(readInitialPersonaId);
  const persona = personaId ? PERSONAS[personaId] : null;

  const value = useMemo<RoleContextValue>(
    () => ({
      role: persona?.role ?? null,
      persona,
      login: (id: string) => {
        localStorage.setItem(STORAGE_KEY, id);
        setPersonaId(id);
      },
      logout: () => {
        clearAllDrafts();
        localStorage.removeItem(STORAGE_KEY);
        setPersonaId(null);
      },
    }),
    [persona],
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
