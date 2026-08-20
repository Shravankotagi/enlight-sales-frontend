import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingBag, Package } from 'lucide-react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';

type Tab = 'monthly' | 'funnel' | 'sku';

export default function ReportsPage() {
  const { effectivePhone } = useAuth();
  const [tab, setTab] = useState<Tab>('monthly');

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
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

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['reports-monthly', dateRange, effectivePhone],
    queryFn: () =>
      reportsApi
        .getMonthly(getParams())
        .then((r) => r.data?.data || r.data),
    enabled: tab === 'monthly',
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['reports-funnel', dateRange, effectivePhone],
    queryFn: () =>
      reportsApi
        .getFunnel(getParams())
        .then((r) => r.data?.data || r.data),
    enabled: tab === 'funnel',
  });

  const { data: sku, isLoading: skuLoading } = useQuery({
    queryKey: ['reports-sku', dateRange, effectivePhone],
    queryFn: () =>
      reportsApi
        .getSku(getParams())
        .then((r) => r.data?.data || r.data),
    enabled: tab === 'sku',
  });

  const tabs = [
    { key: 'monthly' as Tab, label: 'Monthly', icon: TrendingUp },
    { key: 'funnel' as Tab, label: 'Funnel', icon: ShoppingBag },
    { key: 'sku' as Tab, label: 'SKU Breakdown', icon: Package },
  ];

  const isLoading =
    tab === 'monthly'
      ? monthlyLoading
      : tab === 'funnel'
        ? funnelLoading
        : skuLoading;

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-gray-500 text-sm">
            Comprehensive sales performance, funnel conversion, and product breakdown overview.
          </p>
        </div>

        <DateFilterControl onChange={setDateRange} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="animate-pulse grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white border rounded-xl p-4">
              <div className="h-8 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* TAB 1 - MONTHLY */}
          {tab === 'monthly' && monthly && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Deals', value: monthly?.summary?.total_deals ?? 0 },
                  { label: 'Won', value: monthly?.summary?.deals_won ?? monthly?.summary?.won ?? 0 },
                  {
                    label: 'Total Value',
                    value:
                      '₹' +
                      Number(
                        monthly?.summary?.won_revenue ??
                          monthly?.summary?.total_value ??
                          monthly?.summary?.total_revenue ??
                          0,
                      ).toLocaleString('en-IN'),
                  },
                  { label: 'Conversion', value: `${monthly?.summary?.conversion_rate ?? 0}%` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl border p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-blue-600" /> Top Customers
                  </h3>
                  <div className="space-y-2">
                    {(monthly?.by_customer || []).slice(0, 6).map((c: any) => (
                      <div key={c.customer || c.name || Math.random()} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{c.customer || c.name || 'Unknown'}</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-800">
                            ₹{Number(c.value || c.amount || 0).toLocaleString('en-IN')}
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

                <div className="bg-white rounded-xl border p-4">
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
            </div>
          )}

          {/* TAB 2 - FUNNEL */}
          {tab === 'funnel' && funnel && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-600" /> Sales Funnel
              </h3>
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
            </div>
          )}

          {/* TAB 3 - SKU BREAKDOWN */}
          {tab === 'sku' && sku && (
            <div className="border rounded-xl overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['SKU', 'Grade', 'Total Qty', 'Unit', 'Total Value', 'Deals'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(sku?.skus || []).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.sku_text || item.sku || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.grade || '-'}</td>
                      <td className="px-4 py-3 text-gray-800 font-semibold">
                        {item.total_quantity || item.quantity || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.unit || 'MT'}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {item.total_value ? `₹${Number(item.total_value).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.deal_count || item.count || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!sku || (sku?.skus || []).length === 0) && (
                <div className="text-center py-12 text-gray-400">No SKU data this month</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
