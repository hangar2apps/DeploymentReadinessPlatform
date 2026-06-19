import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useRole } from './context/RoleContext';
import type { Role } from './lib/roles';
import LoginPage from './pages/LoginPage';
import AssessmentPage from './pages/AssessmentPage';
import ProviderPage from './pages/ProviderPage';
import CommanderPage from './pages/CommanderPage';

// Gates a route to a role the user holds. Signed out -> login; a role they don't
// hold -> their primary surface. A multi-role user (e.g. commander who is also a
// service member) is admitted to every surface in their set. While the real-mode
// /api/me lookup is in flight, hold rather than bouncing to /login.
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { roles, hasRole, persona, loading } = useRole();
  if (loading) return null;
  if (!persona || roles.length === 0) return <Navigate to="/login" replace />;
  if (!hasRole(role)) return <Navigate to={persona.route} replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route
          path="/assessment"
          element={
            <RequireRole role="service_member">
              <AssessmentPage />
            </RequireRole>
          }
        />
        <Route
          path="/provider"
          element={
            <RequireRole role="provider">
              <ProviderPage />
            </RequireRole>
          }
        />
        <Route
          path="/commander"
          element={
            <RequireRole role="commander">
              <CommanderPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
