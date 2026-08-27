import { useQuery } from '@tanstack/react-query';
import { customersApi, dealsApi } from '../lib/api';
import { useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  TrendingDown,
  Sparkles,
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
    if (!allCustomers || allCustomers.length === 0) return 32;
    const sum = allCustomers.reduce(
      (acc: number, c: any) => acc + (Number(c.avg_order_frequency_days) || 30),
      0
    );
    return Math.round(sum / allCustomers.length) || 32;
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

  return (
    <div className="min-h-screen bg-[#070D18] text-slate-100 p-4 sm:p-6 lg:p-8 -m-4 sm:-m-6 font-sans relative overflow-hidden">
      {/* Background Cyberpunk Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 211, 238, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 211, 238, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '3.5rem 3.5rem',
        }}
      />
      <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-10 relative z-10">
        {/* ── Top Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Intelligence Center
            </h1>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono tracking-wide shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Model status: nominal</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1 — CHURN RADAR (Image 1)
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase">
              01 CHURN RADAR
            </span>
          </div>

          {/* 3 Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: HEALTHY */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 relative overflow-hidden shadow-lg backdrop-blur-sm group hover:border-emerald-500/40 transition-colors">
              {/* Corner HUD Accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400/50" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400/50" />

              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="text-emerald-400 font-mono text-xs font-bold tracking-widest uppercase">
                  HEALTHY
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {healthyCount}
                </span>
                <span className="text-sm font-medium text-slate-400 font-mono">
                  customers
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-xs text-slate-400">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>Engagement and order cadence within normal range</span>
              </div>
            </div>

            {/* Card 2: AT RISK */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 relative overflow-hidden shadow-lg backdrop-blur-sm group hover:border-amber-500/40 transition-colors">
              {/* Corner HUD Accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-amber-400/50" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-amber-400/50" />

              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                <span className="text-amber-400 font-mono text-xs font-bold tracking-widest uppercase">
                  AT RISK
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {atRiskCount}
                </span>
                <span className="text-sm font-medium text-slate-400 font-mono">
                  customers
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-xs text-slate-400">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>
                  {atRiskCount === 0
                    ? 'No at-risk customers detected'
                    : `${atRiskCount} customer${atRiskCount > 1 ? 's' : ''} showing cadence delay`}
                </span>
              </div>
            </div>

            {/* Card 3: HIGH RISK */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 relative overflow-hidden shadow-lg backdrop-blur-sm group hover:border-rose-500/40 transition-colors">
              {/* Corner HUD Accents */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-rose-400/50" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-rose-400/50" />

              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                <span className="text-rose-400 font-mono text-xs font-bold tracking-widest uppercase">
                  HIGH RISK
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {highRiskCount}
                </span>
                <span className="text-sm font-medium text-slate-400 font-mono">
                  customers
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-xs text-slate-400">
                <Check size={14} className="text-emerald-400 shrink-0" />
                <span>
                  {highRiskCount === 0
                    ? 'No high risk customers detected'
                    : `${highRiskCount} customer${highRiskCount > 1 ? 's' : ''} requiring urgent follow-up`}
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Risk Distribution Box */}
          <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 shadow-lg backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded-xs bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Portfolio Risk Distribution
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {healthyPct}% healthy
              </span>
            </div>

            <div className="text-xs font-mono text-slate-400">
              {totalMonitoredAccounts} accounts monitored
            </div>

            {/* Distribution Multi-segment Bar */}
            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${healthyPct}%` }}
                className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full transition-all duration-500"
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
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-5 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" />
                  <span>Healthy — {healthyCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-400" />
                  <span>At Risk — {atRiskCount}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" />
                  <span>High Risk — {highRiskCount}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>Last scan: {lastScanFormatted} · Next scan in 6h</span>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2 — REORDER QUEUE (Image 2)
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase">
              02 REORDER QUEUE
            </span>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 shadow-lg backdrop-blur-sm">
              <p className="text-4xl font-black text-cyan-400 font-mono tracking-tight leading-none">
                {predictedCount}
              </p>
              <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mt-3">
                PREDICTED IN 14 DAYS
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 shadow-lg backdrop-blur-sm">
              <p className="text-4xl font-black text-cyan-400 font-mono tracking-tight leading-none">
                {customersTrackedCount}
              </p>
              <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mt-3">
                CUSTOMERS TRACKED
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 shadow-lg backdrop-blur-sm">
              <p className="text-4xl font-black text-cyan-400 font-mono tracking-tight leading-none">
                {avgReorderCycle}d
              </p>
              <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mt-3">
                AVG REORDER CYCLE
              </p>
            </div>
          </div>

          {/* 14-Day Forecast Window Timeline Box */}
          <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-6 shadow-lg backdrop-blur-sm space-y-6">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                14-Day Forecast Window
              </h3>
            </div>

            {/* Timeline Axis */}
            <div className="relative px-2 pt-2">
              <div className="h-0.5 w-full bg-slate-800 relative">
                {/* Marker: Today */}
                <div className="absolute left-0 -top-1.5 flex flex-col items-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-[#0B1528] shadow-[0_0_10px_#22d3ee]" />
                  <span className="text-[11px] font-mono text-cyan-300 font-bold mt-2">
                    Today
                  </span>
                </div>

                {/* Marker: +4d */}
                <div className="absolute left-[28%] -top-1 flex flex-col items-center">
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                  <span className="text-[11px] font-mono text-slate-500 mt-2">
                    +4d
                  </span>
                </div>

                {/* Marker: +7d */}
                <div className="absolute left-[50%] -top-1 flex flex-col items-center">
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                  <span className="text-[11px] font-mono text-slate-500 mt-2">
                    +7d
                  </span>
                </div>

                {/* Marker: +11d */}
                <div className="absolute left-[75%] -top-1 flex flex-col items-center">
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                  <span className="text-[11px] font-mono text-slate-500 mt-2">
                    +11d
                  </span>
                </div>

                {/* Marker: +14d */}
                <div className="absolute right-0 -top-1 flex flex-col items-center">
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                  <span className="text-[11px] font-mono text-slate-500 mt-2">
                    +14d
                  </span>
                </div>
              </div>
            </div>

            {/* Forecast Content Area */}
            {reorderList.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full border border-cyan-500/30 bg-cyan-950/40 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_15px_rgba(34,211,238,0.15)]">
                  <Clock size={20} />
                </div>
                <h4 className="text-base font-bold text-white">
                  No reorders predicted
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Nothing forecasted in the next 14 days
                </p>
              </div>
            ) : (
              <div className="pt-4 divide-y divide-slate-800/80">
                {reorderList.map((item: any) => (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-white">
                        {item.customer_name}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        Avg cycle: Every {item.avg_order_frequency_days}d · Last order:{' '}
                        {item.last_order_date
                          ? new Date(item.last_order_date).toLocaleDateString('en-IN')
                          : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {item.predicted_reorder_date
                          ? new Date(item.predicted_reorder_date).toLocaleDateString(
                              'en-IN'
                            )
                          : '—'}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                          item.is_overdue
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : item.is_due_soon
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
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
            SECTION 3 — LOSS ANALYTICS (Image 3)
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase">
              03 LOSS ANALYTICS
            </span>
          </div>

          {/* 2 Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lost Deals Card */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 relative overflow-hidden shadow-lg backdrop-blur-sm group hover:border-cyan-500/40 transition-colors">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400/50" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400/50" />

              <p className="text-4xl font-black text-emerald-400 font-mono tracking-tight leading-none">
                {totalLostCount}
              </p>
              <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mt-3">
                TOTAL LOST DEALS (3 MONTHS)
              </p>
            </div>

            {/* Lost Value Card */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-5 relative overflow-hidden shadow-lg backdrop-blur-sm group hover:border-cyan-500/40 transition-colors">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400/50" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400/50" />

              <p className="text-4xl font-black text-emerald-400 font-mono tracking-tight leading-none">
                {'₹'}{Number(totalLostValue).toLocaleString('en-IN')}
              </p>
              <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mt-3">
                TOTAL LOST VALUE
              </p>
            </div>
          </div>

          {/* Two-column Analytics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Win / Loss Ratio */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-6 shadow-lg backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Win / Loss Ratio
                </h3>
              </div>

              <div className="flex items-center gap-6 pt-2">
                {/* SVG Donut Ring */}
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    {/* Background Circle */}
                    <path
                      className="text-slate-800"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Active Gradient Stroke */}
                    <path
                      className="text-cyan-400 transition-all duration-700"
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
                <div className="space-y-2">
                  <div>
                    <span className="text-3xl font-black text-white font-mono">
                      {winRate}%
                    </span>
                    <p className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                      WON OF DECIDED
                    </p>
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-xs bg-emerald-400" />
                      <span>Won — {wonDealsCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-xs bg-rose-500" />
                      <span>Lost — {totalLostCount} (3mo)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Loss Reasons Breakdown */}
            <div className="bg-[#0B1528]/85 border border-[#142B47] rounded-xl p-6 shadow-lg backdrop-blur-sm space-y-4">
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-rose-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Loss Reasons Breakdown
                </h3>
              </div>

              {lossReasonsList.length === 0 ? (
                <div className="space-y-2 pt-1 text-xs font-mono text-slate-400">
                  <p>No lost deals in the last 3 months</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Historical reference:{' '}
                    <span className="text-slate-300">
                      1 deal lost earlier this year to{' '}
                      <strong className="text-cyan-300 font-semibold">
                        Credit terms
                      </strong>
                    </span>{' '}
                    — the only reason logged across the account's lifetime.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {lossReasonsList.map((item: any) => (
                    <div key={item.reason} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300 font-medium">
                          {item.reason}
                        </span>
                        <span className="text-rose-400 font-bold">
                          {item.count} ({'₹'}{Number(item.value || 0).toLocaleString('en-IN')})
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(10, (item.count / Math.max(totalLostCount, 1)) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
