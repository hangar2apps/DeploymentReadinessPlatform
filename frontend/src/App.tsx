import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import AssessmentPage from './pages/AssessmentPage';
import ProviderPage from './pages/ProviderPage';
import CommanderPage from './pages/CommanderPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/commander" replace />} />
        <Route path="/assessment" element={<AssessmentPage />} />
        <Route path="/provider" element={<ProviderPage />} />
        <Route path="/commander" element={<CommanderPage />} />
        <Route path="*" element={<Navigate to="/commander" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
