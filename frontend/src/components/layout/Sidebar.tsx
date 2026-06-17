import { NavLink } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';

interface NavItem {
  to: string;
  label: string;
  desc: string;
}

const NAV: NavItem[] = [
  { to: '/assessment', label: 'Assessment', desc: 'Service member' },
  { to: '/provider', label: 'Provider Queue', desc: 'Review & certify' },
  { to: '/commander', label: 'Commander', desc: 'Readiness dashboard' },
];

export function Sidebar() {
  const { persona } = useRole();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-4">
        <div className="font-mono text-sm font-bold tracking-wide text-accent">
          DRP
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
          Deployment Readiness
        </div>
      </div>

      <nav className="flex-1 p-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mb-1 block rounded-md px-3 py-2 transition-colors ${
                isActive
                  ? 'bg-surface-2 text-ink'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`text-sm font-medium ${isActive ? 'text-accent' : ''}`}
                >
                  {item.label}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted">
                  {item.desc}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Signed in as
        </div>
        <div className="mt-0.5 font-mono text-xs text-ink">
          {persona.rank} {persona.name}
        </div>
      </div>
    </aside>
  );
}
