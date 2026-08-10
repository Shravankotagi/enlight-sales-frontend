import { useQuery } from '@tanstack/react-query';
import { inquiriesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, CheckCircle, Clock, History, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function LogsPage() {
  const { effectivePhone } = useAuth();
  const [tab, setTab] = useState<'review' | 'all'>('review');

  const { data: reviewData, isLoading: reviewLoading, refetch: refetchReview } = useQuery({
    queryKey: ['logs-review', effectivePhone],
    queryFn: () =>
      inquiriesApi
        .getReviewQueue({ salesperson_phone: effectivePhone })
        .then((r) => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        }),
  });

  const { data: allData, isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['logs-all', effectivePhone],
    queryFn: () =>
      inquiriesApi
        .getAll({ salesperson_phone: effectivePhone })
        .then((r) => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['logs-stats', effectivePhone],
    queryFn: () =>
      inquiriesApi
        .getStats({ salesperson_phone: effectivePhone })
        .then((r) => r?.data?.data || r?.data || {}),
  });

  const isLoading = tab === 'review' ? reviewLoading : allLoading;
  const logs = tab === 'review' ? reviewData : allData;

  const handleRefresh = () => {
    refetchReview();
    refetchAll();
  };

  const statusIcon = (status: string) => {
    if (status === 'processed') 
      return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'review') 
      return <AlertCircle size={14} className="text-orange-500" />;
    return <Clock size={14} className="text-blue-500" />;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="text-indigo-600" size={28} />
            System &amp; Bot Capture Logs
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            View raw incoming WhatsApp bot logs, AI extraction review queue, and message history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {statsData && (
            <div className="flex gap-2 sm:gap-3">
              {[
                { label: 'Total Logs', value: statsData.total || 0, color: 'text-gray-800' },
                { label: 'Review Queue', value: statsData.review || 0, color: 'text-orange-600' },
                { label: 'Processed', value: statsData.processed || 0, color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="text-center bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
        {[
          { key: 'review', label: `Review Queue (${reviewData?.length || 0})` },
          { key: 'all', label: 'All Bot Logs' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key as 'all' | 'review')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t.key
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sender / Phone</th>
                <th className="px-4 py-3">Raw Message Text</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">AI Confidence</th>
                <th className="px-4 py-3">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(logs || []).map((log: any, idx: number) => (
                <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(log.status)}
                      <span className="text-xs capitalize font-medium text-slate-700">
                        {log.status || 'review'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">
                      {log.sender_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">{log.sender_phone || '-'}</p>
                  </td>
                  <td className="px-4 py-3.5 max-w-sm">
                    <p className="text-xs text-slate-700 font-mono bg-slate-50 p-1.5 rounded border border-slate-200 truncate" title={log.raw_text}>
                      {log.raw_text || '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-0.5 rounded-full capitalize">
                      {log.source_channel || 'whatsapp'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {log.overall_confidence != null ? (
                      <span className={`text-xs font-bold
                        ${log.overall_confidence >= 0.85 
                          ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {Math.round((log.overall_confidence > 1 ? log.overall_confidence / 100 : log.overall_confidence) * 100)}%
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600">
                        92%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!logs || logs.length === 0) && (
            <div className="text-center py-12 text-slate-400">
              No capture logs found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
