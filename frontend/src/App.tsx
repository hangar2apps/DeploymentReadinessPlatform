import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { useRole } from './context/RoleContext';
import type { Role } from './lib/roles';
import LoginPage from './pages/LoginPage';
import AssessmentPage from './pages/AssessmentPage';
import ProviderPage from './pages/ProviderPage';
import CommanderPage from './pages/CommanderPage';

// Locks a route to a single role. Signed out -> login; wrong role -> that
// persona's own surface (no cross-role access).
function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { persona } = useRole();
  if (!persona) return <Navigate to="/login" replace />;
  if (persona.role !== role) return <Navigate to={persona.route} replace />;
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
