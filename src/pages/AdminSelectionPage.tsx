import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  LogOut,
  Loader2,
  UserPlus,
  X,
  ShieldAlert,
  FileSpreadsheet,
  LayoutDashboard,
  UserCheck,
} from 'lucide-react';
import ImportClientsModal from '../components/ImportClientsModal';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');
const defaultBackend = isLocal
  ? 'http://localhost:3000'
  : 'https://enlight-sales-backend-production.up.railway.app';
const rawBackend = import.meta.env.VITE_BACKEND_URL || defaultBackend;
const BACKEND = rawBackend.replace(/\/+$/, '');

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  is_active: boolean;
  manager_id?: string | null;
  manager_phone?: string | null;
}

interface AddEmployeeForm {
  name: string;
  phone: string;
  email: string;
  role: string;
  employee_id: string;
  manager_id?: string;
  manager_phone?: string;
}

export default function AdminSelectionPage() {
  const navigate = useNavigate();
  const { token, employee, logout, setViewingAs, clearViewingAs, isSalesManager, isAdmin } =
    useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allManagers, setAllManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [form, setForm] = useState<AddEmployeeForm>({
    name: '',
    phone: '91',
    email: '',
    role: 'salesperson',
    employee_id: '',
    manager_id: '',
    manager_phone: '',
  });

  const fetchEmployees = () => {
    setLoading(true);
    fetch(`${BACKEND}/employees`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const rawList = Array.isArray(data) ? data : data.data || [];
        const activeList = rawList.filter((e: Employee) => e.is_active);

        // Filter managers for assignment dropdown in Admin mode
        const managers = activeList.filter(
          (e: Employee) => e.role === 'sales_manager' || e.role === 'manager',
        );
        setAllManagers(managers);

        // If Sales Manager: show only non-admin team members (excluding self in the list if desired, or showing team)
        if (isSalesManager) {
          const team = activeList.filter(
            (e: Employee) =>
              e.role !== 'admin' &&
              (e.manager_id === employee?.id ||
                e.manager_phone?.replace(/\D/g, '').slice(-10) ===
                  employee?.phone?.replace(/\D/g, '').slice(-10)),
          );
          setEmployees(team);
        } else {
          // Admin sees all active non-admin employees (or all salespersons and managers)
          const salespersons = activeList.filter(
            (e: Employee) => e.role !== 'admin',
          );
          setEmployees(salespersons);
        }
      })
      .catch(() => setError('Failed to load employees'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
  }, [token, isSalesManager, employee?.id]);

  const fetchNextId = async () => {
    try {
      const res = await fetch(`${BACKEND}/employees/next-id`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return (
        data.data?.next_employee_id ||
        data.next_employee_id ||
        data.data?.next_id ||
        (typeof data.data === 'string' ? data.data : 'EMP005')
      );
    } catch {
      return 'EMP005';
    }
  };

  const handleOpenModal = async () => {
    setFormError('');
    setFormSuccess('');
    const nextId = await fetchNextId();
    const cleanId =
      typeof nextId === 'string'
        ? nextId
        : nextId?.next_employee_id || 'EMP005';
    setForm({
      name: '',
      phone: '91',
      email: '',
      role: 'salesperson',
      employee_id: cleanId,
      manager_id: '',
      manager_phone: '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormError('');
    setFormSuccess('');
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Name is required';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 12 || !phoneDigits.startsWith('91')) {
      return 'Phone must be 12 digits starting with 91 (e.g. 919876543210)';
    }
    if (!form.employee_id.trim()) return 'Employee ID is required';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ''),
        role: form.role,
        employee_id: form.employee_id.trim(),
      };
      if (form.email.trim()) {
        payload.email = form.email.trim();
      }
      if (form.role === 'salesperson' && form.manager_id) {
        payload.manager_id = form.manager_id;
        const selectedMgr = allManagers.find((m) => m.id === form.manager_id);
        if (selectedMgr) payload.manager_phone = selectedMgr.phone;
      }

      const res = await fetch(`${BACKEND}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || data.message || 'Failed to add employee',
        );
      }

      setFormSuccess(
        `${form.name} added successfully! They can now login with their phone number.`,
      );
      fetchEmployees();

      // Auto close after 2 seconds
      setTimeout(() => {
        handleCloseModal();
      }, 2000);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSelect = (emp: Employee) => {
    setViewingAs(emp);
    navigate('/home');
  };

  const handleViewTeamAggregate = () => {
    clearViewingAs();
    navigate('/home');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pageTitle = isSalesManager
    ? 'Sales Manager Portal'
    : 'Admin Control Center';
  const pageSubtitle = isSalesManager
    ? `Manage and monitor your assigned sales team · ${employee?.name}`
    : `Executive employee management and dashboard control · ${employee?.name}`;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>{pageTitle}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                  isSalesManager
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {isSalesManager ? 'Sales Manager' : 'Admin'}
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">{pageSubtitle}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-slate-800"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isSalesManager ? 'bg-indigo-600' : 'bg-blue-600'
              }`}
            >
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isSalesManager ? 'My Assigned Sales Team' : 'Select Salesperson / Manager'}
              </h2>
              <p className="text-slate-400 text-xs">
                {isSalesManager
                  ? 'Click any team member to view their individual metrics, or view aggregate'
                  : 'Click on an employee to view their individual dashboard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isSalesManager && (
              <button
                onClick={handleViewTeamAggregate}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                <LayoutDashboard size={16} />
                View Team Aggregate Dashboard
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/admin-dashboard')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <ShieldAlert size={16} className="text-blue-400" />
                  Go to Admin Dashboard
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <FileSpreadsheet size={16} />
                  Import Clients
                </button>
                <button
                  onClick={handleOpenModal}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <UserPlus size={16} />
                  Add Employee
                </button>
              </>
            )}
          </div>
        </div>

        {/* Employee List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-400" size={32} />
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-10 bg-red-500/10 border border-red-500/20 rounded-xl">
            {error}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/50 border border-slate-800 rounded-2xl p-8">
            <Users size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-semibold">
              {isSalesManager
                ? 'No salespersons assigned to your team yet'
                : 'No salespersons added yet'}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {isSalesManager
                ? 'Contact an administrator to assign sales team members under your guidance.'
                : 'Click "Add Employee" to create sales managers and salespersons.'}
            </p>
            {isSalesManager && (
              <button
                onClick={handleViewTeamAggregate}
                className="mt-4 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                <LayoutDashboard size={16} />
                Open My Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {employees.map((emp) => {
              const isMgr =
                emp.role === 'sales_manager' || emp.role === 'manager';
              const assignedMgr = allManagers.find(
                (m) =>
                  m.id === emp.manager_id ||
                  m.phone?.replace(/\D/g, '').slice(-10) ===
                    emp.manager_phone?.replace(/\D/g, '').slice(-10),
              );

              return (
                <button
                  key={emp.id}
                  onClick={() => handleSelect(emp)}
                  className="w-full bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 hover:border-blue-500/80 rounded-xl p-4 text-left transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs ${
                          isMgr ? 'bg-indigo-600' : 'bg-blue-600'
                        }`}
                      >
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-semibold">{emp.name}</p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              isMgr
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {isMgr ? 'Sales Manager' : 'Salesperson'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {emp.employee_id} · +{emp.phone}
                          {emp.email ? ` · ${emp.email}` : ''}
                        </p>
                        {isAdmin && assignedMgr && (
                          <p className="text-indigo-400 text-xs mt-1 flex items-center gap-1">
                            <UserCheck size={12} />
                            Reporting to: <span className="font-semibold">{assignedMgr.name}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 group-hover:text-blue-400 transition-colors text-sm font-medium">
                      <span>View Dashboard</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-700 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Add New Employee</h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Success Message */}
            {formSuccess && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                ✅ {formSuccess}
              </div>
            )}

            {/* Form Fields */}
            {!formSuccess && (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    WhatsApp Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        phone: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="919876543210"
                    maxLength={12}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    12 digits starting with 91 (e.g. 919876543210)
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Email <span className="text-slate-500 text-xs">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="rahul@enlightmetals.com"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="salesperson">Salesperson</option>
                    <option value="sales_manager">Sales Manager</option>
                  </select>
                </div>

                {/* Manager Assignment (only when adding a salesperson) */}
                {form.role === 'salesperson' && allManagers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Assigned Sales Manager <span className="text-slate-500 text-xs">(optional)</span>
                    </label>
                    <select
                      value={form.manager_id || ''}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          manager_id: e.target.value,
                          manager_phone:
                            allManagers.find((m) => m.id === e.target.value)
                              ?.phone || '',
                        }))
                      }
                      className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- None (Direct to Admin) --</option>
                      {allManagers.map((mgr) => (
                        <option key={mgr.id} value={mgr.id}>
                          {mgr.name} ({mgr.employee_id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Employee ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Employee ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.employee_id}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        employee_id: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="EMP001"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Auto-generated - edit if needed
                  </p>
                </div>

                {/* Error */}
                {formError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {formError}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={formLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {formLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Adding...
                      </>
                    ) : (
                      'Save Employee'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Clients Modal */}
      <ImportClientsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        salespeople={employees.map((e) => ({
          name: e.name,
          phone: e.phone,
          employee_id: e.employee_id,
        }))}
      />
    </div>
  );
}
