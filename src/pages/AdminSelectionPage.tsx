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
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Building2,
  Table,
  LayoutGrid,
  RefreshCw,
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
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

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
          const myPhone10 = employee?.phone?.replace(/\D/g, '').slice(-10);
          const team = activeList.filter(
            (e: Employee) =>
              e.role !== 'admin' &&
              (e.manager_id === employee?.id ||
                (myPhone10 &&
                  e.manager_phone?.replace(/\D/g, '').slice(-10) === myPhone10)),
          );
          setEmployees(team);
        } else {
          // Admin sees every employee, including deactivated accounts.
          setEmployees(rawList);
        }
      })
      .catch((err) => {
        console.error('Failed to load employees:', err);
        setError('Failed to load employees');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Admin Control Center must always render from Admin's own identity and scope.
    // Clear any lingering impersonation session so no previous salesperson data bleeds in.
    clearViewingAs();
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

    const matchedMgrId =
      emp.manager_id ||
      allManagers.find(
        (m) =>
          emp.manager_phone &&
          m.phone.replace(/\D/g, '').slice(-10) ===
            emp.manager_phone.replace(/\D/g, '').slice(-10),
      )?.id ||
      '';

    setForm({
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      email: emp.email || '',
      role: emp.role,
      employee_id: emp.employee_id,
      manager_id: matchedMgrId,
      manager_phone: emp.manager_phone || '',
      is_active: emp.is_active !== false,
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
      setFormError(extractErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const extractErrorMessage = (err: any): string => {
    const serverMsg =
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      'An unexpected error occurred.';

    const lower = typeof serverMsg === 'string' ? serverMsg.toLowerCase() : '';

    if (
      lower.includes('employees_phone_key') ||
      (lower.includes('phone') &&
        (lower.includes('already exists') ||
          lower.includes('duplicate') ||
          lower.includes('assigned to someone else') ||
          lower.includes('already registered') ||
          lower.includes('unique')))
    ) {
      return 'This phone number is already assigned to someone else. Please use a different phone number.';
    }

    if (
      lower.includes('employees_employee_id_key') ||
      (lower.includes('employee_id') &&
        (lower.includes('already exists') ||
          lower.includes('duplicate') ||
          lower.includes('already registered') ||
          lower.includes('in use')))
    ) {
      return 'This Employee ID is already in use. Please enter a different Employee ID.';
    }

    if (
      lower.includes('employees_email_key') ||
      (lower.includes('email') &&
        (lower.includes('already exists') ||
          lower.includes('duplicate') ||
          lower.includes('already registered')))
    ) {
      return 'This email address is already assigned to someone else.';
    }

    return typeof serverMsg === 'string'
      ? serverMsg
      : 'An unexpected error occurred while saving.';
  };

  const handleDeactivate = async () => {
    if (!form.id) return;
    const turningOn = form.is_active === false;
    const confirmMsg = turningOn
      ? `Activate ${form.name}? They will be able to log in again.`
      : `Are you sure you want to deactivate ${form.name}? They will no longer be able to log in.`;
    if (!window.confirm(confirmMsg)) return;

    setFormLoading(true);
    try {
      if (turningOn) {
        await employeesApi.update(form.id, { is_active: true });
        setFormSuccess(`${form.name} activated successfully.`);
      } else {
        await employeesApi.deactivate(form.id);
        setFormSuccess(`${form.name} deactivated successfully.`);
      }
      fetchEmployees();
      setTimeout(() => {
        handleCloseModal();
      }, 1500);
    } catch (err: any) {
      setFormError(extractErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleSelect = (emp: Employee) => {
    if (emp.role === 'admin') {
      // For Admin account selection: open full Admin Dashboard of Dhananjay (img3)
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
      original_role: employee.role,
      mode: 'personal',
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

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className={isAdmin ? 'space-y-6 animate-fade-in pb-12 font-sans text-slate-900' : 'min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 font-sans text-slate-900 pb-16'}>
      <div className={isAdmin ? 'space-y-6' : 'max-w-7xl mx-auto space-y-6'}>
        {/* Top Executive Header Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                {isSalesManager ? <Users size={26} /> : <ShieldAlert size={26} />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {pageTitle}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} /> {isAdmin ? 'Super Admin System Authority' : 'Assigned Team Authority'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {pageSubtitle}
                </p>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium flex-wrap">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{todayStr}</span>
                  <span className="text-slate-300">·</span>
                  <span>
                    Signed in as <strong className="text-slate-700">{employee?.name}</strong> ({employee?.employee_id})
                  </span>
                </p>
              </div>
            </div>

            {/* Action Header Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
              <button
                onClick={fetchEmployees}
                title="Refresh Directory Data"
                className="h-9 w-9 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer shrink-0"
              >
                <RefreshCw size={15} />
              </button>

              {isSalesManager && (
                <>
                  <button
                    onClick={handleViewPersonalDashboard}
                    className="h-9 flex items-center gap-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <UserCheck size={15} />
                    <span>My Dashboard</span>
                  </button>
                  <button
                    onClick={handleViewTeamAggregate}
                    className="h-9 flex items-center gap-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    <LayoutDashboard size={15} />
                    <span>Team Aggregate</span>
                  </button>
                </>
              )}

              {isAdmin && (
                <>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="h-9 flex items-center gap-2 px-3.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Import clients via CSV"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-600" />
                    <span className="hidden sm:inline">Import Clients</span>
                  </button>
                  <button
                    onClick={handleOpenAddModal}
                    className="h-9 flex items-center gap-2 px-3.5 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Add a new employee or administrator"
                  >
                    <UserPlus size={15} className="text-indigo-600" />
                    <span>Add Member</span>
                  </button>
                </>
              )}

              <button
                onClick={handleLogout}
                className="h-9 flex items-center gap-1.5 px-3 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0"
                title="Sign out"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Executive KPI Stat Cards (Matching Admin & Home Dashboards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Accounts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                TOTAL TEAM ACCOUNTS
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {employees.length}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 size={11} /> 100% Active Staff
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Field Sales Reps */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                FIELD SALES REPS
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {salespersonCount}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200">
                  Direct Quota Reps
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Managers & Leads */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                MANAGERS &amp; LEADS
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 size={18} />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {managerCount}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                  Assigned Team Leads
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Executive Admins */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                SYSTEM ADMINISTRATORS
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Crown size={18} />
              </div>
            </div>
            <div className="mt-3">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {adminCount}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                  Root Company Access
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Launch Banners (Personal Workspace vs Company Overview) */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Banner 1: Personal Salesperson Workspace */}
            <div
              onClick={handleViewPersonalDashboard}
              className="bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                    <UserCheck size={14} /> Personal Workspace
                  </span>
                  <span className="text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Open Workspace <ArrowRight size={13} />
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  My Salesperson Dashboard
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Direct view into Dhananjay's personal inquiries, won orders (470+ MT), personal deal pipeline, and individual customer accounts.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="text-slate-400">Scoped strictly to personal accounts</span>
                <span className="font-bold text-blue-600">Launch My View →</span>
              </div>
            </div>

            {/* Banner 2: Enterprise Admin Overview */}
            <div
              onClick={() => {
                clearViewingAs();
                navigate('/reports');
              }}
              className="bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <ShieldAlert size={14} /> Executive Intelligence
                  </span>
                  <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Open Analytics <ArrowRight size={13} />
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Company-Wide Admin Overview
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Aggregated executive view covering all 13 sales representatives, total delivered tonnage (4,992+ MT), review queues, and company-wide won orders.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="text-slate-400">Company-wide aggregated metrics</span>
                <span className="font-bold text-indigo-600">Launch Analytics →</span>
              </div>
            </div>
          </div>
        )}

        {/* Directory Management Console */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Card Header & Toolbar */}
          <div className="p-5 border-b border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Team &amp; Account Directory</span>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    {filteredEmployees.length} of {employees.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any row to switch session, or use the action buttons to manage account access.
                </p>
              </div>

              {/* View Mode Switcher (Table vs Grid) */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Switch to High-Density Table View"
                >
                  <Table size={13} />
                  <span>Table View</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white text-blue-600 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Switch to Card Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Card Grid</span>
                </button>
              </div>
            </div>

            {/* Filter Pills & Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              {isAdmin && (
                <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 overflow-x-auto scrollbar-none">
                  <button
                    onClick={() => setRoleFilter('all')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      roleFilter === 'all'
                        ? 'bg-white text-blue-600 shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>All</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-700 font-extrabold">
                      {employees.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setRoleFilter('admin')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      roleFilter === 'admin'
                        ? 'bg-white text-amber-800 shadow-2xs border border-amber-200'
                        : 'text-slate-600 hover:text-amber-800'
                    }`}
                  >
                    <Crown size={12} className={roleFilter === 'admin' ? 'text-amber-500' : 'text-slate-400'} />
                    <span>Admins</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-extrabold">
                      {adminCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setRoleFilter('sales_manager')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      roleFilter === 'sales_manager'
                        ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-200'
                        : 'text-slate-600 hover:text-indigo-700'
                    }`}
                  >
                    <span>Managers</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-extrabold">
                      {managerCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setRoleFilter('salesperson')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      roleFilter === 'salesperson'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Sales Team</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800 font-extrabold">
                      {salespersonCount}
                    </span>
                  </button>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, phone, email..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Directory Content: Loading, Error, Empty, Table or Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-slate-500 text-xs font-semibold">
                Loading employee directory...
              </p>
            </div>
          ) : error ? (
            <div className="text-rose-700 text-center py-12 bg-rose-50 border-t border-rose-200 text-xs font-semibold">
              {error}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 p-8">
              <Users size={44} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-800 font-bold text-sm">
                No matching accounts found
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Try adjusting your search criteria or role filters.
              </p>
            </div>
          ) : viewMode === 'table' ? (
            /* High-Density Enterprise Table View */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 sm:px-6">Member &amp; ID</th>
                    <th className="py-3 px-4">Role &amp; Scope</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Hierarchy / Reports To</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredEmployees.map((emp) => {
                    const isEmpAdmin = emp.role === 'admin';
                    const isMgr = emp.role === 'sales_manager' || emp.role === 'manager';
                    const assignedMgr = allManagers.find(
                      (m) =>
                        m.id === emp.manager_id ||
                        m.phone?.replace(/\D/g, '').slice(-10) ===
                          emp.manager_phone?.replace(/\D/g, '').slice(-10),
                    );

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => handleSelect(emp)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                          isEmpAdmin ? 'bg-amber-500/[0.02]' : ''
                        }`}
                      >
                        {/* Member & ID */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs ${
                                isEmpAdmin
                                  ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                                  : isMgr
                                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                                    : 'bg-gradient-to-br from-blue-600 to-cyan-600'
                              }`}
                            >
                              {isEmpAdmin ? (
                                <Crown size={15} />
                              ) : (
                                emp.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                  {emp.name}
                                </span>
                                {emp.id === employee?.id && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                                    You
                                  </span>
                                )}
                                {emp.is_active === false && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-slate-400 text-[11px]">
                                {emp.employee_id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role & Scope */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isEmpAdmin
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : isMgr
                                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isEmpAdmin ? (
                              <>
                                <Crown size={11} className="text-amber-600" /> Executive Admin
                              </>
                            ) : isMgr ? (
                              'Sales Manager'
                            ) : (
                              'Salesperson'
                            )}
                          </span>
                        </td>

                        {/* Contact Info */}
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          <div>+{emp.phone}</div>
                          {emp.email && (
                            <div className="text-[11px] text-slate-400 font-sans truncate max-w-[180px]">
                              {emp.email}
                            </div>
                          )}
                        </td>

                        {/* Hierarchy */}
                        <td className="py-3.5 px-4">
                          {isEmpAdmin ? (
                            <span className="text-slate-500 font-medium text-xs">
                              Root Administrator
                            </span>
                          ) : isMgr ? (
                            <span className="text-indigo-600 font-semibold text-xs">
                              Team Supervisor
                            </span>
                          ) : assignedMgr ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-200/60">
                              <UserCheck size={11} className="text-indigo-500" />
                              Reports to <strong>{assignedMgr.name}</strong>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">Direct to Admin</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div
                            className="flex items-center justify-end gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isAdmin && (
                              <button
                                onClick={(e) => handleOpenEditModal(emp, e)}
                                title="Edit Account Details"
                                className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}

                            <button
                              onClick={() => handleSelect(emp)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                                isEmpAdmin
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                                  : isMgr
                                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200'
                              }`}
                            >
                              <span>{isEmpAdmin ? 'Open Overview' : 'View Dashboard'}</span>
                              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Card Grid View */
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => {
                const isEmpAdmin = emp.role === 'admin';
                const isMgr = emp.role === 'sales_manager' || emp.role === 'manager';
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
                    className={`bg-white hover:bg-slate-50/70 border rounded-2xl p-4.5 text-left transition-all group shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 ${
                      isEmpAdmin
                        ? 'border-amber-200 hover:border-amber-400'
                        : isMgr
                          ? 'border-indigo-200 hover:border-indigo-300'
                          : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${
                            isEmpAdmin
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600'
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate text-sm">
                              {emp.name}
                            </span>
                            {emp.id === employee?.id && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                                You
                              </span>
                            )}
                            {emp.is_active === false && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                Deactivated
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-slate-400 text-xs">
                            {emp.employee_id}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                          isEmpAdmin
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isMgr
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isEmpAdmin ? 'Admin' : isMgr ? 'Manager' : 'Rep'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span className="font-mono">+{emp.phone}</span>
                      </div>
                      {emp.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{emp.email}</span>
                        </div>
                      )}
                      {assignedMgr && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            <UserCheck size={11} className="text-indigo-500" /> Reports to {assignedMgr.name}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      {isAdmin ? (
                        <button
                          onClick={(e) => handleOpenEditModal(emp, e)}
                          title="Edit Account Details"
                          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      ) : (
                        <div />
                      )}

                      <div
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                          isEmpAdmin
                            ? 'bg-amber-50 group-hover:bg-amber-100 text-amber-900 border border-amber-200'
                            : isMgr
                              ? 'bg-indigo-50 group-hover:bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-slate-50 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 border border-slate-200 group-hover:border-blue-200'
                        }`}
                      >
                        <span>{isEmpAdmin ? 'Open Overview' : 'View Dashboard'}</span>
                        <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                      className={`px-3.5 py-2.5 border rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer ${
                        form.is_active === false
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      }`}
                    >
                      {form.is_active === false ? 'Activate' : 'Deactivate'}
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
