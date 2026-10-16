import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  BarChart3,
  Brain,
  ShieldAlert,
  Settings,
  AlertTriangle,
  MapPin,
  ShoppingBag,
  History,
  Sparkles,
  ChevronsUpDown,
  PanelLeft,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

/* ---------------- Footer User Menu ---------------- */
function UserMenu({
  sidebarOpen,
  isEnlarged,
}: {
  sidebarOpen: boolean;
  isEnlarged: boolean;
}) {
  const { employee, logout, isAdmin, isSalesManager, clearViewingAs, viewingAs } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToAdmin = () => {
    clearViewingAs();
    navigate(isAdmin ? '/control-panel' : '/admin');
  };

  const ownRoleLabel = isAdmin
    ? 'Admin'
    : isSalesManager
      ? 'Sales Manager'
      : 'Salesperson';

  const isImpersonatingOther = Boolean(
    viewingAs &&
      employee &&
      viewingAs.id !== employee.id &&
      viewingAs.phone?.replace(/\D/g, '').slice(-10) !==
        employee.phone?.replace(/\D/g, '').slice(-10)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {sidebarOpen ? (
          <Button
            variant="ghost"
            className={`w-full justify-between gap-2.5 rounded-xl cursor-pointer hover:bg-slate-100 transition-all duration-300 ${
              isEnlarged ? 'h-14 px-3.5' : 'h-12 px-3'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 text-left">
              <div
                className={`rounded-full bg-gradient-to-br from-[#d71920] to-[#1f4bb8] text-white flex items-center justify-center font-bold shrink-0 shadow-xs transition-all duration-300 ${
                  isEnlarged ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs'
                }`}
              >
                {employee?.name ? employee.name.slice(0, 2).toUpperCase() : 'EM'}
              </div>
              <div className="flex flex-col min-w-0 transition-all duration-300">
                <span
                  className={`font-bold text-slate-800 truncate transition-all duration-300 ${
                    isEnlarged ? 'text-sm' : 'text-xs'
                  }`}
                >
                  {employee?.name || 'Employee'}
                </span>
                <span
                  className={`text-slate-400 font-medium truncate transition-all duration-300 ${
                    isEnlarged ? 'text-xs' : 'text-[10px]'
                  }`}
                >
                  {employee?.employee_id || 'EMP'} · {ownRoleLabel}
                </span>
              </div>
            </div>
            <ChevronsUpDown
              className={`text-slate-400 shrink-0 transition-all duration-300 ${
                isEnlarged ? 'h-5 w-5' : 'h-4 w-4'
              }`}
            />
          </Button>
        ) : (
          <button
            type="button"
            className="h-10 w-10 mx-auto rounded-full bg-gradient-to-br from-[#d71920] to-[#1f4bb8] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            title={employee?.name || 'Account'}
          >
            {employee?.name ? employee.name.slice(0, 2).toUpperCase() : 'EM'}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 mb-2" align="start">
        <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-2.5 pb-1">
          Account
        </DropdownMenuLabel>

        <div className="px-3 py-2 border-b border-slate-100">
          <p className="font-bold text-slate-900 text-xs truncate">
            {employee?.name || 'Employee'}
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
            {employee?.phone || employee?.employee_id}
          </p>
        </div>

        {isImpersonatingOther && (
          <DropdownMenuItem
            onClick={handleBackToAdmin}
            className="text-xs font-semibold text-amber-700 hover:bg-amber-50 px-3 py-2 cursor-pointer"
          >
            Exit Impersonation
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold text-xs px-3 py-2.5 cursor-pointer"
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Main Layout Component ---------------- */
export default function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { employee, viewingAs, isAdmin, clearViewingAs } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top on route navigation
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setMobileOpen(false);
  }, [location.pathname]);

  const isImpersonatingOther = Boolean(
    viewingAs &&
      employee &&
      viewingAs.id !== employee.id &&
      viewingAs.phone?.replace(/\D/g, '').slice(-10) !==
        employee.phone?.replace(/\D/g, '').slice(-10)
  );

  const showAdminTab = isAdmin && !isImpersonatingOther;

  const isActive = (path: string) => {
    if (path === '/pipeline')
      return location.pathname === '/pipeline' || location.pathname === '/';
    return (
      location.pathname === path ||
      (path !== '/' && location.pathname.startsWith(path))
    );
  };

  const navItems = [
    { path: '/home', label: 'Dashboard', icon: Home },
    ...(showAdminTab
      ? [
          { path: '/admin-dashboard', label: 'Admin Overview', icon: ShieldAlert },
          { path: '/control-panel', label: 'User Management', icon: Settings },
        ]
      : []),
    { path: '/assistant', label: 'AI Assistant', icon: Sparkles },
    { path: '/inquiries', label: 'Inquiries', icon: FileText },
    { path: '/orders', label: 'Orders', icon: ShoppingBag },
    { path: '/customers', label: 'Customers', icon: Users },
    { path: '/visits', label: 'Visits', icon: MapPin },
    { path: '/complaints', label: 'Complaints', icon: AlertTriangle },
    { path: '/intelligence', label: 'Intelligence', icon: Brain },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
    { path: '/logs', label: 'Logs', icon: History },
  ];

  // Enlargement and background blur only active when sidebar is OPEN and user hovers over it
  const isEnlarged = sidebarOpen && isHovered;

  return (
    <div className="flex h-dvh bg-slate-50 font-sans overflow-hidden relative">
      {/* Spacer Rail: holds page layout position so content never shifts on hover */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-20'
        } shrink-0 hidden lg:block transition-all duration-300 ease-in-out`}
        aria-hidden="true"
      />

      {/* Dim and Blur Backdrop Overlay: only active when sidebar is open and hovered */}
      <div
        className={`fixed inset-0 z-30 transition-all duration-300 pointer-events-none ${
          isEnlarged
            ? 'bg-slate-900/20 backdrop-blur-[2px] opacity-100'
            : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => {
          if (sidebarOpen) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        className={`fixed top-0 bottom-0 left-0 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-all duration-300 ease-in-out select-none pb-[env(safe-area-inset-bottom)] ${
          mobileOpen
            ? 'translate-x-0 w-72 z-50 shadow-2xl'
            : '-translate-x-full lg:translate-x-0'
        } ${
          !sidebarOpen
            ? 'lg:w-20 lg:shadow-xs z-20'
            : isHovered
              ? 'lg:w-[22rem] lg:shadow-2xl lg:shadow-slate-900/25 lg:ring-1 lg:ring-black/5 z-40'
              : 'lg:w-72 lg:shadow-xs z-20'
        }`}
      >
        {/* Top Header: Centered Logo, Centered Enlight Sigma with Collapse Button in front */}
        <div
          className={`border-b border-slate-100 flex items-center shrink-0 transition-all duration-300 ${
            sidebarOpen ? 'p-4 flex-col' : 'p-3.5 justify-center'
          }`}
        >
          {sidebarOpen ? (
            <div className="flex flex-col items-center w-full">
              {/* Centered Enlight Metals Logo */}
              <img
                src="/enlight-metals-logo.png"
                alt="Enlight Metals"
                className={`w-auto object-contain transition-all duration-300 ${
                  isEnlarged
                    ? 'h-13 max-w-[230px]'
                    : 'h-10 sm:h-11 max-w-[190px]'
                }`}
              />

              {/* Row below logo: Enlight Sigma centered, Collapse button in front/on the right */}
              <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center w-full mt-2.5">
                <span />
                <span
                  className={`font-black text-slate-900 tracking-tight text-center truncate ${
                    isEnlarged ? 'text-base' : 'text-sm'
                  }`}
                >
                  Enlight <span className="text-[#1f4bb8]">Sigma</span>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (mobileOpen) {
                      setMobileOpen(false);
                    } else {
                      setSidebarOpen(false);
                      setIsHovered(false);
                    }
                  }}
                  className="justify-self-end inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Collapse sidebar"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (mobileOpen) {
                  setMobileOpen(false);
                } else {
                  setSidebarOpen(true);
                }
              }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              title="Expand sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Impersonation Banner if active */}
        {isImpersonatingOther && sidebarOpen && (
          <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs shrink-0 shadow-xs">
            <div className="text-[11px] font-semibold text-amber-800">
              Viewing as:{' '}
              <strong className="block truncate text-amber-950 font-bold">
                {viewingAs?.name}
              </strong>
            </div>
            <button
              onClick={() => clearViewingAs()}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
            >
              <ShieldAlert size={12} />
              Exit Impersonation
            </button>
          </div>
        )}

        {/* Flat List of Navigation Menu Items (elements scale up smoothly when enlarged) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1.5 [scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={!sidebarOpen ? item.label : undefined}
                className={`touch-target flex items-center rounded-xl font-semibold transition-all duration-300 ${
                  !sidebarOpen
                    ? 'justify-center px-0 w-11 h-11 mx-auto'
                    : isEnlarged
                      ? 'gap-3.5 px-4 h-12 text-sm'
                      : 'gap-3 px-3.5 h-11 text-xs'
                } ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  size={!sidebarOpen ? 19 : isEnlarged ? 22 : 19}
                  className="shrink-0 transition-all duration-300"
                />
                {sidebarOpen && (
                  <span className="truncate transition-all duration-300">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer User Profile Menu */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <UserMenu sidebarOpen={sidebarOpen} isEnlarged={isEnlarged} />
        </div>
      </aside>

      {/* Main Page Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/70">
        {/* Mobile Header Bar */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/enlight-metals-logo.png"
              alt="Enlight Metals"
              className="h-7 w-auto max-w-[9rem] object-contain"
            />
            <span className="text-xs font-bold text-slate-800 truncate">
              Enlight <span className="text-[#1f4bb8]">Sigma</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="touch-target p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Page Content with Lenis smooth scroll attached */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
}
