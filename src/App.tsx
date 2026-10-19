import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { routeAllowed } from './utils/aclConstants';
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
import { setupRealtimeSubscriptions } from './lib/supabase';

function AppRoutes() {
  const { isAuthenticated, clearViewingAs, can, employee } = useAuth();
  const location = useLocation();
  const isAdminRole = employee?.role === 'admin';
  const canOpenStaff =
    isAdminRole ||
    ['staff.view', 'staff.create', 'staff.manage', 'staff.delete', 'staff.manage_acl'].some((key) => can(key));
  const inquiryOnly =
    can('inquiries.view') &&
    !can('customers.view') &&
    !can('visits.view') &&
    !can('orders.view') &&
    !can('complaints.view') &&
    !can('staff.view');

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    // Only clear impersonation if we navigate TO /admin from a different page
    if (
      (location.pathname === '/admin' || location.pathname === '/control-panel') &&
      prevPathRef.current !== location.pathname
    ) {
      clearViewingAs();
    }
    prevPathRef.current = location.pathname;
  }, [location.pathname, clearViewingAs]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : canOpenStaff ? (
            <Navigate to="/control-panel" replace />
          ) : inquiryOnly ? (
            <Navigate to="/inquiries" replace />
          ) : (
            <AdminSelectionPage />
          )
        }
      />
      <Route path="/404" element={<NotFoundPage />} />

      {/* Authenticated Layout Hierarchy */}
      <Route
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : inquiryOnly && location.pathname !== '/inquiries' ? (
            <Navigate to="/inquiries" replace />
          ) : (
            <Layout />
          )
        }
      >
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/pipeline" element={<Navigate to="/inquiries?view=pipeline" replace />} />
        <Route path="/inquiries" element={routeAllowed('/inquiries', can) ? <InquiriesPage /> : <Navigate to="/home" replace />} />
        <Route path="/orders" element={routeAllowed('/orders', can) ? <OrdersPage /> : <Navigate to="/home" replace />} />
        <Route path="/customers" element={routeAllowed('/customers', can) ? <CustomersPage /> : <Navigate to="/home" replace />} />
        <Route path="/customers/:id" element={routeAllowed('/customers', can) ? <CustomerProfilePage /> : <Navigate to="/home" replace />} />
        <Route path="/visits" element={routeAllowed('/visits', can) ? <VisitsPage /> : <Navigate to="/home" replace />} />
        <Route path="/complaints" element={routeAllowed('/complaints', can) ? <ComplaintsPage /> : <Navigate to="/home" replace />} />
        <Route path="/kra" element={<KRADashboard />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/intelligence" element={<IntelligencePage />} />
        <Route
          path="/admin-dashboard"
          element={isAdminRole || routeAllowed('/admin-dashboard', can) ? <AdminDashboard /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/control-panel"
          element={isAdminRole || routeAllowed('/control-panel', can) ? <AdminSelectionPage /> : <Navigate to="/home" replace />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const cleanup = setupRealtimeSubscriptions(queryClient);
    return () => {
      if (cleanup) cleanup();
    };
  }, [queryClient]);

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
