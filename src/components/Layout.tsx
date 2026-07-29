import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, TrendingUp, 
         FileText, BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', label: 'Pipeline', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/kra', label: 'KRA Dashboard', icon: TrendingUp },
  { path: '/inquiries', label: 'Inquiries', icon: FileText },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} 
        bg-slate-900 text-white transition-all duration-300 flex flex-col`}>
        
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
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-colors text-sm font-medium
                ${location.pathname === path
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
          <div className="p-4 border-t border-slate-700">
            <p className="text-xs text-slate-400">Enlight Metals Pvt. Ltd.</p>
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
