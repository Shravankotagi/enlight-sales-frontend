import { useQuery } from '@tanstack/react-query';
import { inquiriesApi } from '../lib/api';
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export default function InquiriesPage() {
  const [tab, setTab] = useState<'all' | 'review'>('review');

  const { data: reviewData, isLoading: reviewLoading } = useQuery({
    queryKey: ['inquiries-review'],
    queryFn: () => inquiriesApi.getReviewQueue().then(r => r.data.data),
  });

  const { data: allData, isLoading: allLoading } = useQuery({
    queryKey: ['inquiries-all'],
    queryFn: () => inquiriesApi.getAll().then(r => r.data.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['inquiries-stats'],
    queryFn: () => inquiriesApi.getStats().then(r => r.data.data),
  });

  const isLoading = tab === 'review' ? reviewLoading : allLoading;
  const inquiries = tab === 'review' ? reviewData : allData;

  const statusIcon = (status: string) => {
    if (status === 'processed') 
      return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'review') 
      return <AlertCircle size={14} className="text-orange-500" />;
    return <Clock size={14} className="text-blue-500" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquiries</h1>
          <p className="text-gray-500 text-sm">WhatsApp bot captured inquiries</p>
        </div>

        {statsData && (
          <div className="flex gap-4">
            {[
              { label: 'Total', value: statsData.total, color: 'text-gray-800' },
              { label: 'Review', value: statsData.review, color: 'text-orange-600' },
              { label: 'Processed', value: statsData.processed, color: 'text-green-600' },
            ].map(s => (
              <div key={s.label} className="text-center bg-white 
                border rounded-lg px-4 py-2">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'review', label: `Review Queue (${reviewData?.length || 0})` },
          { key: 'all', label: 'All Inquiries' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key as 'all' | 'review')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Status', 'Sender', 'Message', 'Channel', 
                  'Confidence', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold 
                    text-gray-500 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(inquiries || []).map((inq: any) => (
                <tr key={inq.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {statusIcon(inq.status)}
                      <span className="text-xs capitalize text-gray-600">
                        {inq.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">
                      {inq.sender_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">{inq.sender_phone}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-sm text-gray-700 truncate">
                      {inq.raw_text}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-green-100 text-green-700 
                      px-2 py-0.5 rounded-full">
                      {inq.source_channel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inq.overall_confidence != null ? (
                      <span className={`text-sm font-semibold
                        ${inq.overall_confidence >= 0.85 
                          ? 'text-green-600' : 'text-orange-500'}`}>
                        {Math.round(inq.overall_confidence * 100)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(inq.created_at).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!inquiries || inquiries.length === 0) && (
            <div className="text-center py-12 text-gray-400">
              No inquiries found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
