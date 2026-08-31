import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customersApi, employeesApi } from '../lib/api';
import { useEffect, useState, useMemo } from 'react';
import {
  Users,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Award,
  TrendingUp,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatLocalDate, getDaysAgo } from '../utils/dateUtils';

function HealthBadge({ risk }: { risk: string }) {
  const r = (risk || '').toLowerCase();
  if (r === 'churning' || r === 'high') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 inline-flex items-center gap-1.5 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
        Churning (&gt;45d)
      </span>
    );
  }
  if (r === 'at_risk' || r === 'medium' || r === 'at risk') {
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1.5 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
        At Risk (35-45d)
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center gap-1.5 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
      Active
    </span>
  );
}

function SegmentBadge({ segment }: { segment?: string }) {
  const s = (segment || 'new').toLowerCase();
  if (s === 'key_account' || s === 'key account') {
    return (
      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1.5 shadow-2xs">
        <Award size={13} className="text-indigo-600 shrink-0" />
        Key Account
      </span>
    );
  }
  if (s === 'growth') {
    return (
      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
        <TrendingUp size={13} className="text-emerald-600 shrink-0" />
        Growth
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-sky-50 text-sky-800 border border-sky-200 inline-flex items-center gap-1.5 shadow-2xs">
      <Sparkles size={13} className="text-sky-600 shrink-0" />
      New
    </span>
  );
}

function formatCurrency(val?: number) {
  const amount = Number(val || 0);
  return '₹' + amount.toLocaleString('en-IN');
}

function deriveSegment(c: any): string {
  if (c.segment && ['key_account', 'growth', 'new'].includes(c.segment.toLowerCase())) {
    return c.segment.toLowerCase();
  }
  const ltv = Number(c.lifetime_value || 0);
  const orders = Number(c.total_orders || 0);
  if (ltv >= 1000000 || orders >= 5) {
    return 'key_account';
  }
  if (orders >= 2 || (ltv >= 100000 && ltv < 1000000)) {
    return 'growth';
  }
  return 'new';
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { effectivePhone, isSalesManager, isAdmin } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Date Filter Presets (Matching Visits tab pattern)
  const [dayPreset, setDayPreset] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomDate, setShowCustomDate] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  const handleDayPresetChange = (preset: string) => {
    setDayPreset(preset);
    if (preset === 'all') {
      setDateRange({});
      setShowCustomDate(false);
    } else if (preset === 'today') {
      const today = formatLocalDate();
      setDateRange({ from: today, to: today });
      setShowCustomDate(false);
    } else if (preset === '7_days') {
      setDateRange({ from: getDaysAgo(7), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === '30_days') {
      setDateRange({ from: getDaysAgo(30), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === '90_days') {
      setDateRange({ from: getDaysAgo(90), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === 'custom') {
      setShowCustomDate(true);
    }
  };

  const handleCustomFromChange = (val: string) => {
    setCustomFrom(val);
    let effectiveTo = customTo;
    if (val && customTo && val > customTo) {
      effectiveTo = val;
      setCustomTo(val);
    }
    if (val && effectiveTo) {
      setDateRange({ from: val, to: effectiveTo });
    } else if (val) {
      setDateRange({ from: val, to: val });
    }
  };

  const handleCustomToChange = (val: string) => {
    let effectiveVal = val;
    if (val && customFrom && val < customFrom) {
      effectiveVal = customFrom;
    }
    setCustomTo(effectiveVal);
    if (customFrom && effectiveVal) {
      setDateRange({ from: customFrom, to: effectiveVal });
    }
  };

  useEffect(() => {
    document.title = 'Customer Health - Enlight Sales OS';
  }, []);

  // Fetch employees for salesperson name lookup
  const { data: rawEmployees = [] } = useQuery<{ id: string; name: string; phone: string }[]>({
    queryKey: ['employees-list-customers'],
    queryFn: async () => {
      const res = await employeesApi.getAll().catch(() => null);
      const raw = res?.data;
      return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    },
  });

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    rawEmployees.forEach(emp => {
      if (emp.phone && emp.name) {
        const clean = emp.phone.replace(/\D/g, '').slice(-10);
        map.set(clean, emp.name);
      }
    });
    return map;
  }, [rawEmployees]);

  const formatName = (str?: string) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const getSalespersonName = (phoneStr?: string, assignedName?: string) => {
    if (assignedName && assignedName.trim()) {
      return formatName(assignedName);
    }
    if (!phoneStr) return null;
    const clean = phoneStr.replace(/\D/g, '').slice(-10);
    const found = employeeMap.get(clean);
    if (found) return formatName(found);
    return null;
  };

  const { data: rawCustomersData = [], isLoading, refetch } = useQuery({
    queryKey: ['customers-churn', effectivePhone],
    queryFn: () =>
      customersApi.getChurnRisk({ salesperson_phone: effectivePhone }).then(r => {
        const raw = r?.data;
        return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      }),
  });

  const safeCustomers: any[] = Array.isArray(rawCustomersData) ? rawCustomersData : [];

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterHealth, filterSegment, dateRange]);

  // Top 4 Metrics
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

  // Segment Count helpers
  const keyAccountsCount = safeCustomers.filter(c => deriveSegment(c) === 'key_account').length;
  const growthAccountsCount = safeCustomers.filter(c => deriveSegment(c) === 'growth').length;
  const newAccountsCount = safeCustomers.filter(c => deriveSegment(c) === 'new').length;

  // Filtered List
  const filteredCustomers = safeCustomers.filter(c => {
    if (dateRange.from && dateRange.to) {
      const orderDateStr = c.last_order_date || c.created_at;
      if (!orderDateStr) return false;
      const itemDate = new Date(orderDateStr).toISOString().split('T')[0];
      if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
    }

    const name = (c?.customer_name || '').toLowerCase();
    const phone = (c?.customer_phone || '').toLowerCase();
    const person = (c?.contact_person || '').toLowerCase();
    const rep = (getSalespersonName(c?.assigned_salesperson_phone, c?.assigned_salesperson_name) || '').toLowerCase();
    const matchesSearch =
      name.includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm.toLowerCase()) ||
      person.includes(searchTerm.toLowerCase()) ||
      rep.includes(searchTerm.toLowerCase());

    const risk = (c?.churn_risk || 'active').toLowerCase();
    let matchesHealth = true;
    if (filterHealth === 'active') matchesHealth = risk === 'active' || risk === 'low';
    if (filterHealth === 'at_risk') matchesHealth = risk === 'at_risk' || risk === 'medium';
    if (filterHealth === 'churning') matchesHealth = risk === 'churning' || risk === 'high';

    const seg = deriveSegment(c);
    let matchesSegment = true;
    if (filterSegment === 'key_account') matchesSegment = seg === 'key_account';
    if (filterSegment === 'growth') matchesSegment = seg === 'growth';
    if (filterSegment === 'new') matchesSegment = seg === 'new';

    return matchesSearch && matchesHealth && matchesSegment;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredCustomers.length);
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterHealth('all');
    setFilterSegment('all');
    setDayPreset('all');
    setShowCustomDate(false);
    setCustomFrom('');
    setCustomTo('');
    setDateRange({});
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Customer Health
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

      {/* 2. Top 4 Metric Summary Cards */}
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

      {/* 3. Filter & Search Bar - Single Row matching Visits Tab pattern */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Bar with Clear (X) Icon */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={canViewSalesperson ? 'Search Customer, Rep...' : 'Search Customer...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Clear Search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Preset Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
            <select
              value={dayPreset}
              onChange={e => handleDayPresetChange(e.target.value)}
              className="w-full sm:w-auto pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Time</option>
              <option value="today" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Today</option>
              <option value="7_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 7 Days</option>
              <option value="30_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 30 Days</option>
              <option value="90_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 90 Days</option>
              <option value="custom" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Custom Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Health Risk Filter Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterHealth}
              onChange={e => setFilterHealth(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Health Statuses ({totalCustomers})</option>
              <option value="active" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Active ({activeCount})</option>
              <option value="at_risk" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>At Risk 35-45d ({atRiskCount})</option>
              <option value="churning" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Churning &gt;45d ({churningCount})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Segment Filter Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterSegment}
              onChange={e => setFilterSegment(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Segments ({totalCustomers})</option>
              <option value="key_account" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Key Account ({keyAccountsCount})</option>
              <option value="growth" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Growth ({growthAccountsCount})</option>
              <option value="new" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>New ({newAccountsCount})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Clear Filter Button */}
          {(searchTerm || filterHealth !== 'all' || filterSegment !== 'all' || dayPreset !== 'all') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer">
              Clear Filter
            </button>
          )}
        </div>

        {/* Custom Range Inputs */}
        {showCustomDate && (
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
            <span className="text-slate-500 font-semibold">From:</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => handleCustomFromChange(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
            />
            <span className="text-slate-500 font-semibold">To:</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => handleCustomToChange(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* 4. Customer Listing Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5 text-center w-12">#</th>
                <th className="px-5 py-3.5 min-w-[220px]">Customer</th>
                <th className="px-4 py-3.5 min-w-[140px]">Segment</th>
                <th className="px-4 py-3.5 min-w-[170px]">Order Activity</th>
                <th className="px-4 py-3.5 min-w-[140px]">Health</th>
                <th className="px-4 py-3.5 text-center min-w-[100px]">Orders</th>
                <th className="px-4 py-3.5 text-center min-w-[120px]">Open Issues</th>
                <th className="px-5 py-3.5 text-right min-w-[140px]">Lifetime Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                    Loading customer health data...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No customers found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try changing search query, health status, or segment filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c: any, idx: number) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  const salespersonName = getSalespersonName(c.assigned_salesperson_phone, c.assigned_salesperson_name);
                  const segment = deriveSegment(c);
                  const openIssuesCount = Number(c.open_complaints || 0);

                  return (
                    <tr
                      key={c.id || idx}
                      onClick={() => navigate('/customers/' + c.id)}
                      className="hover:bg-slate-50/90 transition-colors group cursor-pointer">
                      {/* # Serial Number */}
                      <td className="px-4 py-3.5 text-xs text-slate-400 font-medium text-center">
                        {serialNum}
                      </td>

                      {/* 1. Customer Column */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                          {c.customer_name || 'Customer'}
                        </div>
                        {canViewSalesperson && salespersonName && (
                          <div className="text-xs text-slate-500 font-medium inline-flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <UserCheck size={12} className="text-slate-400 shrink-0" />
                            Rep: {salespersonName}
                          </div>
                        )}
                      </td>

                      {/* 2. Segment Column */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <SegmentBadge segment={segment} />
                      </td>

                      {/* 3. Order Activity Column */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          {c.last_order_date
                            ? new Date(c.last_order_date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                            : '-'}
                        </div>
                        <div className="text-slate-500 font-medium text-[11px] mt-0.5 whitespace-nowrap">
                          Freq: {c.avg_order_frequency_days || 30}d
                        </div>
                      </td>

                      {/* 4. Health Column */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <HealthBadge risk={c.churn_risk} />
                      </td>

                      {/* 5. Orders Column */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {c.total_orders ?? 0} {Number(c.total_orders) === 1 ? 'Order' : 'Orders'}
                        </span>
                      </td>

                      {/* 6. Open Issues Column */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {openIssuesCount > 0 ? (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                            {openIssuesCount} Open {openIssuesCount === 1 ? 'Issue' : 'Issues'}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                            0 Issues
                          </span>
                        )}
                      </td>

                      {/* 7. Lifetime Value Column */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatCurrency(c.lifetime_value)}
                        </span>
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
    </div>
  );
}
