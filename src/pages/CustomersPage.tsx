import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { customersApi, employeesApi } from '../lib/api';
import { useEffect, useState } from 'react';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  MoreVertical,
  Eye,
  Edit2,
  User,
  Phone,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  TrendingUp,
  FileText,
  MessageSquare,
  MapPin,
  HelpCircle,
  ShieldAlert,
  Award,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function HealthBadge({ risk }: { risk: string }) {
  const r = (risk || '').toLowerCase();
  if (r === 'credit_watch') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 inline-flex items-center gap-1 border border-purple-200">
        <ShieldAlert size={12} /> Credit Watch ⚠️
      </span>
    );
  }
  if (r === 'churning' || r === 'high') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1 border border-rose-200">
        <AlertTriangle size={12} /> Churning (&gt;45d) 🔴
      </span>
    );
  }
  if (r === 'at_risk' || r === 'medium' || r === 'at risk') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1 border border-amber-200">
        <Clock size={12} /> At Risk (35-45d) 🟡
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1 border border-emerald-200">
      <CheckCircle2 size={12} /> Active 🟢
    </span>
  );
}

function TierBadge({ tier }: { tier?: string }) {
  const t = (tier || 'C').toUpperCase();
  if (t === 'A') {
    return (
      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1">
        <Award size={12} /> Tier A 🏆
      </span>
    );
  }
  if (t === 'B') {
    return (
      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
        <Award size={12} /> Tier B 🌟
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
      <Award size={12} /> Tier C 📦
    </span>
  );
}

function BillingChart({ customer }: { customer: any }) {
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
    };
  }).reverse();

  const dealsByMonth = last6Months.map(month => ({
    ...month,
    deals: (customer.deals || []).filter((d: any) => d.created_at?.startsWith(month.key)),
    value: (customer.deals || [])
      .filter((d: any) => d.created_at?.startsWith(month.key))
      .reduce((sum: number, d: any) => sum + (d.total_amount || 0), 0),
  }));

  const maxValue = Math.max(...dealsByMonth.map(m => m.value), 1);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
      <h3 className="font-semibold text-slate-800 mb-3 text-xs flex items-center gap-1.5">
        <TrendingUp size={14} className="text-blue-600" />
        Billing Activity &amp; Order Timeline (Last 6 Months)
      </h3>
      <div className="space-y-2.5">
        {dealsByMonth.map(month => (
          <div key={month.key} className="flex items-center gap-3 text-xs">
            <span className="text-slate-500 font-medium w-14 shrink-0">{month.label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
              {month.value > 0 ? (
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full flex items-center pl-2 transition-all"
                  style={{ width: `${Math.max(8, (month.value / maxValue) * 100)}%` }}>
                  <span className="text-[10px] text-white font-bold truncate">
                    {'\u20B9'}{Number(month.value).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="h-full w-full flex items-center pl-2.5">
                  <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                    Gap Month ⚠️
                  </span>
                </div>
              )}
            </div>
            <div className="w-24 text-right shrink-0">
              {month.deals.length > 0 ? (
                <span className="text-slate-700 font-semibold">{month.deals.length} order{month.deals.length > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full font-bold">
                  No Orders
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { effectivePhone } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(() => {
    return searchParams.get('id') || searchParams.get('customerId') || null;
  });
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const pageSize = 15;

  // Edit Form State
  const [editForm, setEditForm] = useState({
    customer_name: '',
    contact_person: '',
    customer_phone: '',
    customer_gst: '',
    address: '',
    avg_order_frequency_days: 30,
    assigned_salesperson_phone: '',
    churn_risk: 'active',
  });

  useEffect(() => {
    document.title = 'Customers - Enlight Sales OS';
  }, []);

  // Close active action dropdown when clicking outside
  useEffect(() => {
    if (!activeActionMenuId) return;
    const handleClickOutside = () => setActiveActionMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeActionMenuId]);

  // Fetch employees for salesperson name lookup & dropdown
  const { data: rawEmployees = [] } = useQuery<{ id: string; name: string; phone: string }[]>({
    queryKey: ['employees-list-customers'],
    queryFn: async () => {
      const res = await employeesApi.getAll().catch(() => null);
      const raw = res?.data;
      return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    },
  });

  const employeeMap = new Map<string, string>();
  rawEmployees.forEach(emp => {
    if (emp.phone && emp.name) {
      const clean = emp.phone.replace(/\D/g, '').slice(-10);
      employeeMap.set(clean, emp.name);
    }
  });

  const getSalespersonName = (phoneStr?: string) => {
    if (!phoneStr) return 'Unassigned';
    const clean = phoneStr.replace(/\D/g, '').slice(-10);
    return employeeMap.get(clean) || phoneStr;
  };

  const { data: rawCustomersData = [], isLoading, refetch } = useQuery({
    queryKey: ['customers-churn', effectivePhone],
    queryFn: () =>
      customersApi.getChurnRisk({ salesperson_phone: effectivePhone }).then(r => {
        const raw = r?.data;
        return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      }),
  });

  // Single customer detail query
  const { data: singleCustomer, isLoading: loadingSingle, refetch: refetchSingle } = useQuery({
    queryKey: ['customer-detail', selectedCustomerId],
    queryFn: () =>
      selectedCustomerId
        ? customersApi.getOne(selectedCustomerId).then(r => r.data?.data ?? r.data)
        : Promise.resolve(null),
    enabled: !!selectedCustomerId,
  });

  const safeCustomers: any[] = Array.isArray(rawCustomersData) ? rawCustomersData : [];

  // Synchronize URL search params with selected customer
  useEffect(() => {
    const cid = searchParams.get('id') || searchParams.get('customerId');
    const cname = searchParams.get('name');
    if (cid) {
      setSelectedCustomerId(cid);
    } else if (cname && safeCustomers.length > 0) {
      const match = safeCustomers.find(
        c => (c.customer_name || c.name || '').trim().toLowerCase() === cname.trim().toLowerCase()
      );
      if (match) {
        setSelectedCustomerId(match.id || `virtual-${match.customer_name || match.name}`);
      } else {
        setSelectedCustomerId(`virtual-${cname}`);
      }
    }
  }, [searchParams, safeCustomers]);

  const handleCloseModal = () => {
    setSelectedCustomerId(null);
    if (searchParams.get('id') || searchParams.get('customerId') || searchParams.get('name')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('id');
      nextParams.delete('customerId');
      nextParams.delete('name');
      setSearchParams(nextParams, { replace: true });
    }
  };

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRisk]);

  // Metrics
  const totalCustomers = safeCustomers.length;
  const activeCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'active' || (c.churn_risk || '').toLowerCase() === 'low'
  ).length;
  const atRiskCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'at_risk' || (c.churn_risk || '').toLowerCase() === 'medium'
  ).length;
  const churningCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'churning' || (c.churn_risk || '').toLowerCase() === 'high'
  ).length;
  const creditWatchCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'credit_watch'
  ).length;

  // Filtered List
  const filteredCustomers = safeCustomers.filter(c => {
    const name = (c?.customer_name || '').toLowerCase();
    const phone = (c?.customer_phone || '').toLowerCase();
    const person = (c?.contact_person || '').toLowerCase();
    const matchesSearch =
      name.includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm.toLowerCase()) ||
      person.includes(searchTerm.toLowerCase());

    const risk = (c?.churn_risk || '').toLowerCase();
    let matchesRisk = true;
    if (filterRisk === 'active') matchesRisk = risk === 'active' || risk === 'low';
    if (filterRisk === 'at_risk') matchesRisk = risk === 'at_risk' || risk === 'medium';
    if (filterRisk === 'churning') matchesRisk = risk === 'churning' || risk === 'high';
    if (filterRisk === 'credit_watch') matchesRisk = risk === 'credit_watch';

    return matchesSearch && matchesRisk;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredCustomers.length);
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterRisk('all');
  };

  const handleOpenEdit = (c: any) => {
    setActiveActionMenuId(null);
    setEditingCustomer(c);
    setEditForm({
      customer_name: c.customer_name || '',
      contact_person: c.contact_person || '',
      customer_phone: c.customer_phone || '',
      customer_gst: c.customer_gst || '',
      address: c.address || '',
      avg_order_frequency_days: c.avg_order_frequency_days || 30,
      assigned_salesperson_phone: c.assigned_salesperson_phone || '',
      churn_risk: c.churn_risk || 'active',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    try {
      setIsSubmittingEdit(true);
      await customersApi.update(editingCustomer.id, editForm);
      refetch();
      if (selectedCustomerId) refetchSingle();
      queryClient.invalidateQueries({ queryKey: ['customers-churn'] });
      setEditingCustomer(null);
    } catch (err: any) {
      alert(`Failed to save customer updates: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Customers &amp; Account Health
          </h1>
          
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="Refresh">
            <RefreshCw size={18} className={isLoading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Customers</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCustomers}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Accounts</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">At Risk (35-45d)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{atRiskCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Churning (&gt;45d)</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{churningCount}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Unified Search & Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search Customer, Contact, Phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400 bg-white"
          />
        </div>

        {/* Health Risk Filter Dropdown */}
        <div className="relative inline-flex items-center">
          <select
            value={filterRisk}
            onChange={e => setFilterRisk(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer transition-all">
            <option value="all">All Health Statuses ({totalCustomers})</option>
            <option value="active">Active ({activeCount}) 🟢</option>
            <option value="at_risk">At Risk 35-45d ({atRiskCount}) 🟡</option>
            <option value="churning">Churning &gt;45d ({churningCount}) 🔴</option>
            <option value="credit_watch">Credit Watch ({creditWatchCount}) ⚠️</option>
          </select>
        </div>

        {/* Clear Filter Button */}
        {(searchTerm || filterRisk !== 'all') && (
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl transition-colors shadow-2xs cursor-pointer">
            Clear Filter
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3 min-w-[200px]">Customer</th>
                <th className="px-4 py-3 min-w-[170px]">Order Activity</th>
                <th className="px-4 py-3 min-w-[130px]">Account Health</th>
                <th className="px-4 py-3 text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                    Loading customer directory...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No customers found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try changing search query or health filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c: any, idx: number) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={c.id || idx}
                      className="hover:bg-slate-50/70 transition-colors group">
                      {/* # Serial Number */}
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-medium text-center">
                        {serialNum}
                      </td>

                      {/* 1. Customer */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors flex items-center gap-2">
                          <Building2 size={16} className="text-blue-600 shrink-0" />
                          {c.customer_name || 'Customer'}
                        </div>
                        {c.customer_gst && (
                          <div className="text-xs text-slate-500 font-mono mt-0.5">
                            GST: {c.customer_gst}
                          </div>
                        )}
                      </td>

                      {/* 2. Order Activity */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          {c.last_order_date
                            ? new Date(c.last_order_date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </div>
                        <div className="text-slate-500 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                          <Clock size={11} className="text-slate-400 shrink-0" />
                          Every {c.avg_order_frequency_days || 30}d
                        </div>
                      </td>

                      {/* 3. Account Health */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <HealthBadge risk={c.churn_risk} />
                      </td>

                      {/* 4. Actions (Bordered 3-dots button) */}
                      <td className="px-4 py-3.5 text-right relative whitespace-nowrap">
                        <div className="inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(prev => (prev === c.id ? null : c.id));
                            }}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 rounded-xl transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center"
                            title="Actions">
                            <MoreVertical size={16} />
                          </button>

                          {activeActionMenuId === c.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-4 top-11 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 min-w-[140px] text-left animate-in fade-in-50 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setSelectedCustomerId(c.id);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors cursor-pointer">
                                <Eye size={14} className="text-slate-400" />
                                View Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(c)}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors cursor-pointer">
                                <Edit2 size={14} className="text-slate-400" />
                                Edit Customer
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-900">{filteredCustomers.length === 0 ? 0 : startIndex + 1}</span> to{' '}
            <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
            <span className="font-bold text-slate-900">{filteredCustomers.length}</span> customers
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer flex items-center gap-1">
              <ChevronLeft size={14} className="text-slate-400" />
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200'
                }`}>
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer flex items-center gap-1">
              Next
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Company Info View Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
                  <Building2 size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {singleCustomer?.customer_name || 'Customer Details'}
                    </h2>
                    {singleCustomer && <TierBadge tier={singleCustomer.tier} />}
                  </div>
                  {singleCustomer?.customer_gst && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5">GST: {singleCustomer.customer_gst}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {singleCustomer && <HealthBadge risk={singleCustomer.churn_risk || 'active'} />}
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Close">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {loadingSingle ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin inline mr-2 text-blue-600" />
                Loading company identity &amp; activity...
              </div>
            ) : !singleCustomer ? (
              <div className="p-12 text-center text-slate-400">Unable to load customer information.</div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-4 pr-1.5 py-3">
                {/* 1. Identity Overview Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                    <p className="text-slate-400 font-medium">Contact Person</p>
                    <p className="text-slate-800 font-semibold flex items-center gap-1 text-sm truncate">
                      <User size={13} className="text-slate-400 shrink-0" />
                      {singleCustomer.contact_person || '-'}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                    <p className="text-slate-400 font-medium">Contact Phone</p>
                    <p className="text-slate-800 font-semibold font-mono flex items-center gap-1 text-sm truncate">
                      <Phone size={13} className="text-slate-400 shrink-0" />
                      {singleCustomer.customer_phone || '-'}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                    <p className="text-slate-400 font-medium">Assigned Salesperson</p>
                    <p className="text-slate-800 font-semibold flex items-center gap-1 text-sm truncate">
                      <UserCheck size={13} className="text-slate-400 shrink-0" />
                      {getSalespersonName(singleCustomer.assigned_salesperson_phone)}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                    <p className="text-slate-400 font-medium">Region / Location</p>
                    <p className="text-slate-800 font-semibold flex items-center gap-1 text-sm truncate">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      {singleCustomer.address || 'India'}
                    </p>
                  </div>
                </div>

                {/* 2. Billing Timeline Chart */}
                <BillingChart customer={singleCustomer} />

                {/* 3. Inquiry History */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-blue-600" />
                      Inquiry History ({singleCustomer.inquiries?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.inquiries?.length > 0 ? (
                    <div className="space-y-2.5">
                      {singleCustomer.inquiries.slice(0, 5).map((inq: any) => {
                        const ext = inq.ai_extraction_json || {};
                        const lineItems = ext.line_items || [];
                        const title =
                          inq.inquiry_text ||
                          ext.product_required ||
                          (lineItems[0]?.sku_text ? lineItems[0].sku_text : null) ||
                          `Inquiry #${(inq.id || '').slice(0, 6)}`;
                        const qty = ext.total_quantity || (lineItems[0]?.quantity ? `${lineItems[0].quantity} ${lineItems[0].unit || 'MT'}` : null);
                        const make = ext.preferred_make || ext.make || null;
                        const channel = inq.source_channel === 'whatsapp' ? 'WhatsApp 💬' : 'Web Dashboard 🌐';

                        return (
                          <div
                            key={inq.id}
                            className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5 hover:border-slate-200 transition-all">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-slate-900 text-xs leading-snug">{title}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                                  <span>📅 {inq.created_at ? new Date(inq.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>
                                  <span>•</span>
                                  <span>{channel}</span>
                                  {qty && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-700 font-semibold">Qty: {qty}</span>
                                    </>
                                  )}
                                  {make && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600 font-medium">Make: {make}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                                  inq.status === 'converted' || inq.status === 'won'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : inq.status === 'quoted'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-slate-200 text-slate-700 border border-slate-300'
                                }`}>
                                {inq.status ? inq.status.toUpperCase() : 'NEW'}
                              </span>
                            </div>
                            {inq.raw_text && inq.raw_text !== title && (
                              <p className="text-[11px] text-slate-600 italic bg-white/70 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                                &quot;{inq.raw_text.length > 120 ? inq.raw_text.slice(0, 120) + '...' : inq.raw_text}&quot;
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No inquiries recorded for this customer.</p>
                  )}
                </div>

                {/* 4. Orders & Deals History */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} className="text-blue-600" />
                      Orders &amp; Deals History ({singleCustomer.deals?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.deals?.length > 0 ? (
                    <div className="space-y-2.5">
                      {singleCustomer.deals.slice(0, 5).map((deal: any) => {
                        const isPo = deal.inquiry_type === 'purchase_order' || !!deal.po_number;
                        const orderTitle = isPo ? `PO #${deal.po_number || 'N/A'}` : `Inquiry Order #${(deal.id || '').slice(0, 6)}`;

                        return (
                          <div
                            key={deal.id}
                            className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5 hover:border-slate-200 transition-all">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  {orderTitle}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                                  <span>📅 {new Date(deal.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  {deal.payment_terms && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-700 font-medium">Terms: {deal.payment_terms}</span>
                                    </>
                                  )}
                                  {deal.delivery_location && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-700 font-medium">Location: {deal.delivery_location}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-slate-900 text-sm">
                                  {deal.total_amount ? '\u20B9' + Number(deal.total_amount).toLocaleString('en-IN') : '-'}
                                </p>
                                <span
                                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold inline-block mt-0.5 ${
                                    deal.stage === 'won'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : deal.stage === 'lost'
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                  {deal.stage ? deal.stage.toUpperCase() : 'PENDING'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No orders or deals recorded for this customer.</p>
                  )}
                </div>

                {/* 5. Field Visits Log */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-600" />
                      Field Visits Log ({singleCustomer.visits?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.visits?.length > 0 ? (
                    <div className="space-y-2.5">
                      {singleCustomer.visits.slice(0, 4).map((visit: any) => {
                        const outcomeStr = (visit.remarks || '').toLowerCase();
                        let outcomeTag = 'Neutral 🟡';
                        let outcomeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                        if (outcomeStr.includes('positive') || outcomeStr.includes('won') || outcomeStr.includes('order')) {
                          outcomeTag = 'Positive 🟢';
                          outcomeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        } else if (outcomeStr.includes('negative') || outcomeStr.includes('lost') || outcomeStr.includes('rejected')) {
                          outcomeTag = 'Negative 🔴';
                          outcomeClass = 'bg-rose-100 text-rose-800 border-rose-200';
                        }

                        return (
                          <div key={visit.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5 hover:border-slate-200 transition-all">
                            <div className="flex items-center justify-between font-bold text-slate-900">
                              <span className="flex items-center gap-1.5">
                                <User size={13} className="text-blue-600 shrink-0" />
                                {visit.person_met || 'Contact Person Met'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${outcomeClass}`}>
                                  {outcomeTag}
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {new Date(visit.visited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            {visit.customer_address && (
                              <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                <MapPin size={11} className="text-slate-400 shrink-0" />
                                {visit.customer_address}
                              </p>
                            )}

                            {visit.remarks && (
                              <p className="text-slate-700 text-[11px] leading-relaxed bg-white p-2 rounded-lg border border-slate-200/70">
                                {visit.remarks}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No field visits logged for this customer.</p>
                  )}
                </div>

                {/* 6. Complaints History */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-blue-600" />
                      Complaints History ({singleCustomer.complaints?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.complaints?.length > 0 ? (
                    <div className="space-y-2.5">
                      {singleCustomer.complaints.map((c: any) => (
                        <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1.5 hover:border-slate-200 transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{c.complaint_type || 'Customer Concern'}</p>
                              {c.affected_product && (
                                <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
                                  Affected Product: {c.affected_product}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                Reported: {c.reported_at ? new Date(c.reported_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                                c.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                              {c.status ? c.status.toUpperCase() : 'PENDING'}
                            </span>
                          </div>

                          {c.description && (
                            <p className="text-slate-700 text-[11px] leading-relaxed bg-white p-2 rounded-lg border border-slate-200/70">
                              {c.description}
                            </p>
                          )}

                          {c.resolution_notes && (
                            <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 font-medium">
                              <span className="font-bold">Resolution: </span>
                              {c.resolution_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No complaints reported for this customer.</p>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-3.5 border-t border-slate-100 flex justify-between items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (singleCustomer) handleOpenEdit(singleCustomer);
                }}
                className="px-4 py-2 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5">
                <Edit2 size={14} />
                Edit Customer
              </button>

              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-blue-600" />
                Edit Customer - {editingCustomer.customer_name}
              </h3>
              <button
                onClick={() => setEditingCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveEdit} className="space-y-4 py-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Company / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.customer_name}
                  onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editForm.contact_person}
                    onChange={e => setEditForm({ ...editForm, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editForm.customer_phone}
                    onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">GST Number</label>
                  <input
                    type="text"
                    value={editForm.customer_gst}
                    onChange={e => setEditForm({ ...editForm, customer_gst: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Order Frequency (Days)</label>
                  <input
                    type="number"
                    value={editForm.avg_order_frequency_days}
                    onChange={e => setEditForm({ ...editForm, avg_order_frequency_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Region / Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="City, State"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Assigned Salesperson</label>
                  <select
                    value={editForm.assigned_salesperson_phone}
                    onChange={e => setEditForm({ ...editForm, assigned_salesperson_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Unassigned</option>
                    {rawEmployees.map(emp => (
                      <option key={emp.id} value={emp.phone}>
                        {emp.name} ({emp.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Health Status</label>
                  <select
                    value={editForm.churn_risk}
                    onChange={e => setEditForm({ ...editForm, churn_risk: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="active">Active 🟢</option>
                    <option value="at_risk">At Risk (35-45d) 🟡</option>
                    <option value="churning">Churning (&gt;45d) 🔴</option>
                    <option value="credit_watch">Credit Watch ⚠️</option>
                  </select>
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1">
                  {isSubmittingEdit ? <RefreshCw size={14} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
