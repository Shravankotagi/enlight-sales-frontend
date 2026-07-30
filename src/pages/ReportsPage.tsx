import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/api';
import { useEffect, useState } from 'react';
import { TrendingUp, ShoppingBag, Users, Package } from 'lucide-react';


type Tab = 'monthly' | 'funnel' | 'salesperson' | 'sku';

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('monthly');

  useEffect(() => {
    document.title = 'Reports — Enlight Sales OS';
  }, []);

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['reports-monthly'],
    queryFn: () => reportsApi.getMonthly().then(r => r.data.data),
    enabled: tab === 'monthly',
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['reports-funnel'],
    queryFn: () => reportsApi.getFunnel().then(r => r.data.data),
    enabled: tab === 'funnel',
  });

  const { data: salesperson, isLoading: salespersonLoading } = useQuery({
    queryKey: ['reports-salesperson'],
    queryFn: () => reportsApi.getSalesperson().then(r => r.data.data),
    enabled: tab === 'salesperson',
  });

  const { data: sku, isLoading: skuLoading } = useQuery({
    queryKey: ['reports-sku'],
    queryFn: () => reportsApi.getSku().then(r => r.data.data),
    enabled: tab === 'sku',
  });

  const tabs = [
    { key: 'monthly' as Tab, label: 'Monthly', icon: TrendingUp },
    { key: 'funnel' as Tab, label: 'Funnel', icon: ShoppingBag },
    { key: 'salesperson' as Tab, label: 'Salesperson', icon: Users },
    { key: 'sku' as Tab, label: 'SKU Breakdown', icon: Package },
  ];

  const isLoading = tab === 'monthly' ? monthlyLoading
    : tab === 'funnel' ? funnelLoading
    : tab === 'salesperson' ? salespersonLoading
    : skuLoading;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm">
          {monthly?.period?.month} {monthly?.period?.year} — Sales performance overview
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
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
          {/* TAB 1 — MONTHLY */}
          {tab === 'monthly' && monthly && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Deals', value: monthly?.summary?.total_deals },
                  { label: 'Won', value: monthly?.summary?.won },
                  { label: 'Total Value', value: '₹' + Number(monthly?.summary?.total_value || 0).toLocaleString('en-IN') },
                  { label: 'Conversion', value: `${monthly?.summary?.conversion_rate || 0}%` },
                ].map(stat => (
                  <div key={stat.label} className="bg-white rounded-xl border p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-blue-600" /> Top Customers
                  </h3>
                  <div className="space-y-2">
                    {(monthly?.by_customer || []).slice(0, 6).map((c: any) => (
                      <div key={c.customer} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{c.customer}</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-800">₹{Number(c.value).toLocaleString('en-IN')}</span>
                          <span className="text-xs text-gray-400 ml-2">{c.deals} deals</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Lost Reasons</h3>
                  {Object.keys(monthly?.lost_reasons || {}).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(monthly.lost_reasons).map(([reason, count]) => (
                        <span key={reason} className="bg-red-50 text-red-700 text-sm px-3 py-1 rounded-full border border-red-200">
                          {reason}: {count as number}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No lost deals yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 — FUNNEL */}
          {tab === 'funnel' && funnel && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-600" /> Sales Funnel
              </h3>
              <div className="space-y-3">
                {(funnel?.funnel || []).map((stage: any) => (
                  <div key={stage.stage} className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 w-28 capitalize">{stage.stage.replace('_', ' ')}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full flex items-center pl-3 transition-all"
                        style={{ width: `${funnel.funnel[0]?.count > 0 ? Math.max(6, (stage.count / funnel.funnel[0].count) * 100) : 0}%` }}>
                        <span className="text-xs text-white font-bold">{stage.count}</span>
                      </div>
                    </div>
                    {stage.conversion_rate != null && (
                      <span className="text-xs text-gray-400 w-16 text-right">{stage.conversion_rate}%</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Overall win rate: <span className="font-bold text-gray-800">{funnel?.overall_win_rate || 0}%</span>
              </p>
            </div>
          )}

          {/* TAB 3 — SALESPERSON */}
          {tab === 'salesperson' && salesperson && (
            <div className="border rounded-xl overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Salesperson', 'KRA Score', 'Deals', 'Won', 'Visits', 'New Customers', 'Payments', 'Complaints'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((salesperson?.salespersons || [])).map((sp: any) => {
                    const compTotal = sp.complaints?.total || 0;
                    const compResolved = sp.complaints?.resolved || 0;
                    const compRate = compTotal > 0 ? Math.round((compResolved / compTotal) * 100) : 100;
                    return (
                      <tr key={sp.salesperson_phone} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{sp.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{sp.salesperson_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold px-2 py-0.5 rounded-full
                            ${(sp.kra_score || 0) >= 80 ? 'bg-green-100 text-green-700'
                              : (sp.kra_score || 0) >= 60 ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'}`}>
                            {sp.kra_score || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{sp.deals?.total || 0}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">{sp.deals?.won || 0}</td>
                        <td className="px-4 py-3 text-gray-700">{sp.visits?.total || 0}</td>
                        <td className="px-4 py-3 text-gray-700">{sp.new_customers?.count || 0}</td>
                        <td className="px-4 py-3 text-gray-700">{sp.payments?.collected || 0}</td>
                        <td className="px-4 py-3 text-gray-700">{compTotal > 0 ? `${compRate}% (${compResolved}/${compTotal})` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!salesperson || (salesperson?.salespersons || []).length === 0) && (
                <div className="text-center py-12 text-gray-400">No salesperson data</div>
              )}
            </div>
          )}

          {/* TAB 4 — SKU BREAKDOWN */}
          {tab === 'sku' && sku && (
            <div className="border rounded-xl overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['SKU', 'Grade', 'Total Qty', 'Unit', 'Total Value', 'Deals'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {((sku?.skus || [])).map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{item.sku_text}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.grade || '—'}</td>
                      <td className="px-4 py-3 text-gray-800 font-semibold">{item.total_quantity || item.quantity || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{item.unit || 'MT'}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">
                        {item.total_value ? `₹${Number(item.total_value).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{item.deal_count || item.count || '—'}</td>
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
