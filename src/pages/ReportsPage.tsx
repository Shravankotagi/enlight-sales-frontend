import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../lib/api';
import { Loader2, TrendingUp, ShoppingBag } from 'lucide-react';

export default function ReportsPage() {
  const { data: monthly, isLoading } = useQuery({
    queryKey: ['reports-monthly'],
    queryFn: () => reportsApi.getMonthly().then(r => r.data.data),
  });

  const { data: funnel } = useQuery({
    queryKey: ['reports-funnel'],
    queryFn: () => reportsApi.getFunnel().then(r => r.data.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm">
          {monthly?.period?.month} {monthly?.period?.year}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Deals', value: monthly?.summary?.total_deals },
          { label: 'Won', value: monthly?.summary?.won },
          { label: 'Total Value', 
            value: '₹' + Number(monthly?.summary?.total_value || 0)
              .toLocaleString('en-IN') },
          { label: 'Conversion', 
            value: `${monthly?.summary?.conversion_rate || 0}%` },
        ].map(stat => (
          <div key={stat.label} 
            className="bg-white rounded-xl border p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* By Customer */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ShoppingBag size={16} className="text-blue-600" />
            Top Customers
          </h3>
          <div className="space-y-2">
            {(monthly?.by_customer || []).slice(0, 5).map((c: any) => (
              <div key={c.customer} 
                className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{c.customer}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-800">
                    ₹{Number(c.value).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    {c.deals} deals
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Funnel */}
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-600" />
            Sales Funnel
          </h3>
          <div className="space-y-2">
            {(funnel?.funnel || []).map((stage: any) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 capitalize">
                  {stage.stage.replace('_', ' ')}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 
                  overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full 
                    flex items-center pl-2 transition-all"
                    style={{ 
                      width: `${funnel.funnel[0]?.count > 0 
                        ? Math.max(4, 
                            (stage.count / funnel.funnel[0].count) * 100)
                        : 0}%` 
                    }}>
                    <span className="text-xs text-white font-medium">
                      {stage.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Overall win rate: {funnel?.overall_win_rate || 0}%
          </p>
        </div>

        {/* Lost Reasons */}
        <div className="bg-white rounded-xl border p-4 col-span-2">
          <h3 className="font-semibold text-gray-800 mb-3">Lost Reasons</h3>
          {Object.keys(monthly?.lost_reasons || {}).length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Object.entries(monthly.lost_reasons).map(([reason, count]) => (
                <span key={reason}
                  className="bg-red-50 text-red-700 text-sm px-3 
                    py-1 rounded-full border border-red-200">
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
  );
}
