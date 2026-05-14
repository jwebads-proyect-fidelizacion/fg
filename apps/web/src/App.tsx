import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Plans from './pages/Plans';
import Attendance from './pages/Attendance';
import Campaigns from './pages/Campaigns';
import Rewards from './pages/Rewards';
import Payments from './pages/Payments';
import Segments from './pages/Segments';
import Alerts from './pages/Alerts';
import AIInsights from './pages/AIInsights';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/:id" element={<MemberDetail />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/segments" element={<Segments />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/ai" element={<AIInsights />} />
            <Route path="/memberships" element={<Navigate to="/members" replace />} />
            <Route path="/points" element={<Navigate to="/rewards" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
