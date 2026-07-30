import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminSelectionPage from './pages/AdminSelectionPage';
import PipelinePage from './pages/PipelinePage';
import CustomersPage from './pages/CustomersPage';
import KRADashboard from './pages/KRADashboard';
import InquiriesPage from './pages/InquiriesPage';
import ReportsPage from './pages/ReportsPage';

function AdminRoutes() {
  const { viewingAs } = useAuth();
  // Admin must select a salesperson first
  if (!viewingAs) return <Navigate to="/admin" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PipelinePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
}

function SalespersonRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PipelinePage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
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
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
