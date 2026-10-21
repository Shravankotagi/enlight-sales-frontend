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

/* ---------------- Footer User Menu ---------------- */
function UserMenu({
  sidebarOpen,
  isEnlarged,
}: {
  sidebarOpen: boolean;
  isEnlarged: boolean;
}) {
  const {
    employee,
    logout,
    isAdmin,
    isSalesManager,
    isProcurementManager,
    isProcurementPerson,
    clearViewingAs,
    viewingAs,
  } = useAuth();
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
      : isProcurementManager
        ? 'Procurement Manager'
        : isProcurementPerson
          ? 'Procurement Person'
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
        <button
          type="button"
          className={`touch-target group flex items-center h-12 w-full rounded-xl hover:bg-slate-100 transition-[padding,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none cursor-pointer overflow-hidden select-none outline-hidden ${
            isEnlarged ? 'px-3' : 'px-2'
          }`}
          title={!sidebarOpen ? employee?.name || 'Account' : undefined}
          aria-label={employee?.name || 'Account settings'}
        >
          {/* Avatar (centered in collapsed rail, scales gently on enlarge with GPU transform) */}
          <div className={`w-10 h-10 shrink-0 flex items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform ${
            isEnlarged ? 'scale-105' : 'scale-100'
          }`}>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#d71920] to-[#1f4bb8] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {employee?.name ? employee.name.slice(0, 2).toUpperCase() : 'EM'}
            </div>
          </div>

          {/* User Info (fades smoothly when expanded) */}
          <div
            className={`flex flex-col min-w-0 text-left transition-[opacity,max-width,margin] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none overflow-hidden whitespace-nowrap ${
              sidebarOpen
                ? 'opacity-100 max-w-[160px] ml-2.5'
                : 'opacity-0 max-w-0 ml-0 pointer-events-none'
            }`}
          >
            <span className="font-bold text-slate-800 text-xs truncate">
              {employee?.name || 'Employee'}
            </span>
            <span className="text-slate-400 font-medium text-[10px] truncate">
              {employee?.employee_id || 'EMP'} · {ownRoleLabel}
            </span>
          </div>

          {/* Chevrons */}
          <ChevronsUpDown
            size={16}
            className={`text-slate-400 shrink-0 ml-auto transition-opacity duration-150 motion-reduce:transition-none ${
              sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />
        </button>
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

const SIDEBAR_STORAGE_KEY = 'em_sidebar_open';

/* ---------------- Main Layout Component ---------------- */
export default function Layout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [isHovered, setIsHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { employee, viewingAs, isAdmin, isSalesManager, isProcurement, clearViewingAs } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
    setIsHovered(false);
  };

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
  const showUserManagement = (isAdmin || isSalesManager) && !isImpersonatingOther;

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
      ? [{ path: '/admin-dashboard', label: 'Admin Overview', icon: ShieldAlert }]
      : []),
    ...(showUserManagement
      ? [{ path: '/control-panel', label: 'User Management', icon: Settings }]
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
  const visibleNavItems = isProcurement
    ? navItems.filter((item) => item.path === '/inquiries' || item.path === '/assistant')
    : navItems;

  // Hover enlargement only active when sidebar is OPEN and user hovers over it
  const isEnlarged = sidebarOpen && isHovered;

  return (
    <div className="flex h-dvh bg-slate-50 font-sans overflow-hidden relative">
      {/* Spacer Rail: holds the main page layout position firmly so page content never shifts on hover */}
      <div
        className={`shrink-0 hidden lg:block transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}
        aria-hidden="true"
      />

      {/* Dim Backdrop Overlay: pure GPU alpha blend without expensive blur shaders */}
      <div
        className={`fixed inset-0 z-20 bg-slate-900/15 pointer-events-none hidden lg:block motion-reduce:hidden transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-[opacity] ${
          isEnlarged ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => {
          if (sidebarOpen) setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        className={`fixed top-0 bottom-0 left-0 bg-white border-r border-slate-200/90 flex flex-col justify-between select-none pb-[env(safe-area-inset-bottom)]
          transition-[width,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-[width,transform] motion-reduce:transition-none ${
            mobileOpen
              ? 'translate-x-0 w-72 z-50 shadow-2xl'
              : '-translate-x-full lg:translate-x-0'
          } ${
            !sidebarOpen
              ? 'lg:w-20 lg:shadow-xs z-20'
              : isHovered
                ? 'lg:w-[22rem] z-40'
                : 'lg:w-72 z-20'
          }
        `}
      >
        {/* Hardware-composited shadow overlay: fades opacity without CPU shadow re-painting */}
        <div
          className={`absolute inset-0 -z-10 shadow-2xl shadow-slate-900/25 pointer-events-none transition-opacity duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-[opacity] ${
            isEnlarged ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />

        {/* Header */}
        <div
          className={`border-b border-slate-100 shrink-0 relative transition-[height,padding] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none overflow-hidden flex items-center justify-center ${
            sidebarOpen ? 'h-[7.75rem] px-3 pt-5 pb-3' : 'h-14 p-2'
          }`}
        >
          {/* Expanded Header Content */}
          <div
            className={`w-full flex flex-col items-center transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              sidebarOpen
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-2 pointer-events-none absolute'
            }`}
          >
            <img
              src="/enlight-metals-logo.png"
              alt="Enlight Metals"
              className={`w-auto object-contain h-12 sm:h-14 max-w-[220px] transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform origin-center ${
                isEnlarged ? 'scale-105' : 'scale-100'
              }`}
            />
            <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center w-full mt-2">
              <span />
              <span className={`font-black text-slate-900 tracking-tight text-center truncate text-base transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform origin-center ${
                isEnlarged ? 'scale-105' : 'scale-100'
              }`}>
                Enlight <span className="text-[#1f4bb8]">Sigma</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (mobileOpen) setMobileOpen(false);
                  else toggleSidebar();
                }}
                className="justify-self-end inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeft className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Collapsed Header Content (Expand button centered) */}
          <div
            className={`flex items-center justify-center transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              !sidebarOpen
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-90 pointer-events-none absolute'
            }`}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Impersonation Banner if active */}
        {isImpersonatingOther && (
          <div
            className={`mx-3 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs shrink-0 shadow-xs transition-[opacity,max-height,margin,padding] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none overflow-hidden ${
              sidebarOpen
                ? 'opacity-100 max-h-24'
                : 'opacity-0 max-h-0 mt-0 py-0 border-0 pointer-events-none'
            }`}
          >
            <div className="text-[11px] font-semibold text-amber-800">
              Viewing as:{' '}
              <strong className="block truncate text-amber-950 font-bold">
                {viewingAs?.name}
              </strong>
            </div>
            <button
              onClick={() => clearViewingAs()}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
            >
              <ShieldAlert size={12} />
              Exit Impersonation
            </button>
          </div>
        )}

        {/* Flat List of Navigation Menu Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2.5 space-y-1 [scrollbar-width:thin] [scrollbar-color:#e2e8f0_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
          {visibleNavItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={!sidebarOpen ? item.label : undefined}
                className={`touch-target group flex items-center h-11 w-full rounded-xl font-semibold text-xs select-none outline-hidden overflow-hidden
                  transition-[padding,gap,background-color,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
                  isEnlarged ? 'px-4 gap-3.5' : 'px-3.5 gap-3'
                } ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className={`w-5 h-5 shrink-0 flex items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform ${
                  isEnlarged ? 'scale-110' : 'scale-100'
                }`}>
                  <Icon size={19} className="shrink-0" />
                </div>
                <span
                  className={`truncate whitespace-nowrap transition-[opacity,transform,max-width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${
                    sidebarOpen
                      ? 'opacity-100 translate-x-0 max-w-[220px]'
                      : 'opacity-0 -translate-x-2 max-w-0 pointer-events-none'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Footer User Profile Menu */}
        <div className="p-2.5 border-t border-slate-100 shrink-0">
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

        {/* Page Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
}
