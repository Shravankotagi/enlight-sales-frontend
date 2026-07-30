import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminSelectionPage from './pages/AdminSelectionPage';
import HomePage from './pages/HomePage';
import PipelinePage from './pages/PipelinePage';
import CustomersPage from './pages/CustomersPage';
import KRADashboard from './pages/KRADashboard';
import InquiriesPage from './pages/InquiriesPage';
import ReportsPage from './pages/ReportsPage';
import IntelligencePage from './pages/IntelligencePage';
import PricingPage from './pages/PricingPage';
import NotFoundPage from './pages/NotFoundPage';

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/" element={<PipelinePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/intelligence" element={<IntelligencePage />} />
        <Route path="/pricing" element={<PricingPage />} />
      </Routes>
    </Layout>
  );
}

function AdminRoutes() {
  const { viewingAs } = useAuth();
  if (!viewingAs) return <Navigate to="/admin" replace />;
  return <AppRoutes />;
}

function SalespersonRoutes() {
  return <AppRoutes />;
}

function ProtectedRoutes() {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin) return <AdminRoutes />;
  return <SalespersonRoutes />;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminSelectionPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
