import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  reportsApi,
  inquiriesApi,
  dealsApi,
  employeesApi,
  ordersApi,
  visitsApi,
  complaintsApi,
} from '../lib/api';
import { useEffect, useState } from 'react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import SalesQuotationModal from '../components/SalesQuotationModal';
import { formatLocalDate } from '../utils/dateUtils';
import { calculateOrdersTotalTonnage, getOrderTonnage } from '../utils/pricingEngine';
import {
  TrendingUp, ShoppingBag, ShieldAlert,
  ChevronRight, Calendar, Users, RefreshCw,
  ArrowUpRight, Award, AlertCircle, Layers,
  Plus, Truck, Sparkles,
  Activity, CheckCircle2, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { normalizeListResponse, queryKeys } from '../lib/queryKeys';
import SyncBiginButton from '../components/SyncBiginButton';

const normalizePhone = (phone?: string | null) =>
  String(phone || '').replace(/\D/g, '').slice(-10);

const unwrapListResponse = (response: any): any[] => {
  const raw = response?.data;
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw?.data) ? raw.data : [];
};

const getTargetMonths = (dateRange: DateFilterRange): number => {
  if (dateRange.preset === 'monthly') return 1;
  if (!dateRange.from || !dateRange.to) return 1;

  const from = new Date(`${dateRange.from}T00:00:00`);
  const to = new Date(`${dateRange.to}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 1;

  return Math.max(
    1,
    (to.getFullYear() - from.getFullYear()) * 12 +
      to.getMonth() -
      from.getMonth() +
      1,
  );
};

const buildOrderLeaderboard = (
  salespeople: any[],
  orders: any[],
  visits: any[],
  complaints: any[],
  dateRange: DateFilterRange,
) => {
  const targetMonths = getTargetMonths(dateRange);
  const tonnageTarget = 40 * targetMonths;

  return salespeople.map((salesperson: any) => {
    const phone = normalizePhone(salesperson.phone);
    const repOrders = orders.filter(
      (order: any) => normalizePhone(order.salesperson_phone) === phone,
    );
    const repVisits = visits.filter(
      (visit: any) => normalizePhone(visit.salesperson_phone) === phone,
    );
    const repComplaints = complaints.filter(
      (complaint: any) =>
        normalizePhone(complaint.reported_by) === phone &&
        complaint.status !== 'resolved',
    );
    const deliveredTonnage = repOrders.reduce(
      (sum: number, order: any) => sum + getOrderTonnage(order),
      0,
    );
    const orderPoints = Math.min(40, repOrders.length * 4);
    const visitPoints = Math.min(30, Math.round((repVisits.length / 40) * 30));
    const tonnagePoints = Math.min(
      30,
      Math.round((deliveredTonnage / tonnageTarget) * 30),
    );
    const complaintPenalty = Math.min(20, repComplaints.length * 10);

    return {
      ...salesperson,
      ordersCount: repOrders.length,
      visitsCount: repVisits.length,
      complaintsCount: repComplaints.length,
      deliveredTonnage: Math.round(deliveredTonnage * 10) / 10,
      kra_score: Math.max(
        0,
        Math.min(100, orderPoints + visitPoints + tonnagePoints - complaintPenalty),
      ),
    };
  }).sort((a, b) => b.kra_score - a.kra_score);
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedPhone, setSelectedPhone] = useState<string>('');

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'all',
    from: '2000-01-01',
    to: formatLocalDate(),
  });

  const fromDate = dateRange.from || '2000-01-01';
  const toDate = dateRange.to || formatLocalDate();

  useEffect(() => {
    document.title = 'Admin Overview - Enlight Sales OS';
  }, []);

  // Fetch employees list
  const { data: employeesRes = [], refetch: refetchEmployees } = useQuery({
    queryKey: queryKeys.employeesDirectory,
    queryFn: () => employeesApi.getAll().then(r => normalizeListResponse(r.data)).catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  const salespeople = (Array.isArray(employeesRes) ? employeesRes : []).filter(
    (e: any) => e.role === 'salesperson' || e.role === 'sales_lead'
  );

  const selectedSalesperson = salespeople.find(
    (s: any) => normalizePhone(s.phone) === normalizePhone(selectedPhone),
  );

  const queryParams = {
    ...(selectedPhone ? { salesperson_phone: selectedPhone } : {}),
    from: fromDate,
    to: toDate,
  };

  // Queries with dynamic parameters
  const { data: monthly, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery({
    queryKey: ['admin-monthly', selectedPhone, dateRange],
    queryFn: () => reportsApi.getMonthly(queryParams).then(r => r.data?.data || r.data),
    placeholderData: keepPreviousData,
  });

  const { data: funnel, isLoading: funnelLoading, refetch: refetchFunnel } = useQuery({
    queryKey: ['admin-funnel', selectedPhone, dateRange],
    queryFn: () => reportsApi.getFunnel(queryParams).then(r => r.data?.data || r.data),
    placeholderData: keepPreviousData,
  });

  const { data: sku, isLoading: skuLoading, refetch: refetchSku } = useQuery({
    queryKey: ['admin-sku', selectedPhone, dateRange],
    queryFn: () => reportsApi.getSku(queryParams).then(r => r.data?.data || r.data),
    placeholderData: keepPreviousData,
  });

  const { data: inquiries, isLoading: inquiriesLoading, refetch: refetchInquiries } = useQuery({
    queryKey: ['admin-inquiries-queue'],
    queryFn: () => inquiriesApi.getReviewQueue().then(r => r.data?.data || r.data),
    placeholderData: keepPreviousData,
  });

  const { data: deals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['admin-recent-deals', selectedPhone, dateRange],
    queryFn: () => dealsApi.getAll({ ...queryParams, from: fromDate, to: toDate }).then(r => r.data?.data || r.data),
    placeholderData: keepPreviousData,
  });

  const { data: leaderboardOrders, isLoading: leaderboardOrdersLoading, refetch: refetchLeaderboardOrders } = useQuery({
    queryKey: ['admin-leaderboard-orders', selectedPhone, dateRange],
    queryFn: () =>
      ordersApi
        .getAll({
          ...(selectedPhone ? { salesperson_phone: selectedPhone } : {}),
          from: fromDate,
          to: toDate,
        })
        .then(unwrapListResponse),
  });

  const { data: leaderboardVisits, isLoading: leaderboardVisitsLoading, refetch: refetchLeaderboardVisits } = useQuery({
    queryKey: ['admin-leaderboard-visits', selectedPhone, dateRange],
    queryFn: () =>
      visitsApi
        .getAll({
          ...(selectedPhone ? { salesperson_phone: selectedPhone } : {}),
          from: fromDate,
          to: toDate,
        })
        .then(unwrapListResponse),
  });

  const { data: leaderboardComplaints, isLoading: leaderboardComplaintsLoading, refetch: refetchLeaderboardComplaints } = useQuery({
    queryKey: ['admin-leaderboard-complaints', selectedPhone, dateRange],
    queryFn: () =>
      complaintsApi
        .getAll({
          ...(selectedPhone ? { salesperson_phone: selectedPhone } : {}),
          from: fromDate,
          to: toDate,
        })
        .then(unwrapListResponse),
  });

  const [selectedQuotationDeal, setSelectedQuotationDeal] = useState<any | null>(null);
  const [isScoreInfoOpen, setIsScoreInfoOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isScoreInfoOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsScoreInfoOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isScoreInfoOpen]);

  const handleRefreshAll = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchEmployees(),
        refetchMonthly(),
        refetchFunnel(),
        refetchSku(),
        refetchInquiries(),
        refetchDeals(),
        refetchLeaderboardOrders(),
        refetchLeaderboardVisits(),
        refetchLeaderboardComplaints(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading =
    monthlyLoading ||
    funnelLoading ||
    skuLoading ||
    inquiriesLoading ||
    dealsLoading ||
    leaderboardOrdersLoading ||
    leaderboardVisitsLoading ||
    leaderboardComplaintsLoading;

  if (isLoading) return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs animate-pulse flex justify-between items-center">
        <div>
          <div className="h-8 bg-slate-200 rounded-lg w-64 mb-2" />
          <div className="h-4 bg-slate-200 rounded-lg w-96" />
        </div>
        <div className="h-10 bg-slate-200 rounded-xl w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-200 rounded-2xl" />
        ))}
      </div>
      <div className="animate-pulse h-64 bg-slate-200 rounded-2xl" />
    </div>
  );

  const leaderboardRows = buildOrderLeaderboard(
    salespeople,
    Array.isArray(leaderboardOrders) ? leaderboardOrders : [],
    Array.isArray(leaderboardVisits) ? leaderboardVisits : [],
    Array.isArray(leaderboardComplaints) ? leaderboardComplaints : [],
    dateRange,
  );
  const reviewQueue = inquiries?.data || inquiries || [];
  const getLeaderboardDisplayName = (sp: any) => {
    const apiName = String(sp?.name || '').trim();
    if (apiName && apiName !== 'Unknown' && apiName !== 'Sales Representative') {
      return apiName;
    }

    const phone = normalizePhone(sp?.salesperson_phone);
    const employee = salespeople.find(
      (candidate: any) => normalizePhone(candidate.phone) === phone,
    );
    return (
      employee?.name ||
      sp?.employee_id ||
      employee?.employee_id ||
      sp?.salesperson_phone ||
      phone ||
      'Sales Representative'
    );
  };
  const rawDeals = Array.isArray(deals) ? deals : (Array.isArray(deals?.data) ? deals.data : []);
  const recentDeals = rawDeals.slice(0, 6);

  const wonDealsList = rawDeals.filter((d: any) => d.stage === 'won');
  const activeDealsList = rawDeals.filter((d: any) => !['won', 'lost'].includes(d.stage));
  const lostDealsList = rawDeals.filter((d: any) => d.stage === 'lost');

  const dealsTotalPipelineVal = activeDealsList.reduce((sum: number, d: any) => sum + (Number(d.total_amount) || 0), 0);
  const dealsWonVal = wonDealsList.reduce((sum: number, d: any) => sum + (Number(d.total_amount) || 0), 0);

  const totalDeals = rawDeals.length > 0 ? rawDeals.length : (monthly?.summary?.total_deals || 0);
  const activeDealsCount = activeDealsList.length > 0 ? activeDealsList.length : (monthly?.summary?.deals_pending || 0);
  const wonDealsCount = wonDealsList.length > 0 ? wonDealsList.length : (monthly?.summary?.deals_won || monthly?.summary?.won || 0);
  const lostDealsCount = lostDealsList.length;

  const totalValue = dealsTotalPipelineVal > 0 ? dealsTotalPipelineVal : (monthly?.summary?.pipeline_value || monthly?.summary?.total_revenue || monthly?.summary?.total_value || 0);
  const wonValue = dealsWonVal > 0 ? dealsWonVal : (monthly?.summary?.won_revenue || monthly?.summary?.won_value || monthly?.summary?.total_revenue || 0);
  const conversionRate = totalDeals > 0 ? Math.round((wonDealsCount / totalDeals) * 100) : (monthly?.summary?.conversion_rate || 0);

  // Delivered Tonnage (summed live from won deal items in MT via centralized pricingEngine)
  const deliveredTonnageResult = calculateOrdersTotalTonnage(wonDealsList);
  const deliveredTonnage = deliveredTonnageResult.totalMt;

  // Pipeline / Active Tonnage (summed live from active deals)
  const activeTonnageResult = calculateOrdersTotalTonnage(activeDealsList);
  const activeTonnage = activeTonnageResult.totalMt;
  const totalTonnage = deliveredTonnage + activeTonnage;

  // Real data-driven percentages & metrics
  const activeDealsPct = totalDeals > 0 ? Math.round((activeDealsCount / totalDeals) * 100) : 0;
  const deliveredTonnagePct = totalTonnage > 0 ? Math.round((deliveredTonnage / totalTonnage) * 100) : (deliveredTonnage > 0 ? 100 : 0);
  const totalCombinedValue = wonValue + totalValue;
  const wonValueSharePct = totalCombinedValue > 0 ? Math.round((wonValue / totalCombinedValue) * 100) : 0;

  // Find selected salesperson specific KRA metrics from reports response
  const selectedKRA = leaderboardRows.find(
    (s: any) => normalizePhone(s.phone) === normalizePhone(selectedPhone),
  );

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Title, Meta Info & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Admin Overview Dashboard
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-1">
                  <Users size={12} /> {selectedSalesperson ? selectedSalesperson.name : 'Company-Wide (All Salespersons)'}
                </span>
                {selectedSalesperson && (
                  <button
                    type="button"
                    onClick={() => setSelectedPhone('')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  >
                    Company-Wide
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
                <Calendar size={13} className="text-slate-400" /> {todayStr}
              </p>
            </div>
          </div>

          {/* Top Actions: Refresh, Create Order */}
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            <SyncBiginButton onSynced={handleRefreshAll} />
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              title="Refresh All Dashboard Metrics"
              className="h-9 w-9 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-60 shrink-0"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => navigate('/orders')}
              className="h-9 flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
            >
              <Plus size={15} /> Create Order
            </button>
          </div>
        </div>

        {/* Row 2: Filter Toolbar (Date range, Salesperson Filter) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <DateFilterControl onChange={setDateRange} initialPreset={dateRange.preset} />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 self-start sm:self-auto">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Filter:</span>
            <select
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] max-w-[280px] truncate cursor-pointer"
            >
              <option value="">All Salespeople (Global)</option>
              {salespeople.map((sp: any) => (
                <option key={sp.phone} value={normalizePhone(sp.phone)}>
                  {sp.name} ({sp.employee_id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Executive Stat Cards (Matching Home Dashboard Layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: TOTAL PIPELINE VALUE */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              TOTAL PIPELINE VALUE
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              {'\u20B9'}{Number(totalValue).toLocaleString('en-IN')}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full border ${
                activeDealsCount > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                <Activity size={12} /> {activeDealsPct}% in pipeline
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {activeDealsCount} of {totalDeals} active
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: TOTAL TONNAGE */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              TOTAL TONNAGE
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600">
              {Number(deliveredTonnage.toFixed(3)).toLocaleString('en-IN')} MT
            </h2>
            
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full border ${
                deliveredTonnage > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : activeTonnage > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {deliveredTonnage > 0 ? (
                  <>
                    <ArrowUpRight size={12} /> {deliveredTonnagePct}% fulfilled
                  </>
                ) : activeTonnage > 0 ? (
                  <>
                    <Activity size={12} /> {activeTonnage.toFixed(2)} MT active
                  </>
                ) : (
                  <>0 MT tracked</>
                )}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {activeTonnage > 0 ? `${activeTonnage.toFixed(2)} MT pipeline` : `${wonDealsCount} delivered orders`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: CONVERSION RATE */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              CONVERSION RATE
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-blue-600">
              {conversionRate}%
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full border ${
                conversionRate >= 50
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : conversionRate > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {conversionRate > 0 ? (
                  <>
                    <TrendingUp size={12} /> {wonDealsCount} Won / {totalDeals}
                  </>
                ) : (
                  <>
                    <Activity size={12} /> {wonDealsCount} of {totalDeals} won
                  </>
                )}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {lostDealsCount > 0 ? `${lostDealsCount} lost` : `${activeDealsCount} in progress`}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: INQUIRIES / KRA SCORE */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              {selectedKRA ? 'KRA PERFORMANCE SCORE' : 'REVIEW QUEUE'}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              {selectedKRA ? <Award size={18} /> : <AlertCircle size={18} />}
            </div>
          </div>

          <div className="mt-4">
            {selectedKRA ? (
              <>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-indigo-600">
                  {Math.round(Number(selectedKRA.kra_score) || 0)}/100
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Award size={12} /> {selectedKRA.ordersCount || 0} orders
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedKRA.visitsCount || 0} visits
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-600">
                  {reviewQueue.length}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full border ${
                    reviewQueue.length > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {reviewQueue.length > 0 ? (
                      <>
                        <AlertCircle size={12} /> Needs Review
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={12} /> All Clear
                      </>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {reviewQueue.length > 0 ? `${reviewQueue.length} pending inquiries` : '0 pending AI inquiries'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Featured Total Sales Overview Value Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              TOTAL SALES PERFORMANCE
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {'\u20B9'}{Number(wonValue || totalValue).toLocaleString('en-IN')}
              </h2>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
                wonValue > 0
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : totalValue > 0
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {wonValue > 0 ? (
                  <>
                    <ArrowUpRight size={13} /> {wonValueSharePct}% Won Revenue
                  </>
                ) : totalValue > 0 ? (
                  <>
                    <Activity size={13} /> 100% Pipeline Active
                  </>
                ) : (
                  <>No Deals Tracked</>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
              <Sparkles size={14} className="text-amber-500" />
              {wonValue > 0 ? (
                <span>
                  Company closed <strong>{'\u20B9'}{Number(wonValue).toLocaleString('en-IN')}</strong> across {wonDealsCount} order(s) ({deliveredTonnage.toFixed(2)} MT)
                  {totalValue > 0 ? ` with \u20B9${Number(totalValue).toLocaleString('en-IN')} (${activeTonnage.toFixed(2)} MT) in active negotiation.` : '.'}
                </span>
              ) : totalValue > 0 ? (
                <span>
                  Active pipeline tracking <strong>{'\u20B9'}{Number(totalValue).toLocaleString('en-IN')}</strong> across {activeDealsCount} deal(s) ({activeTonnage.toFixed(2)} MT) in quotation and negotiation.
                </span>
              ) : (
                <span>No active deals or closed orders found in the selected date range.</span>
              )}
            </p>
          </div>

          <button
            onClick={() => navigate('/pipeline')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200 transition-colors shadow-2xs hover:bg-blue-100 self-start sm:self-auto"
          >
            Detailed Analytics <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Breakdown Section (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Recent Deals & Product Distribution) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Recent Company-wide Deals Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {selectedSalesperson
                    ? `Recent Deals by ${selectedSalesperson.name}`
                    : 'Recent Company-wide Deals'}
                </h3>
              </div>
              <button
                onClick={() => navigate('/pipeline')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Go to Pipeline <ChevronRight size={14} />
              </button>
            </div>

            <div className="p-4 space-y-2.5">
              {recentDeals.length > 0 ? (
                recentDeals.map((deal: any) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-blue-50/50 rounded-xl border border-slate-100 transition-colors group cursor-pointer"
                    onClick={() => setSelectedQuotationDeal(deal)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm shadow-2xs group-hover:border-blue-300">
                        {deal.customer_name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {deal.customer_name || 'Unknown Customer'}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          PO Number: {deal.po_number || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">
                        {'\u20B9'}{Number(deal.total_amount || 0).toLocaleString('en-IN')}
                      </p>
                      <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize mt-0.5 border ${
                        deal.stage === 'won'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : deal.stage === 'lost'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {deal.stage?.replace('_', ' ') || 'Open'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No recent deals found for this period.
                </div>
              )}
            </div>
          </div>

          {/* Product / SKU Distribution Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Product / SKU Distribution &amp; Demand
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">Top Active Materials</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-white text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">SKU / Product Name</th>
                    <th className="px-4 py-3 text-right">Total Qty</th>
                    <th className="px-4 py-3 text-center">Unit</th>
                    <th className="px-4 py-3 text-right">Total Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(sku?.skus || []).slice(0, 5).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs truncate">
                        {item.sku_text}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-800">
                        {item.total_quantity || '-'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs font-bold">
                        {item.unit || 'MT'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">
                        {item.total_value ? `\u20B9${Number(item.total_value).toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {(sku?.skus || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                        No SKU breakdown data available for this selection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column (Funnel Breakdown & Leaderboard) */}
        <div className="space-y-6">
          
          {/* Funnel Conversion Breakdown Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Funnel Conversion Breakdown
                </h3>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {(() => {
                const funnelList = funnel?.funnel || [];
                const maxCount = Math.max(
                  ...funnelList.map((s: any) => Number(s.count) || 0),
                  1
                );
                return funnelList.map((stage: any) => {
                  const count = Number(stage.count) || 0;
                  const pct = count > 0 ? Math.round((count / maxCount) * 100) : 0;

                  return (
                    <div key={stage.stage} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span>
                        {stage.label ||
                          (stage.stage === 'new_inquiry' || stage.stage === 'new_deals'
                            ? 'New Inquiry'
                            : stage.stage === 'quoted' || stage.stage === 'qualified'
                            ? 'Price Quote'
                            : stage.stage === 'on_hold'
                            ? 'On Hold'
                            : stage.stage === 'won'
                            ? 'Closed Won'
                            : stage.stage === 'lost'
                            ? 'Closed Lost'
                            : String(stage.stage).replace('_', ' '))}
                      </span>
                      <span className="text-slate-900 font-semibold">{stage.count} deal{stage.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
            </div>
          </div>

          {/* Salesperson Leaderboard Card */}
          {!selectedSalesperson && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-visible">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-amber-500" />
                  <h3 className="font-bold text-slate-900 text-sm">Leaderboard Scores</h3>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="How leaderboard scores are calculated"
                      aria-expanded={isScoreInfoOpen}
                      aria-controls="leaderboard-score-explanation"
                      title="How leaderboard scores are calculated"
                      onClick={() => setIsScoreInfoOpen((open) => !open)}
                      className="w-5 h-5 rounded-full border border-slate-300 text-slate-500 hover:text-blue-700 hover:border-blue-300 hover:bg-blue-50 inline-flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Info size={12} />
                    </button>
                    {isScoreInfoOpen && (
                      <div
                        id="leaderboard-score-explanation"
                        role="dialog"
                        aria-label="Leaderboard score calculation"
                        className="absolute right-0 top-7 z-50 w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3.5 text-[11px] leading-4 text-slate-600 shadow-xl"
                      >
                        <p className="font-bold text-slate-900 text-xs leading-5">How the score is calculated</p>
                        <ul className="mt-2 space-y-1.5 list-disc pl-4">
                          <li>Won orders: up to 40 points.</li>
                          <li>Visits: up to 30 points against a 40-visit target.</li>
                          <li>Delivered tonnage: up to 30 points against a 40 MT monthly target.</li>
                          <li>Pending complaints deduct up to 20 points.</li>
                        </ul>
                        <p className="mt-2 font-semibold text-slate-700">Final score is clamped between 0 and 100.</p>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-blue-600">Company-Wide</span>
              </div>

              <div className="p-4 space-y-2">
                {leaderboardRows.slice(0, 5).map((sp: any) => {
                  const displayName = getLeaderboardDisplayName({
                    ...sp,
                    salesperson_phone: sp.phone,
                  });
                  return (
                    <div
                      key={sp.phone || sp.employee_id}
                      onClick={() => setSelectedPhone(normalizePhone(sp.phone))}
                      className="flex items-center justify-between p-3 hover:bg-blue-50/50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-100 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                            {displayName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {sp.ordersCount} orders · {sp.visitsCount} visits
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-xl border border-blue-200">
                        {Math.round(Number(sp.kra_score) || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Render Official Sales Quotation & Invoice Modal when clicking any deal */}
      {selectedQuotationDeal && (
        <SalesQuotationModal
          deal={selectedQuotationDeal}
          onClose={() => setSelectedQuotationDeal(null)}
        />
      )}
    </div>
  );
}
