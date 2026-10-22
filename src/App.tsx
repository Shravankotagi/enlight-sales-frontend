import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminSelectionPage = lazy(() => import('./pages/AdminSelectionPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CustomerProfilePage = lazy(() => import('./pages/CustomerProfilePage'));
const KRADashboard = lazy(() => import('./pages/KRADashboard'));
const InquiriesPage = lazy(() => import('./pages/InquiriesPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const IntelligencePage = lazy(() => import('./pages/IntelligencePage'));
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage'));
const VisitsPage = lazy(() => import('./pages/VisitsPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const SidebarDemo = lazy(() => import('./components/SidebarDemo'));
import { setupRealtimeSubscriptions } from './lib/supabase';

function AppRoutes() {
  const { isAuthenticated, employee, clearViewingAs, isSalesManager } = useAuth();
  const location = useLocation();
  const isAdmin = employee?.role === 'admin';

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
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading...</div>}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : isAdmin ? (
            <Navigate to="/control-panel" replace />
          ) : (
            <AdminSelectionPage />
          )
        }
      />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/sidebar-demo" element={<SidebarDemo />} />

      {/* Authenticated Layout Hierarchy */}
      <Route
        element={
          isAuthenticated ? <Layout /> : <Navigate to="/login" replace />
        }
      >
        <Route path="/" element={<HomePage />} />
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
        <Route
          path="/admin-dashboard"
          element={isAdmin ? <AdminDashboard /> : <Navigate to="/home" replace />}
        />
        <Route
          path="/control-panel"
          element={(isAdmin || isSalesManager) ? <AdminSelectionPage /> : <Navigate to="/home" replace />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
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
