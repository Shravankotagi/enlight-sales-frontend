import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, LogOut, Loader2, UserPlus, X } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL ||
  'https://enlight-sales-backend-production.up.railway.app';

interface Employee {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  is_active: boolean;
}

interface AddEmployeeForm {
  name: string;
  phone: string;
  email: string;
  role: string;
  employee_id: string;
}

export default function AdminSelectionPage() {
  const navigate = useNavigate();
  const { token, employee, logout, setViewingAs } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [form, setForm] = useState<AddEmployeeForm>({
    name: '',
    phone: '91',
    email: '',
    role: 'salesperson',
    employee_id: '',
  });

  const fetchEmployees = () => {
    setLoading(true);
    fetch(`${BACKEND}/employees`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const salespersons = (data.data || []).filter(
          (e: Employee) => e.role !== 'admin' && e.is_active
        );
        setEmployees(salespersons);
      })
      .catch(() => setError('Failed to load employees'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmployees();
  }, [token]);

  const fetchNextId = async () => {
    try {
      const res = await fetch(`${BACKEND}/employees/next-id`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data.data?.next_id || data.data || 'EMP001';
    } catch {
      return 'EMP001';
    }
  };

  const handleOpenModal = async () => {
    setFormError('');
    setFormSuccess('');
    const nextId = await fetchNextId();
    setForm({
      name: '',
      phone: '91',
      email: '',
      role: 'salesperson',
      employee_id: nextId,
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
        throw new Error(data.error || data.message || 'Failed to add salesperson');
      }

      setFormSuccess(`${form.name} added successfully! They can now login with their phone number.`);
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
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Enlight Sales OS</h1>
            <p className="text-slate-400 text-sm mt-1">
              Admin Panel · {employee?.name}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-white
              transition-colors text-sm">
            <LogOut size={16} />
            Logout
          </button>
        </div>

        {/* Title + Add Button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Select Salesperson
              </h2>
              <p className="text-slate-400 text-sm">
                Click on a salesperson to view their dashboard
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700
              text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <UserPlus size={16} />
            Add Salesperson
          </button>
        </div>

        {/* Employee List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-400" size={32} />
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-10">{error}</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20">
            <Users size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No salespersons added yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Click "Add Salesperson" to get started
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleSelect(emp)}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700
                  hover:border-blue-500 rounded-xl p-4 text-left transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center
                      justify-center text-white font-bold text-sm shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{emp.name}</p>
                      <p className="text-slate-400 text-sm">
                        {emp.employee_id} · +{emp.phone}
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-500 group-hover:text-blue-400
                    transition-colors text-sm">
                    View Dashboard →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Salesperson Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-700">

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Add Salesperson</h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Success Message */}
            {formSuccess && (
              <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30
                rounded-lg text-green-400 text-sm">
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
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600
                      rounded-lg text-white text-sm placeholder-slate-400
                      focus:outline-none focus:border-blue-500"
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
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                    placeholder="919876543210"
                    maxLength={12}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600
                      rounded-lg text-white text-sm placeholder-slate-400
                      focus:outline-none focus:border-blue-500 font-mono"
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
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="rahul@enlightmetals.com"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600
                      rounded-lg text-white text-sm placeholder-slate-400
                      focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600
                      rounded-lg text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="salesperson">Salesperson</option>
                    <option value="sales_lead">Sales Lead</option>
                  </select>
                </div>

                {/* Employee ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Employee ID <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.employee_id}
                    onChange={e => setForm(f => ({ ...f, employee_id: e.target.value.toUpperCase() }))}
                    placeholder="EMP001"
                    className="w-full px-3 py-2.5 bg-slate-700 border border-slate-600
                      rounded-lg text-white text-sm placeholder-slate-400
                      focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Auto-generated — edit if needed
                  </p>
                </div>

                {/* Error */}
                {formError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30
                    rounded-lg text-red-400 text-sm">
                    {formError}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2.5 border border-slate-600 text-slate-300
                      rounded-lg text-sm hover:bg-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={formLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg
                      text-sm font-medium hover:bg-blue-700 disabled:opacity-50
                      transition-colors flex items-center justify-center gap-2">
                    {formLoading ? (
                      <><Loader2 size={14} className="animate-spin" /> Adding...</>
                    ) : (
                      'Add Salesperson'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
