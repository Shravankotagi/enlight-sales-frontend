import { useQuery } from '@tanstack/react-query';
import { reportsApi, inquiriesApi, dealsApi, employeesApi } from '../lib/api';
import { useEffect, useState } from 'react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import SalesQuotationModal from '../components/SalesQuotationModal';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';
import {
  TrendingUp, ShoppingBag, ShieldAlert,
  ChevronRight, Calendar, Users, RefreshCw,
  ArrowUpRight, Award, CheckCircle2, AlertCircle, Layers,
  Sparkles, Plus, Upload, Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = [2025, 2026, 2027];

  const fromDate = dateRange.from || new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0)).toISOString();
  const toDate = dateRange.to || new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)).toISOString();

  useEffect(() => {
    document.title = 'Admin Overview - Enlight Sales OS';
  }, []);

  // Fetch employees list
  const { data: employeesRes } = useQuery({
    queryKey: ['admin-employees-list'],
    queryFn: () => employeesApi.getAll().then(r => r.data),
  });

  const salespeople = (employeesRes?.data || employeesRes || []).filter(
    (e: any) => e.role === 'salesperson' || e.role === 'sales_lead'
  );

  const selectedSalesperson = salespeople.find((s: any) => s.phone === selectedPhone);

  const queryParams = {
    ...(selectedPhone ? { salesperson_phone: selectedPhone } : {}),
    month: dateRange.preset === 'monthly' ? dateRange.month : selectedMonth,
    year: dateRange.preset === 'monthly' ? dateRange.year : selectedYear,
    from: fromDate,
    to: toDate,
  };

  // Queries with dynamic parameters
  const { data: monthly, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery({
    queryKey: ['admin-monthly', selectedPhone, selectedMonth, selectedYear, dateRange],
    queryFn: () => reportsApi.getMonthly(queryParams).then(r => r.data?.data || r.data),
  });

  const { data: funnel, isLoading: funnelLoading, refetch: refetchFunnel } = useQuery({
    queryKey: ['admin-funnel', selectedPhone, selectedMonth, selectedYear, dateRange],
    queryFn: () => reportsApi.getFunnel(queryParams).then(r => r.data?.data || r.data),
  });

  const { data: sku, isLoading: skuLoading, refetch: refetchSku } = useQuery({
    queryKey: ['admin-sku', selectedPhone, selectedMonth, selectedYear, dateRange],
    queryFn: () => reportsApi.getSku(queryParams).then(r => r.data?.data || r.data),
  });

  const { data: salesperson, isLoading: salespersonLoading, refetch: refetchSalesperson } = useQuery({
    queryKey: ['admin-salesperson', selectedMonth, selectedYear, dateRange],
    queryFn: () => reportsApi.getSalesperson({ month: selectedMonth, year: selectedYear, from: fromDate, to: toDate }).then(r => r.data?.data || r.data),
  });

  const { data: inquiries, isLoading: inquiriesLoading, refetch: refetchInquiries } = useQuery({
    queryKey: ['admin-inquiries-queue'],
    queryFn: () => inquiriesApi.getReviewQueue().then(r => r.data?.data || r.data),
  });

  const { data: deals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['admin-recent-deals', selectedPhone, selectedMonth, selectedYear, dateRange],
    queryFn: () => dealsApi.getAll({ ...queryParams, from: fromDate, to: toDate }).then(r => r.data?.data || r.data),
  });

  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedQuotationDeal, setSelectedQuotationDeal] = useState<any | null>(null);

  const handleRefreshAll = () => {
    refetchMonthly();
    refetchFunnel();
    refetchSku();
    refetchSalesperson();
    refetchInquiries();
    refetchDeals();
  };

  const handlePushToBigin = async () => {
    setIsPushing(true);
    setSyncMsg(null);
    try {
      await axios.get('https://enlight-sales-bot-production.up.railway.app/bigin-sync');
      setSyncMsg({ text: '✅ Database records & live deals pushed to Zoho Bigin CRM successfully!', type: 'success' });
      handleRefreshAll();
    } catch (err: any) {
      setSyncMsg({ text: `❌ Push failed: ${err.message || 'Error pushing to Bigin'}`, type: 'error' });
    } finally {
      setIsPushing(false);
      setTimeout(() => setSyncMsg(null), 6000);
    }
  };

  const handlePullFromBigin = async () => {
    setIsPulling(true);
    setSyncMsg(null);
    try {
      await axios.get('https://enlight-sales-bot-production.up.railway.app/bigin-import');
      setSyncMsg({ text: '📥 Contacts & active deals pulled from Zoho Bigin CRM to Database!', type: 'success' });
      handleRefreshAll();
    } catch (err: any) {
      setSyncMsg({ text: `❌ Pull failed: ${err.message || 'Error pulling from Bigin'}`, type: 'error' });
    } finally {
      setIsPulling(false);
      setTimeout(() => setSyncMsg(null), 6000);
    }
  };

  const isLoading = monthlyLoading || funnelLoading || skuLoading || salespersonLoading || inquiriesLoading || dealsLoading;

  if (isLoading) return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
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

  const spList = salesperson?.salespersons || salesperson || [];
  const reviewQueue = inquiries?.data || inquiries || [];
  const rawDeals = Array.isArray(deals) ? deals : (Array.isArray(deals?.data) ? deals.data : []);
  const recentDeals = rawDeals.slice(0, 6);

  const wonDealsList = rawDeals.filter((d: any) => d.stage === 'won');
  const activeDealsList = rawDeals.filter((d: any) => !['won', 'lost'].includes(d.stage));

  const dealsTotalPipelineVal = activeDealsList.reduce((sum: number, d: any) => sum + (Number(d.total_amount) || 0), 0);
  const dealsWonVal = wonDealsList.reduce((sum: number, d: any) => sum + (Number(d.total_amount) || 0), 0);

  const totalDeals = rawDeals.length > 0 ? rawDeals.length : (monthly?.summary?.total_deals || 0);
  const activeDealsCount = activeDealsList.length > 0 ? activeDealsList.length : (monthly?.summary?.deals_pending || 0);
  const wonDealsCount = wonDealsList.length > 0 ? wonDealsList.length : (monthly?.summary?.deals_won || monthly?.summary?.won || 0);
  const totalValue = dealsTotalPipelineVal > 0 ? dealsTotalPipelineVal : (monthly?.summary?.pipeline_value || monthly?.summary?.total_revenue || monthly?.summary?.total_value || 0);
  const wonValue = dealsWonVal > 0 ? dealsWonVal : (monthly?.summary?.won_revenue || monthly?.summary?.won_value || monthly?.summary?.total_revenue || 0);
  const conversionRate = totalDeals > 0 ? Math.round((wonDealsCount / totalDeals) * 100) : (monthly?.summary?.conversion_rate || 0);

  // Find selected salesperson specific KRA metrics from reports response
  const selectedKRA = spList.find((s: any) => s.salesperson_phone === selectedPhone);

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Top Header & Navigation Banner (Identical to Home Page UI) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md">
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
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
              <Calendar size={13} className="text-slate-400" /> {todayStr}
            </p>
          </div>
        </div>

        {/* Dynamic Filters & Refresh Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Date Range Filter (This Month, Last 7 Days, Last 15 Days, Custom Date Range) */}
          <DateFilterControl onChange={setDateRange} initialPreset={dateRange.preset} />

          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {months.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Filter:</span>
            <select
              value={selectedPhone}
              onChange={(e) => setSelectedPhone(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
            >
              <option value="">All Salespeople (Global)</option>
              {salespeople.map((sp: any) => (
                <option key={sp.phone} value={sp.phone}>
                  {sp.name} ({sp.employee_id})
                </option>
              ))}
            </select>
          </div>

          {/* Both Zoho Bigin Sync Action Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={handlePushToBigin}
              disabled={isPushing || isPulling}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="Push all database contacts and live ongoing deals to Zoho Bigin CRM"
            >
              <Upload size={13} className={isPushing ? 'animate-spin' : ''} />
              {isPushing ? 'Pushing...' : 'Push DB → Bigin'}
            </button>

            <button
              onClick={handlePullFromBigin}
              disabled={isPushing || isPulling}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="Pull all customer contacts and active deals from Zoho Bigin CRM into database"
            >
              <Download size={13} className={isPulling ? 'animate-spin' : ''} />
              {isPulling ? 'Pulling...' : 'Pull Bigin → DB'}
            </button>
          </div>

          <button
            onClick={handleRefreshAll}
            title="Refresh All Dashboard Metrics"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={() => navigate('/orders')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus size={15} /> Create Order
          </button>
        </div>
      </div>

      {/* Sync Status Toast Banner */}
      {syncMsg && (
        <div className={`px-4 py-3 rounded-2xl border font-bold text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200 ${
          syncMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span className="flex items-center gap-2">{syncMsg.text}</span>
          <button onClick={() => setSyncMsg(null)} className="font-black opacity-70 hover:opacity-100 ml-3">✕</button>
        </div>
      )}

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
              ₹{Number(totalValue).toLocaleString('en-IN')}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ArrowUpRight size={12} /> +15.2%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {activeDealsCount || totalDeals} active deals
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: WON ORDERS VALUE */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              WON ORDERS VALUE
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-600">
              ₹{Number(wonValue).toLocaleString('en-IN')}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ArrowUpRight size={12} /> +25%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {wonDealsCount} deals closed won
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
              <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Target: 70%
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Pipeline efficiency
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
                  {selectedKRA.kra_score}/100
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Visits: {selectedKRA.visits?.total || 0}/40
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Monthly Target
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-600">
                  {reviewQueue.length}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Needs Review
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Low AI extraction
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* TOTAL SALES PERFORMANCE Card (Matching Home Dashboard) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              COMPANY SALES PERFORMANCE
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                ₹{Number(wonValue || totalValue).toLocaleString('en-IN')}
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ArrowUpRight size={13} /> +12.5%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
              <Sparkles size={14} className="text-amber-500" />
              Yay! Company sales have surged this month across all metal product categories!
            </p>
          </div>

          <button
            onClick={() => navigate('/pipeline')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-200 transition-colors self-start sm:self-auto"
          >
            Detailed Analytics <ChevronRight size={14} />
          </button>
        </div>

        {/* Multi-segment Sales Progress Bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 p-0.5 border border-slate-200">
          <div className="bg-blue-600 h-full rounded-l-full transition-all" style={{ width: '50%' }} title="Won Orders" />
          <div className="bg-amber-500 h-full transition-all" style={{ width: '25%' }} title="In Negotiation" />
          <div className="bg-emerald-500 h-full transition-all" style={{ width: '15%' }} title="Qualified" />
          <div className="bg-purple-600 h-full rounded-r-full transition-all" style={{ width: '10%' }} title="New Inquiries" />
        </div>

        {/* 4 Colorful Sub-Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
            <span className="text-xs font-semibold text-blue-600 block">Won Orders Sales</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">₹{Number(wonValue).toLocaleString('en-IN')}</span>
          </div>

          <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
            <span className="text-xs font-semibold text-amber-700 block">Active Pipeline Deals</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{activeDealsCount || totalDeals} Confirmed</span>
          </div>

          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-xs font-semibold text-emerald-700 block">Conversion Rate</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{conversionRate}% Target</span>
          </div>

          <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
            <span className="text-xs font-semibold text-purple-700 block">Sales Representatives</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block">{salespeople.length} Active Accounts</span>
          </div>
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
                        ₹{Number(deal.total_amount || 0).toLocaleString('en-IN')}
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
                        {item.total_value ? `₹${Number(item.total_value).toLocaleString('en-IN')}` : '-'}
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
              {(funnel?.funnel || []).map((stage: any) => {
                const maxCount = funnel.funnel[0]?.count > 0 ? funnel.funnel[0].count : 1;
                const pct = Math.round((stage.count / maxCount) * 100);

                return (
                  <div key={stage.stage} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                      <span className="capitalize">{stage.stage?.replace('_', ' ')}</span>
                      <span className="text-slate-900">{stage.count} deals</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Salesperson Leaderboard Card */}
          {!selectedSalesperson && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-amber-500" />
                  <h3 className="font-bold text-slate-900 text-sm">Leaderboard Scores</h3>
                </div>
                <span className="text-xs font-bold text-blue-600">Company-Wide</span>
              </div>

              <div className="p-4 space-y-2">
                {spList.slice(0, 5).map((sp: any) => (
                  <div
                    key={sp.salesperson_phone}
                    onClick={() => setSelectedPhone(sp.salesperson_phone)}
                    className="flex items-center justify-between p-3 hover:bg-blue-50/50 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-blue-100 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {sp.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {sp.name || 'Sales Representative'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {sp.deals?.total || 0} deals · {sp.visits?.total || 0} visits
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-xl border border-blue-200">
                      {sp.kra_score}
                    </span>
                  </div>
                ))}
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
