import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, LayoutDashboard, Users, TrendingUp,
  FileText, BarChart3, Menu, X, Brain, Tag, ShieldAlert
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/', label: 'Pipeline', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/intelligence', label: 'Intelligence', icon: Brain },
  { path: '/pricing', label: 'Pricing', icon: Tag },
  { path: '/kra', label: 'KRA Dashboard', icon: TrendingUp },
  { path: '/inquiries', label: 'Inquiries', icon: FileText },
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
    <div>
      {/* Viewing as banner */}
      {isAdmin && viewingAs && (
        <div className="mb-2 p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
          <p className="text-xs text-amber-400 font-medium">Viewing as:</p>
          <p className="text-xs text-white font-semibold">{viewingAs.name}</p>
          <button
            onClick={handleBackToAdmin}
            className="text-xs text-amber-400 hover:text-amber-300 mt-1 transition-colors">
            ← Back to Admin
          </button>
        </div>
      )}
      <p className="text-xs text-white font-medium">{employee?.name}</p>
      <p className="text-xs text-slate-400">{employee?.employee_id} · {employee?.role}</p>
      <button
        onClick={handleLogout}
        className="text-xs text-red-400 hover:text-red-300 mt-1 transition-colors">
        Logout
      </button>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          {(() => {
            const { employee, viewingAs } = useAuth();
            const isAdmin = employee?.role === 'admin';
            const showAdminTab = isAdmin && !viewingAs;
            const visibleItems = [
              ...(showAdminTab ? [{ path: '/admin-dashboard', label: 'Admin Overview', icon: ShieldAlert }] : []),
              ...navItems,
            ];
            return visibleItems.map(({ path, label, icon: Icon }) => (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
                  ${isActive(path)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}>
                <Icon size={18} className="shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            ));
          })()}
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
