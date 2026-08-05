import { useQuery } from '@tanstack/react-query';
import { customersApi, kraApi } from '../lib/api';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, Clock, TrendingDown,
  Activity, Brain
} from 'lucide-react';


type Tab = 'churn' | 'reorder' | 'loss' | 'logs';

const KRA_COLORS: Record<number, string> = {
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-purple-100 text-purple-700',
  4: 'bg-yellow-100 text-yellow-700',
  5: 'bg-orange-100 text-orange-700',
  6: 'bg-pink-100 text-pink-700',
  7: 'bg-red-100 text-red-700',
  8: 'bg-indigo-100 text-indigo-700',
  9: 'bg-teal-100 text-teal-700',
};

export default function IntelligencePage() {
  const [tab, setTab] = useState<Tab>('churn');
  const auth = useAuth();
  const salespersonPhone = auth?.effectivePhone || undefined;

  useEffect(() => {
    document.title = 'Intelligence - Enlight Sales OS';
  }, []);

  const { data: churnData, isLoading: churnLoading } = useQuery({
    queryKey: ['churn-risk', salespersonPhone],
    queryFn: () => customersApi.getChurnRisk({ salesperson_phone: salespersonPhone }).then(r => r.data.data),
    enabled: tab === 'churn',
  });

  const { data: reorderData, isLoading: reorderLoading } = useQuery({
    queryKey: ['reorder-queue', salespersonPhone],
    queryFn: () => customersApi.getReorderQueue({ salesperson_phone: salespersonPhone }).then(r => r.data.data),
    enabled: tab === 'reorder',
  });

  const { data: lossData, isLoading: lossLoading } = useQuery({
    queryKey: ['loss-analytics', salespersonPhone],
    queryFn: () => customersApi.getLossAnalytics({ salesperson_phone: salespersonPhone }).then(r => r.data.data),
    enabled: tab === 'loss',
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['kra-logs', salespersonPhone],
    queryFn: () => kraApi.getLogs({ salesperson_phone: salespersonPhone }).then(r => r.data.data),
    enabled: tab === 'logs',
  });

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'churn', label: 'Churn Radar', icon: AlertTriangle },
    { key: 'reorder', label: 'Reorder Queue', icon: Clock },
    { key: 'loss', label: 'Loss Analytics', icon: TrendingDown },
    { key: 'logs', label: 'KRA Logs', icon: Activity },
  ];

  const highRisk = (churnData || []).filter((c: any) => c.churn_risk === 'high');
  const medRisk = (churnData || []).filter((c: any) => c.churn_risk === 'medium');
  const maxLossCount = Math.max(...(lossData?.by_reason || []).map((r: any) => r.count), 1);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Brain size={24} className="text-indigo-500" />
          Intelligence Center
        </h1>
        <p className="text-gray-500 text-sm">AI-powered insights from your sales data</p>
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

      {/* TAB 1 - CHURN RADAR */}
      {tab === 'churn' && (
        churnLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white border rounded-xl p-4">
                <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* High Risk */}
            <div>
              <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" /> High Risk - {highRisk.length} customers
              </h3>
              {highRisk.length === 0 ? (
                <p className="text-gray-400 text-sm">No high risk customers 🎉</p>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 border-b">
                      <tr>
                        {['Customer', 'Phone', 'Days Since Order', 'Last Order', 'Action'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {highRisk.map((c: any) => (
                        <tr key={c.id} className="hover:bg-red-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{c.customer_phone}</td>
                          <td className="px-4 py-3">
                            <span className="text-red-600 font-bold">{c.days_since_order}d</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium">
                              Create Follow-up
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* At Risk */}
            <div>
              <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> At Risk - {medRisk.length} customers
              </h3>
              {medRisk.length === 0 ? (
                <p className="text-gray-400 text-sm">No at-risk customers</p>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-yellow-50 border-b">
                      <tr>
                        {['Customer', 'Phone', 'Days Since Order', 'Last Order', 'Action'].map(h => (
                          <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {medRisk.map((c: any) => (
                        <tr key={c.id} className="hover:bg-yellow-50/50">
                          <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{c.customer_phone}</td>
                          <td className="px-4 py-3">
                            <span className="text-yellow-600 font-bold">{c.days_since_order}d</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors font-medium">
                              Create Follow-up
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* TAB 2 - REORDER QUEUE */}
      {tab === 'reorder' && (
        reorderLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border rounded-xl p-4">
                <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">{(reorderData || []).length} customers predicted to reorder within 14 days</p>
            </div>
            {!reorderData || reorderData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Clock size={40} className="mx-auto mb-3 opacity-40" />
                <p>No reorders predicted in the next 14 days</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Customer', 'Last Order', 'Avg Frequency', 'Predicted Date', 'Days Until', 'Status'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(reorderData || []).map((c: any) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">Every {c.avg_order_frequency_days}d</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {c.predicted_reorder_date ? new Date(c.predicted_reorder_date).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="px-4 py-3 font-bold text-sm">
                          {c.is_overdue ? (
                            <span className="text-red-600">{Math.abs(c.days_until_reorder)}d overdue</span>
                          ) : (
                            <span className="text-gray-800">In {c.days_until_reorder}d</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.is_overdue ? (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">OVERDUE</span>
                          ) : c.is_due_soon ? (
                            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-semibold">DUE SOON</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">UPCOMING</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 3 - LOSS ANALYTICS */}
      {tab === 'loss' && (
        lossLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4"><div className="h-8 bg-gray-200 rounded w-24" /></div>
              <div className="bg-white border rounded-xl p-4"><div className="h-8 bg-gray-200 rounded w-24" /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-red-100 rounded-xl p-4">
                <p className="text-3xl font-bold text-red-600">{lossData?.total_lost || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Total Lost Deals (3 months)</p>
              </div>
              <div className="bg-white border border-red-100 rounded-xl p-4">
                <p className="text-3xl font-bold text-red-600">
                  ₹{Number(lossData?.total_lost_value || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-gray-500 mt-1">Total Lost Value</p>
              </div>
            </div>

            {/* Loss reasons bar chart */}
            <div className="bg-white border rounded-xl p-5">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingDown size={16} className="text-red-500" /> Loss Reasons Breakdown
              </h3>
              {(!lossData?.by_reason || lossData.by_reason.length === 0) ? (
                <p className="text-gray-400 text-sm">No lost deals in the last 3 months</p>
              ) : (
                <div className="space-y-3">
                  {lossData.by_reason.map((item: any) => (
                    <div key={item.reason}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 font-medium">{item.reason}</span>
                        <span className="text-sm font-bold text-gray-900">{item.count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-red-400 to-red-600 h-full rounded-full flex items-center pl-2 transition-all"
                          style={{ width: `${Math.max(4, (item.count / maxLossCount) * 100)}%` }}
                        >
                          <span className="text-xs text-white font-medium">
                            ₹{Number(item.value).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent losses */}
            {lossData?.recent_losses?.length > 0 && (
              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b bg-gray-50">
                  <h3 className="font-semibold text-gray-800">Recent Losses</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      {['Customer', 'Lost Reason', 'Value', 'Date'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lossData.recent_losses.map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{d.customer_name}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{d.lost_reason || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{d.total_amount ? `₹${Number(d.total_amount).toLocaleString('en-IN')}` : '-'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(d.created_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 4 - KRA LOGS */}
      {tab === 'logs' && (
        logsLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white border rounded-xl p-4">
                <div className="h-4 bg-gray-200 rounded w-64 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-40" />
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden bg-white">
            {!logsData || logsData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Activity size={40} className="mx-auto mb-3 opacity-40" />
                <p>No KRA activity logs yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['KRA', 'Type', 'Customer', 'Description', 'Date'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logsData.map((log: any) => {
                    const kraNum = log.kra_number || 1;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${KRA_COLORS[kraNum] || 'bg-gray-100 text-gray-700'}`}>
                            KRA{kraNum}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize text-xs">
                          {log.kra_type?.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-gray-800 font-medium text-xs">{log.customer_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate">{log.description}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(log.logged_at || log.created_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      )}
    </div>
  );
}
