// Auth session. Two modes:
//
//   Mock mode (USE_MOCKS, the default local/dev build): a persona is chosen on the
//   login page and persisted to localStorage. A role can have several seeded
//   personas (e.g. two service members in different assessment states), so the mock
//   selection is a persona id. No backend session.
//
//   Real mode (VITE_USE_MOCKS=false): the app runs behind UDS Authservice, which
//   logs the user in via Keycloak before the SPA loads. We call GET /api/me to learn
//   the live role SET + the seeded member/unit the user maps to. Roles are owned by
//   the backend roster (a user can hold several), so /api/me returns roles[].
//
// `roles` is every role the user holds; `role` is the primary (highest-privilege)
// one, used to pick a default surface. Both are empty/null when signed out or while
// /api/me is loading.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PERSONAS, personaForRole, primaryRole, type Persona, type Role } from '../lib/roles';
import { clearAllDrafts, fetchMe, USE_MOCKS, type Me } from '../services/api';

const STORAGE_KEY = 'drp.persona';

interface RoleContextValue {
  role: Role | null; // primary role, for default routing
  roles: Role[]; // every role the user holds
  persona: Persona | null;
  loading: boolean;
  hasRole: (r: Role) => boolean;
  login: (personaId: string) => void; // mock-only persona pick
  logout: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function readInitialPersonaId(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && stored in PERSONAS ? stored : null;
}

// Build the persona from the live identity (real mode): cosmetic fields (label,
// blurb, rank, unit_label, route) from the primary role's seeded persona, real
// identity fields (name, edipi, member/unit ids) from the session.
function personaFromMe(me: Me, primary: Role): Persona {
  const base = personaForRole(primary);
  return {
    ...base,
    name: me.name ?? base.name,
    edipi: me.edipi ?? base.edipi,
    member_id: me.member_id ?? base.member_id,
    unit_id: me.unit_id ?? base.unit_id,
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  // Mock mode resolves synchronously from localStorage; real mode loads /api/me.
  const [personaId, setPersonaId] = useState<string | null>(
    USE_MOCKS ? readInitialPersonaId : null,
  );
  const [realRoles, setRealRoles] = useState<Role[]>([]);
  const [realPersona, setRealPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState<boolean>(!USE_MOCKS);

  useEffect(() => {
    if (USE_MOCKS) return;
    let active = true;
    fetchMe()
      .then((me) => {
        if (!active) return;
        const primary = primaryRole(me.roles);
        if (!primary) {
          setRealRoles([]);
          return;
        }
        setRealRoles(me.roles);
        setRealPersona(personaFromMe(me, primary));
      })
      .catch(() => {
        // 401/403 (no session / not provisioned) or network error — signed out.
        // Behind Authservice this only surfaces in local real-mode dev with no auth.
        if (active) setRealRoles([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<RoleContextValue>(() => {
    if (USE_MOCKS) {
      // Mock mode: the selected persona is the whole identity; its role is the
      // only role held. Login picks a persona id; logout clears it.
      const persona = personaId ? PERSONAS[personaId] : null;
      const roles = persona ? [persona.role] : [];
      return {
        role: persona?.role ?? null,
        roles,
        persona,
        loading: false,
        hasRole: (r: Role) => roles.includes(r),
        login: (id: string) => {
          localStorage.setItem(STORAGE_KEY, id);
          setPersonaId(id);
        },
        logout: () => {
          clearAllDrafts();
          localStorage.removeItem(STORAGE_KEY);
          setPersonaId(null);
        },
      };
    }

    // Real mode: roles + identity come from /api/me. Keycloak + the roster own
    // roles, so login is a no-op and logout ends the Authservice session.
    const role = primaryRole(realRoles);
    return {
      role,
      roles: realRoles,
      persona: realPersona,
      loading,
      hasRole: (r: Role) => realRoles.includes(r),
      login: () => {},
      logout: () => {
        clearAllDrafts();
        // Authservice serves a global logout at /logout that clears the session
        // and redirects to Keycloak.
        window.location.href = '/logout';
      },
    };
  }, [personaId, realRoles, realPersona, loading]);

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
