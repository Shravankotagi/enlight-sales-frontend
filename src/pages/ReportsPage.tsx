import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, ShoppingBag, Package, Loader2, RefreshCw } from 'lucide-react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';
import { detectHsnCode } from '../utils/hsnDetector';
import { calculateTotalTonnageMt } from '../utils/pricingEngine';

export default function ReportsPage() {
  const { effectivePhone } = useAuth();

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: '30_days',
    from: getDaysAgo(30),
    to: formatLocalDate(),
  });

  useEffect(() => {
    document.title = 'Reports - Enlight Sales OS';
  }, []);

  const getParams = () => {
    const params: any = {};
    if (effectivePhone) params.salesperson_phone = effectivePhone;
    if (dateRange.preset === 'monthly') {
      params.month = dateRange.month;
      params.year = dateRange.year;
    } else {
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
    }
    return params;
  };

  const { data: monthly, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery({
    queryKey: ['reports-monthly', dateRange, effectivePhone],
    queryFn: () =>
      reportsApi
        .getMonthly(getParams())
        .then((r) => r.data?.data || r.data),
  });

  const { data: funnel, isLoading: funnelLoading, refetch: refetchFunnel } = useQuery({
    queryKey: ['reports-funnel', dateRange, effectivePhone],
    queryFn: () =>
      reportsApi
        .getFunnel(getParams())
        .then((r) => r.data?.data || r.data),
  });

  const { data: sku, isLoading: skuLoading, refetch: refetchSku } = useQuery({
    queryKey: ['reports-sku', dateRange, effectivePhone],
    queryFn: () =>
      reportsApi
        .getSku(getParams())
        .then((r) => r.data?.data || r.data),
  });

  const refetchAll = () => {
    refetchMonthly();
    refetchFunnel();
    refetchSku();
  };

  const anyLoading = monthlyLoading || funnelLoading || skuLoading;

  const { totalMt, hasUnconvertible } = useMemo(() => {
    const skusList = (sku?.skus || []).map((item: any) => ({
      ...item,
      quantity: item.total_quantity || item.quantity,
    }));
    return calculateTotalTonnageMt(skusList);
  }, [sku]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
        <div className="flex items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={refetchAll}
            title="Refresh all reports"
            className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-500 hover:text-blue-600 cursor-pointer"
          >
            <RefreshCw size={16} className={anyLoading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {anyLoading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
          <p className="text-sm text-slate-500 font-medium">Loading reports...</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* SECTION 1 — Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Card 1: Total Deals */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{monthly?.summary?.total_deals ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">Total Deals</p>
            </div>

            {/* Card 2: Won */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{monthly?.summary?.deals_won ?? monthly?.summary?.won ?? 0}</p>
              <p className="text-sm text-gray-500 mt-1">Won</p>
            </div>

            {/* Card 3: Total Tonnage (MT) — auto-converted from all SKU units */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-emerald-600">
                {totalMt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MT
              </p>
              {hasUnconvertible && (
                <p className="text-[10px] text-slate-400">* some items excluded</p>
              )}
              <p className="text-sm text-gray-500 mt-1">Total Tonnage (MT)</p>
            </div>

            {/* Card 4: Unique Products Sold */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-indigo-600">{(sku?.skus || []).length}</p>
              <p className="text-sm text-gray-500 mt-1">Unique Products Sold</p>
            </div>
          </div>

          {/* SECTION 2 — Sales Funnel */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" /> Sales Funnel
            </h3>
            {funnel ? (
              <>
                <div className="space-y-3">
                  {(() => {
                    const maxCount =
                      funnel.max_count ||
                      Math.max(...(funnel.funnel || []).map((f: any) => f.count || 0), 1);
                    return (funnel?.funnel || []).map((stage: any) => {
                      const count = Number(stage.count) || 0;
                      const pct =
                        maxCount > 0 && count > 0
                          ? Math.max(10, Math.round((count / maxCount) * 100))
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
                    });
                  })()}
                </div>
                <p className="text-sm text-gray-500 mt-5 pt-3 border-t">
                  Overall win rate:{' '}
                  <span className="font-bold text-green-600 text-base">
                    {funnel?.overall_win_rate || 0}%
                  </span>
                </p>
              </>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No funnel data for this period</p>
            )}
          </div>

          {/* SECTION 3 — Top Customers + Lost Reasons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <ShoppingBag size={16} className="text-blue-600" /> Top Customers
              </h3>
              <div className="space-y-2">
                {(monthly?.by_customer || []).slice(0, 6).map((c: any) => (
                  <div key={c.customer || c.name || Math.random()} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{c.customer || c.name || 'Unknown'}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-800">
                        {'\u20B9'}{Number(c.value || c.amount || 0).toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">{c.deals || c.count || 0} deals</span>
                    </div>
                  </div>
                ))}
                {(!monthly?.by_customer || monthly.by_customer.length === 0) && (
                  <p className="text-gray-400 text-sm py-4 text-center">No customer data for this period</p>
                )}
              </div>
            </div>

            {/* Lost Reasons */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-3">Lost Reasons</h3>
              {monthly?.lost_reasons && Object.keys(monthly.lost_reasons).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(monthly.lost_reasons).map(([reason, rawVal]: [string, any]) => {
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

          {/* SECTION 4 — SKU Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Package size={16} className="text-indigo-600" /> SKU Breakdown
            </h3>

            {/* SKU Summary Cards */}
            {sku && (sku?.skus || []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Unique Products Sold</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {(sku?.skus || []).length}
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Total Tonnage (MT)</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">
                    {totalMt.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    MT
                  </p>
                  {hasUnconvertible && (
                    <p className="text-[11px] text-slate-400 mt-0.5">* some items excluded</p>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Total Deals Closed</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {(sku?.skus || []).reduce(
                      (sum: number, item: any) => sum + (Number(item.deal_count) || 0),
                      0,
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* SKU Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 text-left w-[36%]">SKU / Product Specification</th>
                      <th className="px-5 py-3.5 text-center w-[16%]">HSN/SAC</th>
                      <th className="px-5 py-3.5 text-center w-[16%]">Total Quantity</th>
                      <th className="px-5 py-3.5 text-center w-[18%]">Total Value ({'\u20B9'})</th>
                      <th className="px-5 py-3.5 text-center w-[14%]">Won Deals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(sku?.skus || []).map((item: any, i: number) => {
                      const hsn = detectHsnCode(item.sku_text || item.sku || '');
                      const qtyStr = `${Number(item.total_quantity || item.quantity || 0).toLocaleString('en-IN')} ${item.unit || 'MT'}`;
                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 text-left font-bold text-slate-900">
                            {item.sku_text || item.sku || '\u2014'}
                          </td>
                          <td className="px-5 py-3.5 text-center text-xs">
                            {hsn ? (
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200/60">
                                {hsn}
                              </span>
                            ) : (
                              <span className="text-slate-400">\u2014</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center font-semibold text-slate-800">
                            {qtyStr}
                          </td>
                          <td className="px-5 py-3.5 text-center font-bold text-emerald-700">
                            {item.total_value
                              ? `\u20B9${Number(item.total_value).toLocaleString('en-IN')}`
                              : '\u2014'}
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
              {(!sku || (sku?.skus || []).length === 0) && (
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
