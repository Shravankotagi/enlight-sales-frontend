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
  Crown,
  Edit2,
  Check,
  Search,
} from 'lucide-react';
import ImportClientsModal from '../components/ImportClientsModal';
import { employeesApi } from '../lib/api';



interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  original_role?: string;
  mode?: string;
  is_active: boolean;
  manager_id?: string | null;
  manager_phone?: string | null;
}

interface EmployeeForm {
  id?: string;
  name: string;
  phone: string;
  email: string;
  role: string;
  employee_id: string;
  manager_id?: string;
  manager_phone?: string;
  is_active?: boolean;
}

type RoleFilter = 'all' | 'salesperson' | 'sales_manager' | 'admin';

export default function AdminSelectionPage() {
  const navigate = useNavigate();
  const {
    token,
    employee,
    logout,
    setViewingAs,
    clearViewingAs,
    isSalesManager,
    isAdmin,
  } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allManagers, setAllManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [form, setForm] = useState<EmployeeForm>({
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
    setError('');
    employeesApi
      .getAll()
      .then((res) => {
        const data = res?.data;
        const rawList = Array.isArray(data) ? data : data?.data || [];
        const activeList = rawList.filter((e: Employee) => e.is_active);

        // Filter managers for assignment dropdown
        const managers = activeList.filter(
          (e: Employee) => e.role === 'sales_manager' || e.role === 'manager',
        );
        setAllManagers(managers);

        // If Sales Manager: show only non-admin team members assigned to them
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
          // Admin sees all employees including other Admins, Sales Managers, and Salespersons
          setEmployees(activeList);
        }
      })
      .catch((err) => {
        console.error('Failed to load employees:', err);
        setError('Failed to load employees');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
  }, [token, isSalesManager, employee?.id]);

  const fetchNextId = async () => {
    try {
      const res = await employeesApi.getNextId();
      const data = res?.data?.data || res?.data;
      return (
        data?.next_employee_id ||
        data?.next_id ||
        (typeof data === 'string' ? data : 'EMP001')
      );
    } catch {
      return 'EMP001';
    }
  };

  const handleOpenAddModal = async () => {
    setIsEditMode(false);
    setFormError('');
    setFormSuccess('');
    const nextId = await fetchNextId();
    const cleanId =
      typeof nextId === 'string'
        ? nextId
        : nextId?.next_employee_id || 'EMP001';
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

  const handleOpenEditModal = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    setFormError('');
    setFormSuccess('');
    setForm({
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      email: emp.email || '',
      role: emp.role,
      employee_id: emp.employee_id,
      manager_id: emp.manager_id || '',
      manager_phone: emp.manager_phone || '',
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
      } else {
        payload.manager_id = null;
        payload.manager_phone = null;
      }

      if (isEditMode && form.id) {
        await employeesApi.update(form.id, payload);
      } else {
        await employeesApi.create(payload);
      }

      const roleDisplay =
        form.role === 'admin'
          ? 'Admin'
          : form.role === 'sales_manager'
            ? 'Sales Manager'
            : 'Salesperson';

      setFormSuccess(
        isEditMode
          ? `${form.name} (${roleDisplay}) updated successfully!`
          : `${roleDisplay} ${form.name} created successfully! They can now log in using WhatsApp OTP.`,
      );
      fetchEmployees();

      setTimeout(() => {
        handleCloseModal();
      }, 1800);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!form.id) return;
    const confirmMsg = `Are you sure you want to deactivate ${form.name}? They will no longer be able to log in.`;
    if (!window.confirm(confirmMsg)) return;

    setFormLoading(true);
    try {
      await employeesApi.deactivate(form.id);
      setFormSuccess(`${form.name} deactivated successfully.`);
      fetchEmployees();
      setTimeout(() => {
        handleCloseModal();
      }, 1500);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSelect = (emp: Employee) => {
    if (emp.role === 'admin') {
      // For Admin account selection: clear viewingAs to open full company-wide dashboard
      clearViewingAs();
      navigate('/home');
      return;
    }
    setViewingAs(emp);
    navigate('/home');
  };

  const handleViewTeamAggregate = () => {
    clearViewingAs();
    navigate('/home');
  };

  const handleViewPersonalDashboard = () => {
    if (!employee) return;
    setViewingAs({
      ...employee,
      role: 'salesperson',
    });
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
    : `Executive employee & admin account management · ${employee?.name}`;

  // Filter accounts based on search query and role filter
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.phone.includes(searchQuery) ||
      (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (roleFilter === 'all') return true;
    if (roleFilter === 'admin') return emp.role === 'admin';
    if (roleFilter === 'sales_manager')
      return emp.role === 'sales_manager' || emp.role === 'manager';
    if (roleFilter === 'salesperson')
      return emp.role !== 'admin' && emp.role !== 'sales_manager' && emp.role !== 'manager';
    return true;
  });

  const adminCount = employees.filter((e) => e.role === 'admin').length;
  const managerCount = employees.filter(
    (e) => e.role === 'sales_manager' || e.role === 'manager',
  ).length;
  const salespersonCount = employees.filter(
    (e) => e.role !== 'admin' && e.role !== 'sales_manager' && e.role !== 'manager',
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>{pageTitle}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isSalesManager
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {isSalesManager ? 'Sales Manager' : 'Admin'}
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">{pageSubtitle}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-600 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50/50 transition-all text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xs self-start sm:self-auto cursor-pointer"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>

        {/* Action Header & Filter Controls */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  isSalesManager
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}
              >
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isSalesManager
                    ? 'My Assigned Sales Team'
                    : 'Team & Admin Accounts'}
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  {isSalesManager
                    ? 'Click any team member to view their dashboard or view aggregate'
                    : 'Select any account to view dashboard, or manage permissions'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {isSalesManager && (
                <>
                  <button
                    onClick={handleViewPersonalDashboard}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <UserCheck size={15} />
                    My Dashboard
                  </button>
                  <button
                    onClick={handleViewTeamAggregate}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <LayoutDashboard size={15} />
                    View Team Aggregate Dashboard
                  </button>
                </>
              )}

              {isAdmin && (
                <>
                  <button
                    onClick={() => navigate('/admin-dashboard')}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    <ShieldAlert size={15} className="text-blue-600" />
                    Admin Overview
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    Import Clients
                  </button>
                  <button
                    onClick={handleOpenAddModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                  >
                    <UserPlus size={15} />
                    Add Employee / Admin
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search and Role Filter Tabs (for Admin) */}
          {isAdmin && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Role filter buttons */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 overflow-x-auto">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === 'all'
                      ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({employees.length})
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === 'admin'
                      ? 'bg-white text-amber-700 shadow-xs border border-amber-200/60'
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  <Crown size={12} className={roleFilter === 'admin' ? 'text-amber-500' : ''} />
                  Admins ({adminCount})
                </button>
                <button
                  onClick={() => setRoleFilter('sales_manager')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === 'sales_manager'
                      ? 'bg-white text-indigo-600 shadow-xs border border-indigo-200/60'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  Managers ({managerCount})
                </button>
                <button
                  onClick={() => setRoleFilter('salesperson')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === 'salesperson'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sales Team ({salespersonCount})
                </button>
              </div>

              {/* Search bar */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, phone..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Employee / Admin List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : error ? (
          <div className="text-rose-700 text-center py-10 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold">
            {error}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
            <Users size={48} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-800 font-bold text-sm">
              {isSalesManager
                ? 'No salespersons assigned to your team yet'
                : 'No matching accounts found'}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              {isSalesManager
                ? 'Contact an administrator to assign sales team members under your guidance.'
                : 'Click "Add Employee / Admin" to create new accounts.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredEmployees.map((emp) => {
              const isEmpAdmin = emp.role === 'admin';
              const isMgr =
                emp.role === 'sales_manager' || emp.role === 'manager';
              const assignedMgr = allManagers.find(
                (m) =>
                  m.id === emp.manager_id ||
                  m.phone?.replace(/\D/g, '').slice(-10) ===
                    emp.manager_phone?.replace(/\D/g, '').slice(-10),
              );

              return (
                <div
                  key={emp.id}
                  onClick={() => handleSelect(emp)}
                  className={`w-full bg-white hover:bg-slate-50/80 border rounded-2xl p-4.5 text-left transition-all group shadow-2xs hover:shadow-md cursor-pointer flex items-center justify-between gap-4 ${
                    isEmpAdmin
                      ? 'border-amber-200/90 hover:border-amber-300'
                      : isMgr
                        ? 'border-indigo-200/90 hover:border-indigo-300'
                        : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${
                        isEmpAdmin
                          ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                          : isMgr
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                            : 'bg-gradient-to-br from-blue-600 to-cyan-600'
                      }`}
                    >
                      {isEmpAdmin ? (
                        <Crown size={18} />
                      ) : (
                        emp.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate">
                          {emp.name}
                        </p>
                        {emp.id === employee?.id && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                            You
                          </span>
                        )}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            isEmpAdmin
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : isMgr
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isEmpAdmin ? (
                            <>
                              <Crown size={11} className="text-amber-600" /> Admin
                            </>
                          ) : isMgr ? (
                            'Sales Manager'
                          ) : (
                            'Salesperson'
                          )}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1 font-mono">
                        {emp.employee_id} · +{emp.phone}
                        {emp.email ? ` · ${emp.email}` : ''}
                      </p>
                      {isAdmin && assignedMgr && (
                        <p className="text-indigo-600 text-xs mt-1 flex items-center gap-1 font-medium">
                          <UserCheck size={13} className="text-indigo-500" />
                          Reporting to:{' '}
                          <span className="font-bold text-indigo-900">
                            {assignedMgr.name}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAdmin && (
                      <button
                        onClick={(e) => handleOpenEditModal(emp, e)}
                        title="Edit Account Details"
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    <div className="hidden sm:flex items-center gap-1 text-slate-500 group-hover:text-blue-600 transition-colors text-xs font-bold pl-2">
                      <span>{isEmpAdmin ? 'Company Overview' : 'View Dashboard'}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Account Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 border border-slate-200 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Edit2 size={18} className="text-blue-600" />
                    Edit Account
                  </>
                ) : (
                  <>
                    <UserPlus size={18} className="text-blue-600" />
                    Add New Employee / Admin
                  </>
                )}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Success Message */}
            {formSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check size={16} className="text-emerald-600 shrink-0" /> {formSuccess}
              </div>
            )}

            {/* Form Fields */}
            {!formSuccess && (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    WhatsApp Number <span className="text-rose-500">*</span>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                  />
                  <p className="text-slate-400 text-[11px] mt-1">
                    12 digits starting with 91 (e.g. 919876543210)
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email <span className="text-slate-400 text-xs font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="rahul@enlightmetals.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Role &amp; Permissions <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="salesperson">Salesperson (Standard Access)</option>
                    <option value="sales_manager">Sales Manager (Team Scoped Access)</option>
                    <option value="admin">Admin (Full Company Access &amp; Management)</option>
                  </select>
                </div>

                {/* Notice for Admin role */}
                {form.role === 'admin' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                    <Crown size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      <strong>Admin Privileges:</strong> This account will have full company-wide visibility, access to all module dashboards, staff creation, client imports, and settings.
                    </span>
                  </div>
                )}

                {/* Manager Assignment (only when role is salesperson) */}
                {form.role === 'salesperson' && allManagers.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Assigned Sales Manager{' '}
                      <span className="text-slate-400 text-xs font-normal">(optional)</span>
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
                      className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
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
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Employee ID <span className="text-rose-500">*</span>
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
                    className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono font-bold"
                  />
                  <p className="text-slate-400 text-[11px] mt-1">
                    Auto-generated identifier
                  </p>
                </div>

                {/* Error */}
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                    {formError}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  {isEditMode && form.id !== employee?.id && (
                    <button
                      type="button"
                      onClick={handleDeactivate}
                      disabled={formLoading}
                      className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Deactivate
                    </button>
                  )}
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={formLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {formLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </>
                    ) : isEditMode ? (
                      'Save Changes'
                    ) : (
                      'Create Account'
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
