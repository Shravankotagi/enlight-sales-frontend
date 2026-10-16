import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from 'react';
import { postAuthLogout } from '../lib/api';

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  role: string;
  original_role?: string;
  mode?: string;
  email?: string;
  is_active?: boolean;
  manager_id?: string | null;
  manager_phone?: string | null;
}

interface AuthContextType {
  token: string | null;
  employee: Employee | null;
  viewingAs: Employee | null;
  login: (token: string, employee: Employee) => void;
  logout: (reason?: 'manual' | 'session_expired') => void;
  setViewingAs: (emp: Employee) => void;
  clearViewingAs: () => void;
  isAdmin: boolean;
  isSalesManager: boolean;
  isSalesperson: boolean;
  isAuthenticated: boolean;
  effectivePhone: string | null;
  activeRole: string;
  activeMode?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('enlight_token'),
  );
  const [employee, setEmployee] = useState<Employee | null>(() => {
    const saved = sessionStorage.getItem('enlight_employee');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewingAs, setViewingAsState] = useState<Employee | null>(() => {
    const saved = sessionStorage.getItem('enlight_viewing_as');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/admin' || window.location.pathname === '/control-panel') {
        sessionStorage.removeItem('enlight_viewing_as');
        sessionStorage.removeItem('enlight_active_chat_session_id');
        setViewingAsState(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const login = (newToken: string, newEmployee: Employee) => {
    sessionStorage.setItem('enlight_token', newToken);
    sessionStorage.setItem('enlight_employee', JSON.stringify(newEmployee));
    sessionStorage.removeItem('enlight_active_chat_session_id');
    sessionStorage.removeItem('enlight_viewing_as');
    sessionStorage.setItem('enlight_last_activity', String(Date.now()));
    setToken(newToken);
    setEmployee(newEmployee);
    setViewingAsState(null);
  };

  const logout = useCallback((reason: 'manual' | 'session_expired' = 'manual') => {
    postAuthLogout(reason);
    sessionStorage.removeItem('enlight_token');
    sessionStorage.removeItem('enlight_employee');
    sessionStorage.removeItem('enlight_viewing_as');
    sessionStorage.removeItem('enlight_active_chat_session_id');
    sessionStorage.removeItem('enlight_last_activity');
    setToken(null);
    setEmployee(null);
    setViewingAsState(null);
  }, []);

  useEffect(() => {
    if (!token) return;
    const idleMs = 30 * 60 * 1000;
    const key = 'enlight_last_activity';
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, String(Date.now()));
    let lastWrite = 0;
    const mark = () => {
      const now = Date.now();
      if (now - lastWrite < 15000) return;
      lastWrite = now;
      sessionStorage.setItem(key, String(now));
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((event) => window.addEventListener(event, mark, { passive: true }));
    const timer = window.setInterval(() => {
      const last = Number(sessionStorage.getItem(key) || Date.now());
      if (Date.now() - last >= idleMs) {
        logout('session_expired');
        window.location.href = '/login';
      }
    }, 15000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, mark));
      window.clearInterval(timer);
    };
  }, [token, logout]);
  const setViewingAs = (emp: Employee) => {
    sessionStorage.setItem('enlight_viewing_as', JSON.stringify(emp));
    sessionStorage.removeItem('enlight_active_chat_session_id');
    setViewingAsState(emp);
  };

  const clearViewingAs = () => {
    sessionStorage.removeItem('enlight_viewing_as');
    sessionStorage.removeItem('enlight_active_chat_session_id');
    setViewingAsState(null);
  };

  const isAdmin = employee?.role === 'admin';
  const isSalesManager =
    employee?.role === 'sales_manager' || employee?.role === 'manager';
  const isSalesperson = !isAdmin && !isSalesManager;

  // effectivePhone:
  // - If viewing someone specifically -> that person's phone
  // - If Salesperson -> their own phone
  // - If Admin / Sales Manager viewing their own account -> null (all / team aggregate)
  const effectivePhone = viewingAs
    ? viewingAs.phone || null
    : isSalesperson
      ? employee?.phone || null
      : null;

  const activeRole = viewingAs ? viewingAs.role : (employee?.role || 'salesperson');
  const activeMode =
    viewingAs?.mode ||
    (activeRole === 'salesperson' &&
    (viewingAs?.original_role === 'sales_manager' ||
      viewingAs?.original_role === 'manager' ||
      viewingAs?.original_role === 'admin' ||
      employee?.role === 'sales_manager' ||
      employee?.role === 'manager' ||
      employee?.role === 'admin')
      ? 'personal'
      : activeRole === 'sales_manager' || activeRole === 'manager'
        ? 'manager'
        : undefined);

  return (
    <AuthContext.Provider
      value={{
        token,
        employee,
        viewingAs,
        login,
        logout,
        setViewingAs,
        clearViewingAs,
        isAdmin,
        isSalesManager,
        isSalesperson,
        isAuthenticated: !!token && !!employee,
        effectivePhone,
        activeRole,
        activeMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
