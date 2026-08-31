import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminSelectionPage from './pages/AdminSelectionPage';
import HomePage from './pages/HomePage';
import CustomersPage from './pages/CustomersPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import KRADashboard from './pages/KRADashboard';
import InquiriesPage from './pages/InquiriesPage';
import LogsPage from './pages/LogsPage';
import ReportsPage from './pages/ReportsPage';
import IntelligencePage from './pages/IntelligencePage';
import ComplaintsPage from './pages/ComplaintsPage';
import VisitsPage from './pages/VisitsPage';
import OrdersPage from './pages/OrdersPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminDashboard from './pages/AdminDashboard';
import AssistantPage from './pages/AssistantPage';

function AppRoutes() {
  const { isAuthenticated, employee } = useAuth();
  const isAdmin = employee?.role === 'admin';

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminSelectionPage />} />
      <Route path="/404" element={<NotFoundPage />} />

      {/* Authenticated Layout Hierarchy */}
      <Route
        element={
          isAuthenticated ? <Layout /> : <Navigate to="/login" replace />
        }
      >
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/pipeline" element={<Navigate to="/inquiries?view=pipeline" replace />} />
        <Route path="/inquiries" element={<InquiriesPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerProfilePage />} />
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/intelligence" element={<IntelligencePage />} />
        {isAdmin && <Route path="/admin-dashboard" element={<AdminDashboard />} />}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
