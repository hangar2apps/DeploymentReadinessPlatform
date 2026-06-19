// Shell sidebar: brand, a role-supplied nav slot (e.g. the commander's unit
// roster), and the signed-in identity + sign out. Hidden on mobile — surfaces
// stay usable without it.

import { useLocation, useNavigate } from 'react-router-dom';
import { usePersona, useRole } from '../../context/RoleContext';
import { personaForRole, ROLE_ORDER } from '../../lib/roles';
import { useLayout } from '../../context/LayoutContext';

export function Sidebar() {
  const persona = usePersona();
  const { roles, logout } = useRole();
  const { sidebarNav } = useLayout();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // A user can hold several roles; offer a link to each surface they can reach.
  const surfaces = ROLE_ORDER.filter((r) => roles.includes(r)).map((r) => personaForRole(r));

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 flex-col justify-center border-b border-border px-4">
        <div className="font-mono text-sm font-bold tracking-wide text-accent">
          DRP
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted">
          Deployment Readiness
        </div>
      </div>

      {surfaces.length > 1 && (
        <div className="border-b border-border p-2">
          <div className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
            Surfaces
          </div>
          {surfaces.map((s) => {
            const active = pathname.startsWith(s.route);
            return (
              <button
                key={s.route}
                type="button"
                onClick={() => navigate(s.route)}
                className={`block w-full rounded-md px-2 py-1.5 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  active ? 'bg-bg text-accent' : 'text-muted hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">{sidebarNav}</div>

      <div className="border-t border-border px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Signed in as
        </div>
        <div className="mt-0.5 font-mono text-xs text-ink">
          {persona.rank} {persona.name}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {persona.label}
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="mt-2 w-full rounded-md border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-danger hover:text-danger"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
