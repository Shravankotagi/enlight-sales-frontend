import { useQuery } from '@tanstack/react-query';
import { reportsApi, inquiriesApi, dealsApi } from '../lib/api';
import { useEffect } from 'react';
import {
  TrendingUp, Users, ShoppingBag, ShieldAlert
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Admin Overview — Enlight Sales OS';
  }, []);

  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['admin-monthly'],
    queryFn: () => reportsApi.getMonthly().then(r => r.data.data),
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['admin-funnel'],
    queryFn: () => reportsApi.getFunnel().then(r => r.data.data),
  });

  const { data: salesperson, isLoading: salespersonLoading } = useQuery({
    queryKey: ['admin-salesperson'],
    queryFn: () => reportsApi.getSalesperson().then(r => r.data.data),
  });

  const { data: inquiries, isLoading: inquiriesLoading } = useQuery({
    queryKey: ['admin-inquiries-queue'],
    queryFn: () => inquiriesApi.getReviewQueue().then(r => r.data),
  });

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ['admin-recent-deals'],
    queryFn: () => dealsApi.getAll().then(r => r.data.data),
  });

  const isLoading = monthlyLoading || funnelLoading || salespersonLoading || inquiriesLoading || dealsLoading;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="animate-pulse grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="animate-pulse h-64 bg-gray-200 rounded-xl" />
      <div className="animate-pulse h-48 bg-gray-200 rounded-xl" />
    </div>
  );

  const spList = salesperson?.salespersons || salesperson || [];
  const reviewQueue = inquiries?.data || inquiries || [];
  const recentDeals = (deals || []).slice(0, 5);

  const wonDealsCount = monthly?.summary?.won || 0;
  const totalValue = monthly?.summary?.total_value || 0;
  const wonValue = monthly?.summary?.won_value || 0;
  const conversionRate = monthly?.summary?.conversion_rate || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert size={24} className="text-blue-600" />
          Admin Overview Dashboard
        </h1>
        <p className="text-gray-500 text-sm">Company-wide sales, pipeline health, and employee scores</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Value (Month)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₹{Number(totalValue).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">{monthly?.summary?.total_deals || 0} active deals</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Won Value</p>
          <p className="text-2xl font-bold text-green-600 mt-1">₹{Number(wonValue).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">{wonDealsCount} deals closed won</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Conversion Rate</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{conversionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">Target threshold: 70%</p>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inquiries for Review</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{reviewQueue.length}</p>
          <p className="text-xs text-gray-500 mt-1">Low AI extraction confidence</p>
        </div>
      </div>

      {/* Salesperson Performance Leaderboard */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Users size={18} className="text-blue-500" />
            Salesperson KRA Leaderboard
          </h2>
          <button onClick={() => navigate('/reports')} className="text-xs text-blue-600 hover:underline font-medium">
            View reports
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Salesperson', 'KRA Score', 'Total Deals', 'Won Value', 'Visits Completed', 'Complaints Status'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {spList.map((sp: any) => {
              const compTotal = sp.complaints?.total || 0;
              const compResolved = sp.complaints?.resolved || 0;
              return (
                <tr key={sp.salesperson_phone} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{sp.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{sp.salesperson_phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                      ${sp.kra_score >= 80 ? 'bg-green-100 text-green-700'
                        : sp.kra_score >= 60 ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'}`}>
                      {sp.kra_score}/100
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{sp.deals?.total || 0}</td>
                  <td className="px-4 py-3 text-green-600 font-semibold">₹{Number(sp.deals?.total_value || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-700">{sp.visits?.total || 0}/40</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {compTotal > 0 ? `${compResolved}/${compTotal} resolved` : 'No complaints'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Deals */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <ShoppingBag size={18} className="text-indigo-500" />
              Recent Company Deals
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {recentDeals.map((deal: any) => (
              <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{deal.customer_name || 'Unknown Customer'}</p>
                  <p className="text-xs text-gray-500">Salesperson: {deal.salesperson_phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">₹{Number(deal.total_amount || 0).toLocaleString('en-IN')}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize
                    ${deal.stage === 'won' ? 'bg-green-100 text-green-700'
                      : deal.stage === 'lost' ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'}`}>
                    {deal.stage?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Funnel chart */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-500" />
              Funnel Conversion Breakdown
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {(funnel?.funnel || []).map((stage: any) => (
              <div key={stage.stage} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-gray-600">
                  <span className="capitalize">{stage.stage.replace('_', ' ')}</span>
                  <span>{stage.count} deals</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${funnel.funnel[0]?.count > 0 ? (stage.count / funnel.funnel[0].count) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
