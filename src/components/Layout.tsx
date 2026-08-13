import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, LayoutDashboard, Users, TrendingUp,
  FileText, BarChart3, Menu, X, Brain, Tag, ShieldAlert,
  AlertTriangle, MapPin, ShoppingBag, History
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/', label: 'Pipeline', icon: LayoutDashboard },
  { path: '/inquiries', label: 'Inquiries', icon: FileText },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/visits', label: 'Visits', icon: MapPin },
  { path: '/complaints', label: 'Complaints', icon: AlertTriangle },
  { path: '/intelligence', label: 'Intelligence', icon: Brain },
  { path: '/pricing', label: 'Pricing', icon: Tag },
  { path: '/kra', label: 'Dashboard', icon: TrendingUp },
  { path: '/logs', label: 'Logs', icon: History },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

function EmployeeFooter() {
  const { employee, viewingAs, logout, clearViewingAs, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToAdmin = () => {
    clearViewingAs();
    navigate('/admin');
  };

  return (
    <div className="space-y-2">
      {isAdmin && (
        <button
          onClick={handleBackToAdmin}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-white rounded-xl border border-blue-500/40 text-xs font-bold transition-all shadow-xs"
          title="Return to Salesperson Selection Page"
        >
          <Users size={14} />
          {viewingAs ? `Viewing: ${viewingAs.name}` : 'Salesperson Selection'}
        </button>
      )}
      <p className="text-xs text-white font-medium">{employee?.name}</p>
      <p className="text-xs text-slate-400">{employee?.employee_id} · {employee?.role}</p>
      <button
        onClick={handleLogout}
        className="text-xs text-red-400 hover:text-red-300 transition-colors">
        Logout
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { employee, viewingAs } = useAuth();

  const isAdmin = employee?.role === 'admin';
  const showAdminTab = isAdmin && !viewingAs;
  const visibleItems = [
    ...(showAdminTab ? [{ path: '/admin-dashboard', label: 'Admin Overview', icon: ShieldAlert }] : []),
    ...navItems,
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-slate-900 text-white transition-all duration-300 flex flex-col`}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold text-white">Enlight Sales</h1>
              <p className="text-xs text-slate-400">Metals OS</p>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-slate-700 transition-colors">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
                ${isActive(path)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}>
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
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
