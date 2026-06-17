// Shell sidebar: brand, a role-supplied nav slot (e.g. the commander's unit
// roster), and the signed-in identity + sign out. Hidden on mobile — surfaces
// stay usable without it.

import { useNavigate } from 'react-router-dom';
import { usePersona, useRole } from '../../context/RoleContext';
import { useLayout } from '../../context/LayoutContext';

export function Sidebar() {
  const persona = usePersona();
  const { logout } = useRole();
  const { sidebarNav } = useLayout();
  const navigate = useNavigate();

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
