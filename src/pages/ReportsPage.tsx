import { useQuery } from '@tanstack/react-query';
import { reportsApi, ordersApi, inquiriesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, ShoppingBag, Package, RefreshCw, BarChart3 } from 'lucide-react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { formatLocalDate } from '../utils/dateUtils';
import { detectHsnCode } from '../utils/hsnDetector';
import { calculateOrdersTotalTonnage } from '../utils/pricingEngine';

export default function ReportsPage() {
  const { effectivePhone } = useAuth();

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'all',
    from: '2000-01-01',
    to: formatLocalDate(),
  });

  useEffect(() => {
    document.title = 'Reports - Enlight Sales OS';
  }, []);

  const getParams = () => {
    const params: any = {};
    if (effectivePhone) params.salesperson_phone = effectivePhone;
    if (dateRange.preset === 'all') {
      params.all_time = 'true';
      params.from = dateRange.from || '2000-01-01';
      params.to = dateRange.to || formatLocalDate();
    } else if (dateRange.preset === 'monthly') {
      params.month = dateRange.month;
      params.year = dateRange.year;
    } else {
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
    }
    return params;
  };

  // Resilient single/parallel query with automatic zero-failure fallback
  const {
    data: overview,
    isLoading,
    isFetching,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['reports-overview-data', dateRange, effectivePhone],
    queryFn: async () => {
      const params = getParams();

      // 1. Try unified high-speed overview endpoint first
      try {
        const res = await reportsApi.getOverview(params);
        const d = res?.data?.data || res?.data;
        if (d && (d.summary || d.orders || d.skus)) {
          return d;
        }
      } catch (err) {
        console.warn('getOverview not available, falling back to parallel endpoints:', err);
      }

      // 2. Resilient fallback: fetch from individual endpoints in parallel
      const [monthlyRes, funnelRes, skuRes, ordersRes, inquiriesRes] = await Promise.all([
        reportsApi.getMonthly(params).catch(() => null),
        reportsApi.getFunnel(params).catch(() => null),
        reportsApi.getSku(params).catch(() => null),
        ordersApi.getAll(params).catch(() => null),
        inquiriesApi.getAll(params).catch(() => null),
      ]);

      const monthly = monthlyRes?.data?.data || monthlyRes?.data || {};
      const funnelData = funnelRes?.data?.data || funnelRes?.data || {};
      const skuData = skuRes?.data?.data || skuRes?.data || {};
      const rawOrders = ordersRes?.data;
      const orders = Array.isArray(rawOrders) ? rawOrders : (Array.isArray(rawOrders?.data) ? rawOrders.data : []);
      const rawInquiries = inquiriesRes?.data;
      const inquiries = Array.isArray(rawInquiries) ? rawInquiries : (Array.isArray(rawInquiries?.data) ? rawInquiries.data : []);

      return {
        summary: monthly.summary || {},
        funnel: Array.isArray(funnelData) ? funnelData : (funnelData.funnel || []),
        by_customer: monthly.by_customer || [],
        by_type: monthly.by_type || [],
        lost_reasons: monthly.lost_reasons || {},
        skus: skuData.skus || [],
        orders: orders,
        inquiries_count: inquiries.length || monthly.summary?.total_inquiries || monthly.summary?.total_deals || 0,
      };
    },
    staleTime: 30000,
  });

  const refetchAll = () => {
    refetchOverview();
  };

  // Single source of truth: calculate total tonnage across actual won orders in scope
  const totalTonnageResult = useMemo(() => {
    return calculateOrdersTotalTonnage(overview?.orders || []);
  }, [overview?.orders]);

  const totalMt = totalTonnageResult.totalMt;

  // Exact parity for KPI cards:
  const totalDealsCount =
    overview?.inquiries_count ||
    overview?.summary?.total_deals ||
    overview?.summary?.total_inquiries ||
    0;

  const wonOrdersCount =
    overview?.summary?.deals_won ||
    overview?.summary?.won ||
    (overview?.orders || []).length ||
    0;

  const funnelList: any[] = Array.isArray(overview?.funnel)
    ? overview.funnel
    : (overview?.funnel?.funnel || []);

  const maxFunnelCount = Math.max(
    ...funnelList.map((f: any) => Number(f.count) || 0),
    1
  );

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={28} />
            Reports &amp; Analytics
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={refetchAll}
            title="Refresh all reports"
            className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-blue-600 cursor-pointer"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {isLoading ? (
        /* ── Progressive Skeleton Shimmer UI ── */
        <div className="space-y-8 animate-pulse">
          {/* Skeleton Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm space-y-2">
                <div className="h-7 w-20 bg-slate-200 rounded-lg mx-auto" />
                <div className="h-4 w-28 bg-slate-100 rounded mx-auto" />
              </div>
            ))}
          </div>

          {/* Skeleton Funnel Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="h-5 w-32 bg-slate-200 rounded" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-28 h-4 bg-slate-100 rounded" />
                  <div className="flex-1 h-7 bg-slate-100 rounded-full" />
                  <div className="w-16 h-4 bg-slate-100 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton Top Customers + Lost Reasons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="h-5 w-36 bg-slate-200 rounded" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-5 bg-slate-100 rounded" />
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="h-5 w-32 bg-slate-200 rounded" />
              <div className="flex gap-2">
                <div className="h-7 w-28 bg-slate-100 rounded-full" />
                <div className="h-7 w-32 bg-slate-100 rounded-full" />
              </div>
            </div>
          </div>

          {/* Skeleton SKU Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm p-4 space-y-3">
            <div className="h-5 w-36 bg-slate-200 rounded" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1 - Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Card 1: Total Deals */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{totalDealsCount}</p>
              <p className="text-sm text-gray-500 mt-1">Total Deals</p>
            </div>

            {/* Card 2: Won */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{wonOrdersCount}</p>
              <p className="text-sm text-gray-500 mt-1">Won</p>
            </div>

            {/* Card 3: Total Tonnage (MT) - auto-converted from all SKU units */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-emerald-600">
                {totalMt.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} MT
              </p>
              
              <p className="text-sm text-gray-500 mt-1">Total Tonnage (MT)</p>
            </div>

            {/* Card 4: Unique Products Sold */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-indigo-600">{(overview?.skus || []).length}</p>
              <p className="text-sm text-gray-500 mt-1">Unique Products Sold</p>
            </div>
          </div>

          {/* SECTION 2 - Sales Funnel */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" /> Sales Funnel
            </h3>
            {funnelList.length > 0 ? (
              <>
                <div className="space-y-3">
                  {funnelList.map((stage: any) => {
                    const count = Number(stage.count) || 0;
                    const pct =
                      maxFunnelCount > 0 && count > 0
                        ? Math.max(10, Math.round((count / maxFunnelCount) * 100))
                        : 0;
                    return (
                      <div key={stage.stage} className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700 w-28">
                          {stage.label ||
                            (stage.stage === 'new_inquiry' || stage.stage === 'new_deals'
                              ? 'New Deals'
                              : String(stage.stage).replace('_', ' '))}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                          {count > 0 ? (
                            <div
                              className="bg-gradient-to-r from-blue-500 to-blue-700 h-full rounded-full flex items-center pl-3 transition-all"
                              style={{ width: `${pct}%` }}
                            >
                              <span className="text-xs text-white font-bold">{count}</span>
                            </div>
                          ) : (
                            <div className="h-full flex items-center pl-3 text-xs text-gray-400 font-medium">
                              0
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-gray-500 w-16 text-right">
                          {count > 0 ? `${count} deal${count > 1 ? 's' : ''}` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-gray-500 mt-5 pt-3 border-t">
                  Overall win rate:{' '}
                  <span className="font-bold text-green-600 text-base">
                    {overview?.summary?.conversion_rate || 0}%
                  </span>
                </p>
              </>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No funnel data for this period</p>
            )}
          </div>

          {/* SECTION 3 - Top Customers + Lost Reasons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingBag size={16} className="text-blue-600" /> Top Customers
              </h3>
              <div className="space-y-2">
                {(overview?.by_customer || []).slice(0, 6).map((c: any) => (
                  <div key={c.customer || c.name || Math.random()} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{c.customer || c.name || 'Unknown'}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-800">
                        {'₹'}{Number(c.value || c.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">{c.deals || c.count || 0} deals</span>
                    </div>
                  </div>
                ))}
                {(!overview?.by_customer || overview.by_customer.length === 0) && (
                  <p className="text-gray-400 text-sm py-4 text-center">No customer data for this period</p>
                )}
              </div>
            </div>

            {/* Lost Reasons */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Lost Reasons</h3>
              {overview?.lost_reasons && Object.keys(overview.lost_reasons).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(overview.lost_reasons).map(([reason, rawVal]: [string, any]) => {
                    const count =
                      typeof rawVal === 'object' && rawVal !== null
                        ? rawVal.count ?? 1
                        : Number(rawVal) || 1;
                    return (
                      <span
                        key={reason}
                        className="bg-red-50 text-red-700 text-sm px-3 py-1 rounded-full border border-red-200"
                      >
                        {reason}: {count}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No lost deals yet</p>
              )}
            </div>
          </div>

          {/* SECTION 4 - SKU Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Package size={16} className="text-indigo-600" /> SKU Breakdown
            </h3>

            {/* SKU Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 text-left w-[36%]">SKU / Product Specification</th>
                      <th className="px-5 py-3.5 text-center w-[16%]">HSN/SAC</th>
                      <th className="px-5 py-3.5 text-center w-[16%]">Total Quantity</th>
                      <th className="px-5 py-3.5 text-center w-[18%]">Total Value ({'₹'})</th>
                      <th className="px-5 py-3.5 text-center w-[14%]">Won Deals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(overview?.skus || []).map((item: any, i: number) => {
                      const hsn = detectHsnCode(item.sku_text || item.sku || '');
                      const qtyStr = `${Number(item.total_quantity || item.quantity || 0).toLocaleString('en-IN')} ${item.unit || 'MT'}`;
                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 text-left font-bold text-slate-900">
                            {item.sku_text || item.sku || '-'}
                          </td>
                          <td className="px-5 py-3.5 text-center text-xs">
                            {hsn ? (
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200/60">
                                {hsn}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center font-semibold text-slate-800">
                            {qtyStr}
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-emerald-700">
                            {item.total_value
                              ? `₹${Number(item.total_value).toLocaleString('en-IN')}`
                              : '-'}
                          </td>
                          <td className="px-5 py-3.5 text-center text-xs font-bold text-slate-700">
                            {item.deal_count || item.count || 1}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(!overview?.skus || overview.skus.length === 0) && (
                <div className="text-center py-12 text-slate-400">
                  <Package size={28} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-700">No SKU sales data in this period</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Product breakdowns for won orders will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
