import { useQuery } from '@tanstack/react-query';
import { reportsApi, inquiriesApi, dealsApi, employeesApi } from '../lib/api';
import { useEffect, useState } from 'react';
import {
  TrendingUp, ShoppingBag, ShieldAlert,
  ChevronRight, Calendar, UserCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const years = [2025, 2026, 2027];

  const fromDate = new Date(Date.UTC(selectedYear, selectedMonth, 1, 0, 0, 0)).toISOString();
  const toDate = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)).toISOString();

  useEffect(() => {
    document.title = 'Admin Overview — Enlight Sales OS';
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
    month: selectedMonth,
    year: selectedYear,
  };

  // Queries with dynamic parameters
  const { data: monthly, isLoading: monthlyLoading } = useQuery({
    queryKey: ['admin-monthly', selectedPhone, selectedMonth, selectedYear],
    queryFn: () => reportsApi.getMonthly(queryParams).then(r => r.data.data),
  });

  const { data: funnel, isLoading: funnelLoading } = useQuery({
    queryKey: ['admin-funnel', selectedPhone, selectedMonth, selectedYear],
    queryFn: () => reportsApi.getFunnel(queryParams).then(r => r.data.data),
  });

  const { data: sku, isLoading: skuLoading } = useQuery({
    queryKey: ['admin-sku', selectedPhone, selectedMonth, selectedYear],
    queryFn: () => reportsApi.getSku(queryParams).then(r => r.data.data),
  });

  const { data: salesperson, isLoading: salespersonLoading } = useQuery({
    queryKey: ['admin-salesperson', selectedMonth, selectedYear],
    queryFn: () => reportsApi.getSalesperson({ month: selectedMonth, year: selectedYear }).then(r => r.data.data),
  });

  const { data: inquiries, isLoading: inquiriesLoading } = useQuery({
    queryKey: ['admin-inquiries-queue'],
    queryFn: () => inquiriesApi.getReviewQueue().then(r => r.data),
  });

  const { data: deals, isLoading: dealsLoading } = useQuery({
    queryKey: ['admin-recent-deals', selectedPhone, selectedMonth, selectedYear],
    queryFn: () => dealsApi.getAll({ ...queryParams, from: fromDate, to: toDate }).then(r => r.data.data),
  });

  const isLoading = monthlyLoading || funnelLoading || skuLoading || salespersonLoading || inquiriesLoading || dealsLoading;

  if (isLoading) return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-10 bg-gray-200 rounded w-64" />
      </div>
      <div className="grid grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl" />
        ))}
      </div>
      <div className="animate-pulse h-64 bg-gray-200 rounded-xl" />
    </div>
  );

  const spList = salesperson?.salespersons || salesperson || [];
  const reviewQueue = inquiries?.data || inquiries || [];
  const recentDeals = (deals || []).slice(0, 5);

  const totalDeals = monthly?.summary?.total_deals || 0;
  const wonDealsCount = monthly?.summary?.won || 0;
  const totalValue = monthly?.summary?.total_value || 0;
  const wonValue = monthly?.summary?.won_value || 0;
  const conversionRate = monthly?.summary?.conversion_rate || 0;

  // Find selected salesperson specific KRA metrics from reports response
  const selectedKRA = spList.find((s: any) => s.salesperson_phone === selectedPhone);

  return (
    <div className="space-y-6">
      {/* Header and Salesperson Dropdown Selector */}
      <div className="bg-white border rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={26} className="text-blue-600" />
            Admin Overview Dashboard
          </h1>
          <p className="text-gray-500 text-sm">
            {selectedSalesperson
              ? `Currently viewing performance for: ${selectedSalesperson.name} (${selectedSalesperson.employee_id})`
              : 'Viewing global company-wide sales performance overview'}
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Month/Year Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg bg-white border-gray-300 text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          >
            {months.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg bg-white border-gray-300 text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <span className="w-[1px] h-6 bg-gray-200 mx-1" />

          <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Filter:</label>
          <select
            value={selectedPhone}
            onChange={(e) => setSelectedPhone(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white border-gray-300 text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          >
            <option value="">All Salespeople (Global)</option>
            {salespeople.map((sp: any) => (
              <option key={sp.phone} value={sp.phone}>
                {sp.name} ({sp.employee_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₹{Number(totalValue).toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-1">{totalDeals} active deals</p>
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
          {selectedKRA ? (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">KRA Score</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">{selectedKRA.kra_score}/100</p>
              <p className="text-xs text-gray-500 mt-1">Visits: {selectedKRA.visits?.total || 0}/40 target</p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Inquiries for Review</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{reviewQueue.length}</p>
              <p className="text-xs text-gray-500 mt-1">Low AI extraction confidence</p>
            </>
          )}
        </div>
      </div>

      {/* Main Breakdown Section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left column (Detailed Lists) */}
        <div className="col-span-2 space-y-6">
          {/* Recent Deals */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <ShoppingBag size={18} className="text-indigo-500" />
                {selectedSalesperson
                  ? `Recent Deals by ${selectedSalesperson.name}`
                  : 'Recent Company-wide Deals'}
              </h3>
              <button onClick={() => navigate('/')} className="text-xs text-blue-600 hover:underline flex items-center">
                Go to Pipeline <ChevronRight size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {recentDeals.length > 0 ? (
                recentDeals.map((deal: any) => (
                  <div key={deal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{deal.customer_name || 'Unknown Customer'}</p>
                      <p className="text-xs text-gray-500">PO Number: {deal.po_number || '—'}</p>
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
                ))
              ) : (
                <p className="text-center py-6 text-gray-400 text-sm">No recent deals found</p>
              )}
            </div>
          </div>

          {/* SKU Breakdown table */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Calendar size={18} className="text-green-500" />
                Product / SKU Distribution
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['SKU', 'Total Qty', 'Unit', 'Total Value'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(sku?.skus || []).slice(0, 5).map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{item.sku_text}</td>
                    <td className="px-4 py-3 text-gray-800">{item.total_quantity || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{item.unit || 'MT'}</td>
                    <td className="px-4 py-3 text-gray-800 font-semibold">
                      {item.total_value ? `₹${Number(item.total_value).toLocaleString('en-IN')}` : '—'}
                    </td>
                  </tr>
                ))}
                {(sku?.skus || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-400 text-sm">No SKU breakdown data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column (Context and Leaderboard) */}
        <div className="space-y-6">
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
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all"
                      style={{ width: `${funnel.funnel[0]?.count > 0 ? (stage.count / funnel.funnel[0].count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Salesperson Quick stats */}
          {!selectedSalesperson && (
            <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-gray-50 flex items-center gap-2">
                <UserCheck size={18} className="text-blue-500" />
                <h3 className="font-semibold text-gray-800">Leaderboard Scores</h3>
              </div>
              <div className="p-4 space-y-3">
                {spList.slice(0, 4).map((sp: any) => (
                  <div
                    key={sp.salesperson_phone}
                    onClick={() => setSelectedPhone(sp.salesperson_phone)}
                    className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{sp.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{sp.deals?.total || 0} deals · {sp.visits?.total || 0} visits</p>
                    </div>
                    <span className="text-sm font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                      {sp.kra_score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
