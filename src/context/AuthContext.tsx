import { createContext, useContext, useState, type ReactNode } from 'react';

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  role: string;
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
  isAuthenticated: boolean;
  effectivePhone: string | null;
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

  const login = (newToken: string, newEmployee: Employee) => {
    sessionStorage.setItem('enlight_token', newToken);
    sessionStorage.setItem('enlight_employee', JSON.stringify(newEmployee));
    setToken(newToken);
    setEmployee(newEmployee);
  };

  const logout = () => {
    sessionStorage.removeItem('enlight_token');
    sessionStorage.removeItem('enlight_employee');
    sessionStorage.removeItem('enlight_viewing_as');
    setToken(null);
    setEmployee(null);
    setViewingAsState(null);
  };

  const setViewingAs = (emp: Employee) => {
    sessionStorage.setItem('enlight_viewing_as', JSON.stringify(emp));
    setViewingAsState(emp);
  };

  const clearViewingAs = () => {
    sessionStorage.removeItem('enlight_viewing_as');
    setViewingAsState(null);
  };

  const isAdmin = employee?.role === 'admin';
  const isSalesManager =
    employee?.role === 'sales_manager' || employee?.role === 'manager';
  const isSalesperson = !isAdmin && !isSalesManager;

  // effectivePhone:
  // - Salesperson: their own phone
  // - Admin / Sales Manager: if viewing someone specifically -> that person's phone; if not -> null (views all / team aggregate)
  const effectivePhone =
    isAdmin || isSalesManager
      ? viewingAs?.phone || null
      : employee?.phone || null;

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
