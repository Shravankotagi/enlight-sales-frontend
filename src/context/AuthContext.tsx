import { createContext, useContext, useState, type ReactNode } from 'react';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  role: string;
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
  isAuthenticated: boolean;
  effectivePhone: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('enlight_token')
  );
  const [employee, setEmployee] = useState<Employee | null>(() => {
    const saved = localStorage.getItem('enlight_employee');
    return saved ? JSON.parse(saved) : null;
  });
  const [viewingAs, setViewingAsState] = useState<Employee | null>(() => {
    const saved = localStorage.getItem('enlight_viewing_as');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (newToken: string, newEmployee: Employee) => {
    localStorage.setItem('enlight_token', newToken);
    localStorage.setItem('enlight_employee', JSON.stringify(newEmployee));
    setToken(newToken);
    setEmployee(newEmployee);
  };

  const logout = () => {
    localStorage.removeItem('enlight_token');
    localStorage.removeItem('enlight_employee');
    localStorage.removeItem('enlight_viewing_as');
    setToken(null);
    setEmployee(null);
    setViewingAsState(null);
  };

  const setViewingAs = (emp: Employee) => {
    localStorage.setItem('enlight_viewing_as', JSON.stringify(emp));
    setViewingAsState(emp);
  };

  const clearViewingAs = () => {
    localStorage.removeItem('enlight_viewing_as');
    setViewingAsState(null);
  };

  // effectivePhone: for salesperson = their own phone
  // for admin viewing someone = that person's phone
  // for admin not viewing anyone = null (sees all)
  const effectivePhone =
    employee?.role === 'admin'
      ? viewingAs?.phone || null
      : employee?.phone || null;

  return (
    <AuthContext.Provider value={{
      token,
      employee,
      viewingAs,
      login,
      logout,
      setViewingAs,
      clearViewingAs,
      isAdmin: employee?.role === 'admin',
      isAuthenticated: !!token && !!employee,
      effectivePhone,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
