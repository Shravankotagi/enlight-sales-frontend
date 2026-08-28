import { useQuery } from '@tanstack/react-query';
import { customersApi, dealsApi } from '../lib/api';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  TrendingDown,
  TrendingUp,
  Brain,
  Check,
} from 'lucide-react';

export default function IntelligencePage() {
  const auth = useAuth();
  const salespersonPhone = auth?.effectivePhone || undefined;

  useEffect(() => {
    document.title = 'Intelligence Center - Enlight Sales OS';
  }, []);

  // ── Real Data Queries ───────────────────────────────────────────────────────
  const { data: churnData = [] } = useQuery({
    queryKey: ['churn-risk', salespersonPhone],
    queryFn: () =>
      customersApi
        .getChurnRisk({ salesperson_phone: salespersonPhone })
        .then((r) => r.data?.data || r.data || []),
  });

  const { data: reorderData = [] } = useQuery({
    queryKey: ['reorder-queue', salespersonPhone],
    queryFn: () =>
      customersApi
        .getReorderQueue({ salesperson_phone: salespersonPhone })
        .then((r) => r.data?.data || r.data || []),
  });

  const { data: lossData } = useQuery({
    queryKey: ['loss-analytics', salespersonPhone],
    queryFn: () =>
      customersApi
        .getLossAnalytics({ salesperson_phone: salespersonPhone })
        .then((r) => r.data?.data || r.data || {}),
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['recurring-customers-list', salespersonPhone],
    queryFn: () =>
      customersApi
        .getAll({ salesperson_phone: salespersonPhone })
        .then((r) => {
          const raw = r.data?.data || r.data;
          return Array.isArray(raw) ? raw : [];
        }),
  });

  const { data: dealsData = [] } = useQuery({
    queryKey: ['intelligence-deals', salespersonPhone],
    queryFn: () =>
      dealsApi
        .getAll({ salesperson_phone: salespersonPhone })
        .then((r) => {
          const raw = r.data?.data || r.data;
          return Array.isArray(raw) ? raw : [];
        }),
  });

  // ── Section 1: Churn Radar Metrics ──────────────────────────────────────────
  const churnList = Array.isArray(churnData) ? churnData : [];
  const healthyCustomers = useMemo(
    () => churnList.filter((c: any) => c.churn_risk === 'active' || !c.churn_risk),
    [churnList]
  );
  const atRiskCustomers = useMemo(
    () => churnList.filter((c: any) => c.churn_risk === 'at_risk'),
    [churnList]
  );
  const highRiskCustomers = useMemo(
    () =>
      churnList.filter(
        (c: any) =>
          c.churn_risk === 'churning' ||
          c.churn_risk === 'credit_watch' ||
          c.churn_risk === 'high'
      ),
    [churnList]
  );

  const totalMonitoredAccounts = churnList.length;
  const healthyCount = healthyCustomers.length;
  const atRiskCount = atRiskCustomers.length;
  const highRiskCount = highRiskCustomers.length;

  const healthyPct =
    totalMonitoredAccounts > 0
      ? Math.round((healthyCount / totalMonitoredAccounts) * 100)
      : 100;
  const atRiskPct =
    totalMonitoredAccounts > 0
      ? Math.round((atRiskCount / totalMonitoredAccounts) * 100)
      : 0;
  const highRiskPct =
    totalMonitoredAccounts > 0
      ? Math.round((highRiskCount / totalMonitoredAccounts) * 100)
      : 0;

  const lastScanFormatted = useMemo(() => {
    const d = new Date();
    const datePart = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d
      .toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
      .toLowerCase();
    return `${datePart}, ${timePart}`;
  }, []);

  // ── Section 2: Reorder Queue Metrics ────────────────────────────────────────
  const reorderList = Array.isArray(reorderData) ? reorderData : [];
  const predictedCount = reorderList.length;
  const customersTrackedCount =
    allCustomers.length > 0 ? allCustomers.length : totalMonitoredAccounts;

  const avgReorderCycle = useMemo(() => {
    if (!allCustomers || allCustomers.length === 0) return 30;
    const sum = allCustomers.reduce(
      (acc: number, c: any) => acc + (Number(c.avg_order_frequency_days) || 30),
      0
    );
    return Math.round(sum / allCustomers.length) || 30;
  }, [allCustomers]);

  // ── Section 3: Loss Analytics Metrics ───────────────────────────────────────
  const totalLostCount = lossData?.total_lost ?? 0;
  const totalLostValue = lossData?.total_lost_value ?? 0;

  const allDealsList = Array.isArray(dealsData) ? dealsData : [];
  const wonDealsCount = useMemo(
    () => allDealsList.filter((d: any) => d.stage === 'won').length,
    [allDealsList]
  );
  const totalDecided = wonDealsCount + totalLostCount;
  const winRate =
    totalDecided > 0 ? Math.round((wonDealsCount / totalDecided) * 100) : 99;

  const lossReasonsList: any[] = Array.isArray(lossData?.by_reason)
    ? lossData.by_reason
    : [];

  const recentLossesList: any[] = Array.isArray(lossData?.recent_losses)
    ? lossData.recent_losses
    : Array.isArray(lossData?.deals)
      ? lossData.deals
      : [];

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Brain size={28} className="text-blue-600" />
            Intelligence Center
          </h1>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 - CHURN RADAR
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            01 CHURN RADAR
          </span>
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: HEALTHY */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700 text-xs font-bold uppercase tracking-wider">
                HEALTHY
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-gray-900">
                {healthyCount}
              </span>
              <span className="text-sm font-medium text-slate-500">
                customers
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <span>Engagement and order cadence within normal range</span>
            </div>
          </div>

          {/* Card 2: AT RISK */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-amber-300 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-amber-700 text-xs font-bold uppercase tracking-wider">
                AT RISK
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-gray-900">
                {atRiskCount}
              </span>
              <span className="text-sm font-medium text-slate-500">
                customers
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <span>
                {atRiskCount === 0
                  ? 'No at-risk customers detected'
                  : `${atRiskCount} customer${atRiskCount > 1 ? 's' : ''} showing cadence delay`}
              </span>
            </div>
          </div>

          {/* Card 3: HIGH RISK */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-rose-300 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-rose-700 text-xs font-bold uppercase tracking-wider">
                HIGH RISK
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-bold text-gray-900">
                {highRiskCount}
              </span>
              <span className="text-sm font-medium text-slate-500">
                customers
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <span>
                {highRiskCount === 0
                  ? 'No high risk customers detected'
                  : `${highRiskCount} customer${highRiskCount > 1 ? 's' : ''} requiring urgent follow-up`}
              </span>
            </div>
          </div>
        </div>

        {/* Portfolio Risk Distribution Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              <h3 className="font-semibold text-gray-800">
                Portfolio Risk Distribution
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {healthyPct}% healthy
            </span>
          </div>

          <div className="text-xs text-slate-500">
            {totalMonitoredAccounts} accounts monitored
          </div>

          {/* Distribution Progress Bar */}
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${healthyPct}%` }}
              className="bg-emerald-500 h-full transition-all duration-500"
            />
            <div
              style={{ width: `${atRiskPct}%` }}
              className="bg-amber-400 h-full transition-all duration-500"
            />
            <div
              style={{ width: `${highRiskPct}%` }}
              className="bg-rose-500 h-full transition-all duration-500"
            />
          </div>

          {/* Legend & Timestamps */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-5 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                <span>Healthy - {healthyCount}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
                <span>At Risk - {atRiskCount}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                <span>High Risk - {highRiskCount}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Last scan: {lastScanFormatted}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 - REORDER QUEUE
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            02 REORDER QUEUE
          </span>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-xs">
            <p className="text-3xl font-bold text-blue-600">{predictedCount}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
              PREDICTED IN 14 DAYS
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-xs">
            <p className="text-3xl font-bold text-gray-900">
              {customersTrackedCount}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
              CUSTOMERS TRACKED
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-xs">
            <p className="text-3xl font-bold text-indigo-600">
              {avgReorderCycle}d
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
              AVG REORDER CYCLE
            </p>
          </div>
        </div>

        {/* 14-Day Forecast Window Timeline Box */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" />
            <h3 className="font-semibold text-gray-800">
              14-Day Forecast Window
            </h3>
          </div>

          {/* Timeline Axis */}
          <div className="relative px-3 pt-2">
            <div className="h-0.5 w-full bg-slate-200 relative">
              {/* Marker: Today */}
              <div className="absolute left-0 -top-1.5 flex flex-col items-center">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs" />
                <span className="text-[11px] font-bold text-blue-600 mt-2">
                  Today
                </span>
              </div>

              {/* Marker: +4d */}
              <div className="absolute left-[28%] -top-1 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-medium text-slate-400 mt-2">
                  +4d
                </span>
              </div>

              {/* Marker: +7d */}
              <div className="absolute left-[50%] -top-1 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-medium text-slate-400 mt-2">
                  +7d
                </span>
              </div>

              {/* Marker: +11d */}
              <div className="absolute left-[75%] -top-1 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-medium text-slate-400 mt-2">
                  +11d
                </span>
              </div>

              {/* Marker: +14d */}
              <div className="absolute right-0 -top-1 flex flex-col items-center">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span className="text-[11px] font-medium text-slate-400 mt-2">
                  +14d
                </span>
              </div>
            </div>
          </div>

          {/* Forecast Content Area */}
          {reorderList.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Clock size={20} />
              </div>
              <h4 className="text-sm font-semibold text-gray-800">
                No reorders predicted
              </h4>
              <p className="text-xs text-slate-400">
                Nothing forecasted in the next 14 days
              </p>
            </div>
          ) : (
            <div className="pt-4 divide-y divide-slate-100">
              {reorderList.map((item: any) => (
                <div
                  key={item.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 px-2 rounded-lg transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {item.customer_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Avg frequency: Every {item.avg_order_frequency_days}d · Last order:{' '}
                      {item.last_order_date
                        ? new Date(item.last_order_date).toLocaleDateString('en-IN')
                        : '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-700">
                      {item.predicted_reorder_date
                        ? new Date(item.predicted_reorder_date).toLocaleDateString(
                            'en-IN'
                          )
                        : '-'}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        item.is_overdue
                          ? 'bg-red-100 text-red-700'
                          : item.is_due_soon
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {item.is_overdue
                        ? `${Math.abs(item.days_until_reorder)}d overdue`
                        : item.is_due_soon
                        ? `In ${item.days_until_reorder}d (due soon)`
                        : `In ${item.days_until_reorder}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 - LOSS ANALYTICS
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            03 LOSS ANALYTICS
          </span>
        </div>

        {/* 2 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-xs">
            <p className="text-3xl font-bold text-red-600">{totalLostCount}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
              TOTAL LOST DEALS (3 MONTHS)
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-xs">
            <p className="text-3xl font-bold text-red-600">
              {'₹'}{Number(totalLostValue).toLocaleString('en-IN')}
            </p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
              TOTAL LOST VALUE
            </p>
          </div>
        </div>

        {/* Two-column Analytics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Card: Win / Loss Ratio */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-semibold text-gray-800">
                Win / Loss Ratio
              </h3>
            </div>

            <div className="flex items-center gap-6 pt-2">
              {/* SVG Donut Ring */}
              <div className="relative w-24 h-24 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="4"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-700"
                    strokeDasharray={`${winRate}, 100`}
                    strokeWidth="4"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>

              {/* Donut Stats */}
              <div className="space-y-1.5">
                <div>
                  <span className="text-3xl font-bold text-gray-900">
                    {winRate}%
                  </span>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    WON OF DECIDED
                  </p>
                </div>

                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                    <span>Won - {wonDealsCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-xs bg-rose-500" />
                    <span>Lost - {totalLostCount} (3mo)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card: Loss Reasons Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              <h3 className="font-semibold text-gray-800">
                Loss Reasons Breakdown
              </h3>
            </div>

            {lossReasonsList.length === 0 ? (
              <div className="space-y-2 pt-1 text-xs text-slate-500">
                <p>No lost deals in the last 3 months</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {lossReasonsList.map((item: any) => (
                  <span
                    key={item.reason}
                    className="bg-red-50 text-red-700 text-xs px-3 py-1.5 rounded-full border border-red-200 font-medium"
                  >
                    {item.reason}: {item.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Lost Deals Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              <h3 className="font-semibold text-gray-800">
                Lost Deals &amp; Reasons Log
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {recentLossesList.length} deal{recentLossesList.length !== 1 ? 's' : ''} lost (3 months)
            </span>
          </div>

          {recentLossesList.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No lost deals recorded in the last 3 months.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-6 py-3">Deal ID</th>
                    <th className="px-6 py-3">Customer Account</th>
                    <th className="px-6 py-3">Lost Reason</th>
                    <th className="px-6 py-3 text-right">Lost Value</th>
                    <th className="px-6 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentLossesList.map((item: any, idx: number) => {
                    const dateFormatted = item.created_at
                      ? new Date(item.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';
                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-slate-700 font-medium">
                          {item.deal_number || (item.id ? `DEAL-${item.id.substring(0, 6).toUpperCase()}` : '—')}
                        </td>
                        <td className="px-6 py-3.5 font-bold text-slate-900">
                          {item.customer_name}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-block bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-xs font-medium">
                            {item.lost_reason || 'Not specified'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-bold text-slate-900">
                          {Number(item.total_amount) > 0
                            ? `₹${Number(item.total_amount).toLocaleString('en-IN')}`
                            : '₹0'}
                        </td>
                        <td className="px-6 py-3.5 text-right text-slate-500 font-mono text-[11px]">
                          {dateFormatted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
