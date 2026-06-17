// Mock-auth role switcher. Selecting a role swaps the active persona and routes
// to that role's landing surface.

import { useNavigate } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import { PERSONAS, ROLE_ORDER } from '../../lib/roles';

export function RoleSwitcher() {
  const { role, persona, setRole } = useRole();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="font-mono text-xs text-ink">
          {persona.rank} {persona.name}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {persona.unit_label}
        </div>
      </div>
      <div className="flex rounded-md border border-border bg-bg p-0.5">
        {ROLE_ORDER.map((r) => {
          const active = r === role;
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                navigate(PERSONAS[r].route);
              }}
              className={`rounded px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                active
                  ? 'bg-accent text-bg'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {PERSONAS[r].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
