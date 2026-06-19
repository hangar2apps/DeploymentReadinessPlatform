// Sign-in surface. In mock mode it shows the seeded-persona picker (the only
// place a persona is chosen). In real mode UDS Authservice + Keycloak have already
// authenticated the user before the SPA loads, so there is no picker — this page
// just bounces to the user's surface once /api/me resolves.

import { Navigate, useNavigate } from 'react-router-dom';
import { useRole } from '../context/RoleContext';
import { PERSONAS, LOGIN_ORDER } from '../lib/roles';
import { USE_MOCKS } from '../services/api';
import { CuiBar } from '../components/layout/CuiBar';

export default function LoginPage() {
  const { persona, login, loading } = useRole();
  const navigate = useNavigate();

  // Already signed in — go straight to the role's surface.
  if (persona) return <Navigate to={persona.route} replace />;

  // Real mode: no picker. Show a brief status while /api/me resolves; if it ever
  // fails (no session), the user is outside Authservice and there's nothing to pick.
  if (!USE_MOCKS) {
    return (
      <div className="flex min-h-screen flex-col bg-bg">
        <CuiBar />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <p className="text-sm text-muted">
            {loading ? 'Signing you in…' : 'Not signed in. Reload to authenticate via Keycloak.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <CuiBar />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl">
          <div className="mb-10 text-center">
            <div className="font-mono text-3xl font-bold tracking-wide text-accent">
              DRP
            </div>
            <h1 className="mt-2 text-xl font-semibold text-ink">
              Deployment Readiness Platform
            </h1>
            <p className="mt-1 text-sm text-muted">
              Select a role to continue — demo sign-in, no password required.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LOGIN_ORDER.map((id) => {
              const p = PERSONAS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    login(id);
                    navigate(p.route);
                  }}
                  className="group flex flex-col rounded-lg border border-border bg-surface p-5 text-left transition-colors hover:border-accent"
                >
                  <div className="font-mono text-[11px] uppercase tracking-wider text-accent">
                    {p.label}
                  </div>
                  <div className="mt-3 text-sm font-medium text-ink">
                    {p.rank} {p.name}
                  </div>
                  <div className="font-mono text-xs text-muted">
                    {p.unit_label}
                  </div>
                  <p className="mt-3 flex-1 text-xs leading-snug text-muted">
                    {p.blurb}
                  </p>
                  <div className="mt-4 font-mono text-xs text-muted group-hover:text-accent">
                    Sign in →
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-wider text-muted">
            CUI // DEMO — NOT ACTUAL PHI
          </p>
        </div>
      </div>
    </div>
  );
}
