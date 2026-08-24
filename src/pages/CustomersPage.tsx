import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../lib/api';
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
} from 'lucide-react';

function HealthBadge({ risk }: { risk: string }) {
  const r = (risk || '').toLowerCase();
  if (r === 'high') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1">
        <AlertTriangle size={12} /> High Risk 🔴
      </span>
    );
  }
  if (r === 'medium' || r === 'at risk') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
        <Clock size={12} /> At Risk 🟡
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
      <CheckCircle2 size={12} /> Healthy 🟢
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
        Billing Activity - Last 6 Months
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
                    ₹{Number(month.value).toLocaleString('en-IN')}
                  </span>
                </div>
              ) : (
                <div className="h-full w-full flex items-center pl-2.5">
                  <span className="text-[10px] text-slate-400 font-medium">No orders</span>
                </div>
              )}
            </div>
            <div className="w-20 text-right shrink-0">
              {month.deals.length > 0 ? (
                <span className="text-slate-600 font-medium">{month.deals.length} deal{month.deals.length > 1 ? 's' : ''}</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded font-medium">No Deals</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

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

  const { data: rawCustomersData = [], isLoading, refetch } = useQuery({
    queryKey: ['customers-churn'],
    queryFn: () =>
      customersApi.getChurnRisk().then(r => {
        const raw = r?.data;
        return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      }),
  });

  // Single customer detail query
  const { data: singleCustomer, isLoading: loadingSingle } = useQuery({
    queryKey: ['customer-detail', selectedCustomerId],
    queryFn: () =>
      selectedCustomerId
        ? customersApi.getOne(selectedCustomerId).then(r => r.data?.data ?? r.data)
        : Promise.resolve(null),
    enabled: !!selectedCustomerId,
  });

  const safeCustomers: any[] = Array.isArray(rawCustomersData) ? rawCustomersData : [];

  // Reset pagination to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRisk]);

  // Metrics
  const totalCustomers = safeCustomers.length;
  const healthyCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'low'
  ).length;
  const atRiskCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'medium' || (c.churn_risk || '').toLowerCase() === 'at risk'
  ).length;
  const highRiskCount = safeCustomers.filter(
    c => (c.churn_risk || '').toLowerCase() === 'high'
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
    if (filterRisk === 'low') matchesRisk = risk === 'low';
    if (filterRisk === 'medium') matchesRisk = risk === 'medium' || risk === 'at risk';
    if (filterRisk === 'high') matchesRisk = risk === 'high';

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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Customer Directory &amp; Account Health
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor customer order frequencies, track account health, and manage client relationships.
          </p>
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
            <p className="text-xs text-slate-500 font-medium">Healthy Accounts</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{healthyCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">At Risk</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{atRiskCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">High Risk</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{highRiskCount}</p>
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
            <option value="low">Healthy ({healthyCount}) 🟢</option>
            <option value="medium">At Risk ({atRiskCount}) 🟡</option>
            <option value="high">High Risk ({highRiskCount}) 🔴</option>
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

        {/* Pagination Controls matching reference image */}
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
                className={`w-7 h-7 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === pageNum
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
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-100">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {singleCustomer?.customer_name || 'Customer Details'}
                  </h2>
                  {singleCustomer?.customer_gst && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5">GST: {singleCustomer.customer_gst}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {singleCustomer && <HealthBadge risk={singleCustomer.churn_risk || 'low'} />}
                <button
                  onClick={() => setSelectedCustomerId(null)}
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
                Loading company details...
              </div>
            ) : !singleCustomer ? (
              <div className="p-12 text-center text-slate-400">Unable to load customer information.</div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-4 pr-1.5 py-3">
                {/* 1. Contact & Account Overview Grid */}
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
                    <p className="text-slate-400 font-medium">Last Order Date</p>
                    <p className="text-slate-800 font-semibold flex items-center gap-1 text-sm truncate">
                      <Calendar size={13} className="text-slate-400 shrink-0" />
                      {singleCustomer.last_order_date
                        ? new Date(singleCustomer.last_order_date).toLocaleDateString('en-IN')
                        : '-'}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                    <p className="text-slate-400 font-medium">Order Frequency</p>
                    <p className="text-slate-800 font-semibold flex items-center gap-1 text-sm truncate">
                      <Clock size={13} className="text-slate-400 shrink-0" />
                      Every {singleCustomer.avg_order_frequency_days || 30}d
                    </p>
                  </div>
                </div>

                {/* 2. Billing Activity */}
                <BillingChart customer={singleCustomer} />

                {/* 3. Recent Deals & Orders */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} className="text-blue-600" />
                      Recent Deals ({singleCustomer.deals?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.deals?.length > 0 ? (
                    <div className="space-y-2">
                      {singleCustomer.deals.slice(0, 5).map((deal: any) => (
                        <div
                          key={deal.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                          <div>
                            <p className="font-semibold text-slate-800">
                              {deal.inquiry_type === 'purchase_order' ? `PO: ${deal.po_number || 'N/A'}` : 'Inquiry Deal'}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(deal.created_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900">
                              {deal.total_amount ? '₹' + Number(deal.total_amount).toLocaleString('en-IN') : '-'}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold inline-block mt-0.5 ${deal.stage === 'won'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : deal.stage === 'lost'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                              {deal.stage}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No deals recorded for this customer.</p>
                  )}
                </div>

                {/* 4. Visits History */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-blue-600" />
                      Field Visits Log ({singleCustomer.visits?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.visits?.length > 0 ? (
                    <div className="space-y-2">
                      {singleCustomer.visits.slice(0, 4).map((visit: any) => (
                        <div key={visit.id} className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <span>{visit.person_met || 'Field Visit'}</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              {new Date(visit.visited_at).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                          {visit.remarks && <p className="text-slate-600 text-[11px] leading-relaxed">{visit.remarks}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No field visits logged for this customer.</p>
                  )}
                </div>

                {/* 5. Complaints History */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  <h4 className="font-semibold text-slate-800 text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-blue-600" />
                      Complaints History ({singleCustomer.complaints?.length || 0})
                    </span>
                  </h4>
                  {singleCustomer.complaints?.length > 0 ? (
                    <div className="space-y-2">
                      {singleCustomer.complaints.map((c: any) => (
                        <div key={c.id} className="flex items-start justify-between p-2.5 bg-slate-50 rounded-lg text-xs gap-3">
                          <div>
                            <p className="font-semibold text-slate-800">{c.complaint_type || 'Customer Concern'}</p>
                            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{c.description || '-'}</p>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${c.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                              }`}>
                            {c.status}
                          </span>
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
            <div className="pt-3 border-t border-slate-100 flex justify-end items-center gap-2 shrink-0">
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
    </div>
  );
}
