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
import LogsPage from './pages/LogsPage';
import ReportsPage from './pages/ReportsPage';
import IntelligencePage from './pages/IntelligencePage';
import PricingPage from './pages/PricingPage';
import ComplaintsPage from './pages/ComplaintsPage';
import VisitsPage from './pages/VisitsPage';
import OrdersPage from './pages/OrdersPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminDashboard from './pages/AdminDashboard';

function AppRoutes() {
  const { employee } = useAuth();
  const isAdmin = employee?.role === 'admin';

  return (
    <Layout>
      <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/" element={<PipelinePage />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/intelligence" element={<IntelligencePage />} />
        <Route path="/pricing" element={<PricingPage />} />
        {isAdmin && <Route path="/admin-dashboard" element={<AdminDashboard />} />}
      </Routes>
    </Layout>
  );
}

function AdminRoutes() {
  const { viewingAs } = useAuth();
  // Allow accessing Admin Overview or Executive Home directly even if no salesperson is selected
  if (window.location.pathname === '/admin-dashboard' || window.location.pathname === '/home') return <AppRoutes />;
  if (!viewingAs) return <Navigate to="/admin" replace />;
  return <AppRoutes />;
}

function SalespersonRoutes() {
  if (window.location.pathname === '/') return <Navigate to="/home" replace />;
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
