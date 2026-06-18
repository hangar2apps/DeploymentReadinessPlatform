import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../../context/RoleContext';
import { useDev } from '../../context/DevContext';
import { PERSONAS, ROLE_ORDER } from '../../lib/roles';

const seedBtn =
  'flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-ink hover:border-accent hover:text-accent';

export function DevTools() {
  const [open, setOpen] = useState(false);
  const { role, login } = useRole();
  const navigate = useNavigate();
  const { seed, typeControl } = useDev();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-50 rounded-full border border-border bg-surface-2/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-accent shadow-lg backdrop-blur hover:border-accent"
      >
        Dev
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 w-52 space-y-3 rounded-lg border border-border bg-surface-2/95 p-2 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
          Dev tools
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Collapse dev tools"
          className="text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
          Role
        </div>
        {ROLE_ORDER.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              login(r);
              navigate(PERSONAS[r].route);
            }}
            className={`block w-full rounded border px-2 py-1 text-left text-[11px] transition-colors ${
              role === r
                ? 'border-accent text-accent'
                : 'border-border text-ink hover:border-accent hover:text-accent'
            }`}
          >
            {PERSONAS[r].label}
          </button>
        ))}
      </div>

      {typeControl && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Assessment type
          </div>
          <div className="flex gap-1.5">
            {(['PRE', 'POST'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => typeControl.set(t)}
                className={`flex-1 rounded border px-2 py-1 text-xs transition-colors ${
                  typeControl.value === t
                    ? 'border-accent text-accent'
                    : 'border-border text-ink hover:border-accent hover:text-accent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {seed && (
        <div className="space-y-1">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Seed state
          </div>
          <div className="flex gap-1.5">
            <button type="button" className={seedBtn} onClick={seed.clean}>
              Clean
            </button>
            <button type="button" className={seedBtn} onClick={seed.partial}>
              Partial
            </button>
            <button type="button" className={seedBtn} onClick={seed.done}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
