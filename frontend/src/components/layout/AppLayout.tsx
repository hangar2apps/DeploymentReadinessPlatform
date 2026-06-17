import { Outlet } from 'react-router-dom';
import { CuiBar } from './CuiBar';
import { Sidebar } from './Sidebar';
import { RoleSwitcher } from './RoleSwitcher';

export function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <CuiBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
            <div className="font-mono text-xs uppercase tracking-wider text-muted">
              1st Battalion, 327th Infantry Regiment
            </div>
            <RoleSwitcher />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto bg-bg p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
