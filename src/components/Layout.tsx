import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  BarChart3,
  Menu,
  X,
  Brain,
  ShieldAlert,
  AlertTriangle,
  MapPin,
  ShoppingBag,
  History,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/home', label: 'Dashboard', icon: Home },
  { path: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { path: '/inquiries', label: 'Inquiries', icon: FileText },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/visits', label: 'Visits', icon: MapPin },
  { path: '/complaints', label: 'Complaints', icon: AlertTriangle },
  { path: '/intelligence', label: 'Intelligence', icon: Brain },
  { path: '/logs', label: 'Logs', icon: History },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

function EmployeeFooter() {
  const {
    employee,
    viewingAs,
    logout,
    clearViewingAs,
    isAdmin,
    isSalesManager,
    prototypeRole,
    setPrototypeRole,
  } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToAdmin = () => {
    clearViewingAs();
    navigate('/admin');
  };

  // Always reflect the user's own true identity & role (never overridden by impersonated user's role)
  const ownRoleLabel = isAdmin
    ? 'Admin'
    : isSalesManager
      ? 'Sales Manager'
      : 'Salesperson';

  // Only true impersonation of ANOTHER employee should show "Viewing as"
  const isImpersonatingOther = Boolean(
    viewingAs &&
    employee &&
    viewingAs.id !== employee.id &&
    viewingAs.phone?.replace(/\D/g, '').slice(-10) !== employee.phone?.replace(/\D/g, '').slice(-10)
  );

  return (
    <div className="space-y-2.5">
      {/* Impersonation Status Widget - ONLY SHOWN WHEN IMPERSONATING ANOTHER EMPLOYEE */}
      {isImpersonatingOther && (
        <div className="bg-blue-950/70 border border-blue-500/40 rounded-xl p-2.5 space-y-1.5 shadow-sm">
          <div className="text-[11px] text-blue-300 font-medium leading-tight">
            Viewing as:
            <span className="text-white font-bold block truncate text-xs mt-0.5">
              {viewingAs?.name}
            </span>
          </div>
          <button
            onClick={handleBackToAdmin}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer"
            title="Exit impersonation and return to Admin Control Center"
          >
            <ShieldAlert size={12} />
            Exit to Control Center
          </button>
        </div>
      )}

      {/* Non-impersonating Sales Manager Team Members Switcher */}
      {isSalesManager && !isAdmin && !isImpersonatingOther && (
        <button
          onClick={handleBackToAdmin}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-white rounded-xl border border-blue-500/40 text-xs font-bold transition-all shadow-xs cursor-pointer"
          title="Select Team Member"
        >
          <Users size={14} />
          Team Members
        </button>
      )}

      {/* User's Own Permanent Identity (Dhananjay Goel / EMP001 · Admin) */}
      <div className="pt-0.5">
        <p className="text-xs text-white font-medium">{employee?.name}</p>
        <p className="text-xs text-slate-400">
          {employee?.employee_id} ·{' '}
          <span className="font-semibold text-blue-400">{ownRoleLabel}</span>
        </p>
      </div>

      <div className="border-t border-slate-700 pt-2.5">
        <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Prototype demo</p>
        <select
          aria-label="Prototype demo persona"
          value={prototypeRole || ''}
          onChange={(event) => setPrototypeRole(
            (event.target.value || null) as 'admin' | 'salesperson' | 'procurement' | null,
          )}
          className="mt-1.5 w-full rounded-lg bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-white"
        >
          <option value="">Live role</option>
          <option value="salesperson">Salesperson</option>
          <option value="procurement">Procurement</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <button
        onClick={handleLogout}
        className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
      >
        Logout
      </button>
    </div>
  );
}

export default function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { employee, viewingAs, isAdmin, isProcurement } = useAuth();

  const isImpersonatingOther = Boolean(
    viewingAs &&
    employee &&
    viewingAs.id !== employee.id &&
    viewingAs.phone?.replace(/\D/g, '').slice(-10) !== employee.phone?.replace(/\D/g, '').slice(-10)
  );

  const showAdminTab = isAdmin && !isImpersonatingOther;
  const visibleItems = [
    ...(showAdminTab
      ? [{ path: '/admin-dashboard', label: 'Admin Overview', icon: ShieldAlert }]
      : []),
    ...(showAdminTab
      ? [{ path: '/procurement', label: 'Procurement', icon: ShoppingBag }]
      : []),
    ...(isProcurement
      ? [{ path: '/procurement', label: 'Procurement', icon: ShoppingBag }]
      : navItems),
  ];

  const isActive = (path: string) => {
    if (path === '/pipeline')
      return location.pathname === '/pipeline' || location.pathname === '/';
    return (
      location.pathname === path ||
      (path !== '/' && location.pathname.startsWith(path))
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold text-white">Enlight Sales</h1>
              <p className="text-xs text-slate-400">Metals OS</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-slate-700 transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
                ${
                  isActive(path)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-slate-700 space-y-2">
            <p className="text-xs text-slate-400">Enlight Metals Pvt. Ltd.</p>
            <EmployeeFooter />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">{children || <Outlet />}</div>
      </div>
    </div>
  );
}
