import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
  logout: () => void;
  setViewingAs: (emp: Employee) => void;
  clearViewingAs: () => void;
  isAdmin: boolean;
  isSalesManager: boolean;
  isSalesperson: boolean;
  isProcurement: boolean;
  isAuthenticated: boolean;
  effectivePhone: string | null;
  activeRole: string;
  activeMode?: string;
  prototypeRole: 'admin' | 'salesperson' | 'procurement' | null;
  setPrototypeRole: (role: 'admin' | 'salesperson' | 'procurement' | null) => void;
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
  const [prototypeRole, setPrototypeRoleState] = useState<'admin' | 'salesperson' | 'procurement' | null>(() => {
    const saved = sessionStorage.getItem('enlight_prototype_role');
    return saved === 'admin' || saved === 'salesperson' || saved === 'procurement' ? saved : null;
  });

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/admin') {
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
    setToken(newToken);
    setEmployee(newEmployee);
    setViewingAsState(null);
  };

  const logout = () => {
    sessionStorage.removeItem('enlight_token');
    sessionStorage.removeItem('enlight_employee');
    sessionStorage.removeItem('enlight_viewing_as');
    sessionStorage.removeItem('enlight_active_chat_session_id');
    setToken(null);
    setEmployee(null);
    setViewingAsState(null);
  };

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

  const setPrototypeRole = (role: 'admin' | 'salesperson' | 'procurement' | null) => {
    if (role) sessionStorage.setItem('enlight_prototype_role', role);
    else sessionStorage.removeItem('enlight_prototype_role');
    setPrototypeRoleState(role);
  };

  const effectiveRole = prototypeRole || employee?.role;
  const isAdmin = effectiveRole === 'admin';
  const isSalesManager =
    !prototypeRole && (employee?.role === 'sales_manager' || employee?.role === 'manager');
  const isProcurement = effectiveRole === 'procurement';
  const isSalesperson = !isAdmin && !isSalesManager && !isProcurement;

  // effectivePhone:
  // - If viewing someone specifically -> that person's phone
  // - If Salesperson -> their own phone
  // - If Admin / Sales Manager viewing their own account -> null (all / team aggregate)
  const effectivePhone = viewingAs
    ? viewingAs.phone || null
    : isSalesperson
      ? employee?.phone || null
      : null;

  const activeRole = prototypeRole || (viewingAs ? viewingAs.role : (employee?.role || 'salesperson'));
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
        isProcurement,
        isAuthenticated: !!token && !!employee,
        effectivePhone,
        activeRole,
        activeMode,
        prototypeRole,
        setPrototypeRole,
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
