import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { rolesApi, postAuthLogout } from '../lib/api';
import { DEFAULT_ROLE_TEMPLATES } from '../utils/aclConstants';

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
  isProcurement: boolean;
  isProcurementManager: boolean;
  isProcurementPerson: boolean;
  isAuthenticated: boolean;
  effectivePhone: string | null;
  activeRole: string;
  activeMode?: string;
  can: (key: string) => boolean;
  guardAction: (key: string) => boolean;
  roleName?: string;
  dataScope: 'own' | 'team' | 'all';
  permissions: Record<string, boolean>;
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
  const [access, setAccess] = useState<{
    permissions: Record<string, boolean>;
    dataScope: 'own' | 'team' | 'all';
    roleName?: string;
  } | null>(() => {
    const saved = sessionStorage.getItem('enlight_access');
    return saved ? JSON.parse(saved) : null;
  });
  const [prototypeRole, setPrototypeRoleState] = useState<'admin' | 'salesperson' | 'procurement' | null>(() => {
    const saved = sessionStorage.getItem('enlight_prototype_role');
    return saved === 'admin' || saved === 'salesperson' || saved === 'procurement' ? saved : null;
  });

  const refreshAccess = useCallback(async () => {
    if (!sessionStorage.getItem('enlight_token')) return;
    try {
      const res = await rolesApi.me();
      const meData = res?.data;
      if (meData) {
        if (meData.role) {
          setEmployee((prev) => {
            if (!prev) return prev;
            if (prev.role === meData.role && prev.name === meData.name) return prev;
            const updated = {
              ...prev,
              role: meData.role,
              name: meData.name || prev.name,
              phone: meData.phone || prev.phone,
            };
            sessionStorage.setItem('enlight_employee', JSON.stringify(updated));
            return updated;
          });
        }
        const roleId =
          meData.role === 'manager' ? 'sales_manager' : meData.role || 'salesperson';
        const template =
          DEFAULT_ROLE_TEMPLATES[roleId] || DEFAULT_ROLE_TEMPLATES.salesperson;
        const fallbackScope: 'own' | 'team' | 'all' =
          roleId === 'admin' ? 'all' : roleId === 'sales_manager' ? 'team' : 'own';
        const next = {
          permissions: meData.permissions || template,
          dataScope: (meData.dataScope || fallbackScope) as 'own' | 'team' | 'all',
          roleName: meData.roleName,
        };
        sessionStorage.setItem('enlight_access', JSON.stringify(next));
        setAccess(next);
      }
    } catch (err: any) {
      if (err?.response?.status === 401) return;
      const roleId =
        employee?.role === 'manager' ? 'sales_manager' : employee?.role || 'salesperson';
      const template =
        DEFAULT_ROLE_TEMPLATES[roleId] || DEFAULT_ROLE_TEMPLATES.salesperson;
      const fallbackScope: 'own' | 'team' | 'all' =
        roleId === 'admin' ? 'all' : roleId === 'sales_manager' ? 'team' : 'own';
      setAccess((current) => {
        if (current?.permissions) return current;
        const cached = sessionStorage.getItem('enlight_access');
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {
            /* use template */
          }
        }
        return { permissions: template, dataScope: fallbackScope, roleName: roleId };
      });
    }
  }, [employee?.role]);

  useEffect(() => {
    if (!token) return;
    refreshAccess();
    const onFocus = () => refreshAccess();
    const onStale = () => refreshAccess();
    window.addEventListener('focus', onFocus);
    window.addEventListener('enlight_permissions_stale', onStale);
    const timer = window.setInterval(refreshAccess, 15_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('enlight_permissions_stale', onStale);
      window.clearInterval(timer);
    };
  }, [token, refreshAccess]);

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
    sessionStorage.removeItem('enlight_access');
    sessionStorage.setItem('enlight_last_activity', String(Date.now()));
    setToken(newToken);
    setEmployee(newEmployee);
    setAccess(null);
    setViewingAsState(null);
  };

  const logout = useCallback((reason: 'manual' | 'session_expired' = 'manual') => {
    postAuthLogout(reason);
    sessionStorage.removeItem('enlight_token');
    sessionStorage.removeItem('enlight_employee');
    sessionStorage.removeItem('enlight_viewing_as');
    sessionStorage.removeItem('enlight_access');
    sessionStorage.removeItem('enlight_active_chat_session_id');
    sessionStorage.removeItem('enlight_last_activity');
    setToken(null);
    setEmployee(null);
    setAccess(null);
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

  const setPrototypeRole = (role: 'admin' | 'salesperson' | 'procurement' | null) => {
    if (role) sessionStorage.setItem('enlight_prototype_role', role);
    else sessionStorage.removeItem('enlight_prototype_role');
    setPrototypeRoleState(role);
  };

  const roleId =
    employee?.role === 'manager' ? 'sales_manager' : employee?.role || 'salesperson';
  const loadedPermissions = access?.permissions;
  const permissions =
    loadedPermissions && Object.keys(loadedPermissions).length > 0
      ? loadedPermissions
      : DEFAULT_ROLE_TEMPLATES[roleId] || DEFAULT_ROLE_TEMPLATES.salesperson;
  const dataScope: 'own' | 'team' | 'all' =
    access?.dataScope ||
    (roleId === 'admin' ? 'all' : roleId === 'sales_manager' ? 'team' : 'own');
  const can = (key: string) => permissions?.[key] === true;
  const guardAction = (key: string) => {
    if (can(key)) return true;
    toast.error('This feature is disabled for this role. Contact your admin.');
    return false;
  };

  const isAdmin = can('staff.manage_acl') || employee?.role === 'admin' || employee?.role === 'super_admin';
  const isSalesManager =
    dataScope === 'team' ||
    employee?.role === 'sales_manager' ||
    employee?.role === 'manager';
  const isProcurementManager = employee?.role === 'procurement_manager';
  const isProcurementPerson = employee?.role === 'procurement_person';
  const isProcurement = isProcurementManager || isProcurementPerson;
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
        isProcurement,
        isProcurementManager,
        isProcurementPerson,
        isAuthenticated: !!token && !!employee,
        effectivePhone,
        activeRole,
        activeMode,
        can,
        guardAction,
        dataScope,
        permissions,
        roleName: access?.roleName || employee?.role,
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
