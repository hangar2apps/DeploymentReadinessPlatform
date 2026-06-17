import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CuiBar } from './CuiBar';
import { Sidebar } from './Sidebar';
import { DevTools } from './DevTools';
import { useRole } from '../../context/RoleContext';
import { useLayout } from '../../context/LayoutContext';

// Per-route page title shown in the top bar (replaces the in-page h1).
const TITLES: Record<string, string> = {
  '/assessment': 'Deployment Health Assessment',
  '/provider': 'Provider Review Queue',
  '/commander': 'Deployment Readiness Dashboard',
};

export function AppLayout() {
  const { persona, logout } = useRole();
  const { headerActions } = useLayout();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Auth guard — no persona means signed out.
  if (!persona) return <Navigate to="/login" replace />;

  const title = TITLES[pathname] ?? '';

  return (
    <div className="flex h-full flex-col">
      <CuiBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4 sm:px-6">
            {/* left: page title (collapses to the DRP brand on mobile) */}
            <h1 className="shrink-0 text-base font-semibold text-ink sm:text-lg">
              <span className="font-mono font-bold tracking-wide text-accent sm:hidden">
                DRP
              </span>
              <span className="hidden sm:inline">{title}</span>
            </h1>

            {/* right: unit pill + page actions (e.g. EXPORT) */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <span className="shrink-0 rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted">
                {persona.unit_label}
              </span>
              {headerActions}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto bg-bg p-4 sm:p-6">
            <Outlet />

            {/* Mobile sign out — the sidebar (with its own) is hidden below md. */}
            <div className="mt-8 border-t border-border pt-4 md:hidden">
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="w-full rounded-md border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-danger hover:text-danger"
              >
                Sign out
              </button>
            </div>
          </main>
        </div>
      </div>
      {import.meta.env.DEV && <DevTools />}
    </div>
  );
}
