import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { kraApi } from '../lib/api';
import { Loader2, CheckCircle, AlertCircle, Clock, ExternalLink, X } from 'lucide-react';

function KRACard({ number, label, data, onClick }: { 
  number: number; label: string; data: any; onClick?: () => void;
}) {
  const status = data.status || 'default';
  const configMap: Record<string, { class: string; icon: React.ReactNode | null; badge: string; }> = {
    achieved: { class: 'border-green-200 bg-green-50', 
                 icon: <CheckCircle size={16} className="text-green-600" />,
                 badge: 'bg-green-100 text-green-700' },
    on_track: { class: 'border-blue-200 bg-blue-50',
                 icon: <Clock size={16} className="text-blue-600" />,
                 badge: 'bg-blue-100 text-blue-700' },
    in_progress: { class: 'border-yellow-200 bg-yellow-50',
                    icon: <Clock size={16} className="text-yellow-600" />,
                    badge: 'bg-yellow-100 text-yellow-700' },
    at_risk: { class: 'border-red-200 bg-red-50',
                icon: <AlertCircle size={16} className="text-red-600" />,
                badge: 'bg-red-100 text-red-700' },
    tracked: { class: 'border-gray-200 bg-gray-50',
                icon: <CheckCircle size={16} className="text-gray-500" />,
                badge: 'bg-gray-100 text-gray-600' },
  };

  const statusConfig = configMap[status] || { class: 'border-gray-200 bg-white', 
                        icon: null, badge: 'bg-gray-100 text-gray-600' };

  const renderMetrics = () => {
    switch(number) {
      case 1: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Deals</span>
            <span className="font-semibold">{data.deals_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Won</span>
            <span className="font-semibold text-green-600">{data.won_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Value</span>
            <span className="font-semibold">
              ₹{Number(data.total_value || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Acquired</span>
            <span className="font-semibold">{data.count}/3</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(100, (data.count / 3) * 100)}%` }} />
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Recurring Customers</span>
            <span className="font-semibold">{data.recurring_total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Follow-ups Sent</span>
            <span className="font-semibold">{data.followups_sent}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Resolved</span>
            <span className="font-semibold text-green-600">
              {data.followups_resolved}
            </span>
          </div>
        </div>
      );
      case 4: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Inquiries</span>
            <span className="font-semibold">{data.total_inquiries}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Conversion Rate</span>
            <span className={`font-semibold ${data.conversion_rate >= 70 
              ? 'text-green-600' : 'text-orange-600'}`}>
              {data.conversion_rate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className={`h-2 rounded-full ${data.conversion_rate >= 70 
              ? 'bg-green-500' : 'bg-orange-400'}`}
              style={{ width: `${Math.min(100, data.conversion_rate)}%` }} />
          </div>
          <p className="text-xs text-gray-400">Target: 70-80%</p>
        </div>
      );
      case 5: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Pending</span>
            <span className="font-semibold text-orange-600">
              {data.pending_count}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Collected</span>
            <span className="font-semibold text-green-600">
              {data.collected_amount ? `₹${Number(data.collected_amount).toLocaleString('en-IN')}` : data.collected_count}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Outstanding</span>
            <span className="font-semibold text-red-600">
              ₹{Number(data.total_outstanding || 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      );
      case 6: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Logged via Bot</span>
            <span className="font-semibold">{data.logged_via_bot}</span>
          </div>
          <p className="text-xs text-green-600 mt-1">✅ Auto-tracked via WhatsApp</p>
        </div>
      );
      case 7: return (
        <div className="text-sm">
          {data.rejections === 0 ? (
            <p className="text-green-600 font-semibold">✅ Zero rejections!</p>
          ) : (
            <div className="flex justify-between">
              <span className="text-gray-500">Rejections</span>
              <span className="font-semibold text-red-600">
                {data.rejections}
              </span>
            </div>
          )}
        </div>
      );
      case 8: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Total</span>
            <span className="font-semibold">{data.total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Resolved</span>
            <span className="font-semibold text-green-600">{data.resolved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Within 48h</span>
            <span className="font-semibold">{data.within_48h}</span>
          </div>
          {data.avg_resolution_hrs > 0 && (
            <p className="text-xs text-gray-400">
              Avg: {data.avg_resolution_hrs}h
            </p>
          )}
        </div>
      );
      case 9: return (
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Visits</span>
            <span className="font-semibold">
              {data.total_visits}/{data.target_monthly}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div className="bg-blue-600 h-2 rounded-full"
              style={{ 
                width: `${Math.min(100, 
                  (data.total_visits / data.target_monthly) * 100)}%` 
              }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Field days: {data.unique_days}</span>
            <span>Target: {data.target_monthly}</span>
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border-2 p-4 cursor-pointer hover:shadow-lg hover:border-blue-400 transition-all flex flex-col justify-between h-full min-h-[210px] ${statusConfig.class}`}
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              KRA {number}
            </p>
            <h3 className="text-sm font-semibold text-gray-800 mt-0.5">
              {label}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {statusConfig.icon}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.badge}`}>
              {data.status?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {renderMetrics()}
      </div>

      <div className="mt-4 pt-2.5 border-t border-gray-200/80 flex items-center justify-between text-xs text-blue-600 font-semibold group">
        <span>View Detailed Report Sheet</span>
        <ExternalLink size={13} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}

function KRASheetView({ sheet }: { sheet: any }) {
  if (!sheet) return null;

  return (
    <div className="bg-white border-2 border-gray-300 rounded-xl overflow-hidden shadow-sm font-sans">
      {/* Outer Title Banner */}
      <div className="bg-blue-950 text-white font-bold py-2.5 px-4 text-center text-lg uppercase tracking-wide border-b border-blue-900">
        {sheet.title}
      </div>

      {/* Top Table Header */}
      <div className="grid grid-cols-4 bg-blue-900 text-white font-semibold text-xs text-center border-b divide-x divide-blue-800 uppercase tracking-wider">
        <div className="py-2 px-3">Sr. No.</div>
        <div className="py-2 px-3">KRA (Key Result Area)</div>
        <div className="py-2 px-3">Target</div>
        <div className="py-2 px-3">Achieved</div>
      </div>

      {/* Top Table Content */}
      <div className="grid grid-cols-4 bg-amber-50 text-gray-900 text-sm font-medium text-center border-b divide-x divide-amber-200">
        <div className="py-2.5 px-3 font-semibold">{sheet.number}</div>
        <div className="py-2.5 px-3 font-bold text-gray-800">{sheet.title?.split(':')[1]?.trim() || sheet.title}</div>
        <div className="py-2.5 px-3 text-gray-700">{sheet.target}</div>
        <div className="py-2.5 px-3 font-extrabold text-blue-700">{sheet.achieved}</div>
      </div>

      {/* Explanation Banner */}
      <div className="bg-blue-950 text-white font-bold py-1.5 px-4 text-center text-xs uppercase tracking-wide border-b border-blue-900">
        What this KRA means
      </div>
      <div className="p-3.5 bg-green-50/70 text-gray-800 text-xs text-left italic border-b leading-relaxed border-green-200">
        {sheet.meaning}
      </div>

      {/* Sales Person Explanation Header */}
      <div className="bg-blue-950 text-white font-bold py-1.5 px-4 text-center text-xs uppercase tracking-wide border-b border-blue-900">
        Sales Person Explanation
      </div>

      {/* Detailed Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-blue-900 text-white font-semibold uppercase tracking-wider border-b border-blue-800">
            <tr>
              {sheet.headers?.map((header: string, idx: number) => (
                <th key={idx} className="py-2.5 px-3 border-r border-blue-800 last:border-r-0 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sheet.rows?.length > 0 ? (
              sheet.rows.map((row: any, rIdx: number) => (
                <tr key={rIdx} className="hover:bg-blue-50/40 transition-colors">
                  {Object.values(row).map((val: any, cIdx: number) => (
                    <td key={cIdx} className="py-2.5 px-3 border-r last:border-r-0 text-gray-800 font-medium whitespace-nowrap">
                      {val || '-'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={sheet.headers?.length || 1} className="py-8 text-center text-gray-400 italic font-normal">
                  No breakdown records found for this KRA in the selected month
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KRASheetModal({ kraNumber, sheet, isLoading, onClose }: { kraNumber: number; sheet: any; isLoading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* Modal Header */}
        <div className="sticky top-0 bg-blue-950 text-white px-6 py-4 flex items-center justify-between z-10 border-b border-blue-900">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-wide">{sheet?.title || `KRA ${kraNumber} Report Sheet`}</h2>
            <p className="text-xs text-blue-200 mt-0.5">Detailed KRA Excel Breakdown Sheet</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-blue-900 text-blue-200 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="animate-spin text-blue-600" size={36} />
              <p className="text-sm font-medium text-gray-500">Loading KRA Sheet Report...</p>
            </div>
          ) : sheet ? (
            <KRASheetView sheet={sheet} />
          ) : (
            <div className="text-center py-12 text-gray-500 font-medium">
              No detailed breakdown sheet found for KRA {kraNumber}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KRADashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeKraModal, setActiveKraModal] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['kra-dashboard', selectedMonth, selectedYear],
    queryFn: () => kraApi.getDashboard({ month: selectedMonth, year: selectedYear }).then(r => r.data.data),
    refetchInterval: 60000,
  });

  const { data: sheetsData, isLoading: isSheetsLoading } = useQuery({
    queryKey: ['kra-sheets', selectedMonth, selectedYear],
    queryFn: () => kraApi.getSheets({ month: selectedMonth, year: selectedYear }).then(r => r.data.data || r.data),
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center gap-2 text-red-600 p-4">
      <AlertCircle size={20} />
      <span>Failed to load KRA dashboard</span>
    </div>
  );

  const kras = [
    { number: 1, key: 'kra1' },
    { number: 2, key: 'kra2' },
    { number: 3, key: 'kra3' },
    { number: 4, key: 'kra4' },
    { number: 5, key: 'kra5' },
    { number: 6, key: 'kra6' },
    { number: 7, key: 'kra7' },
    { number: 8, key: 'kra8' },
    { number: 9, key: 'kra9' },
  ];

  const formattedDate = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric'
  });

  const modalSheetKey = activeKraModal ? `kra${activeKraModal}` : null;
  const modalSheet = (sheetsData && modalSheetKey)
    ? (sheetsData[modalSheetKey] || sheetsData.data?.[modalSheetKey])
    : null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KRA Dashboard</h1>
          <p className="text-gray-500 text-sm">
            {formattedDate} · Live from WhatsApp Bot (Click any card to view full KRA Sheet Report)
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {new Date(2026, i, 1).toLocaleString('en-IN', { month: 'long' })}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 items-stretch">
        {kras.map(({ number, key }) => (
          <KRACard
            key={number}
            number={number}
            label={data[key]?.label || `KRA ${number}`}
            data={data[key] || {}}
            onClick={() => setActiveKraModal(number)}
          />
        ))}
      </div>

      {/* Modal Popup when a KRA Card is clicked */}
      {activeKraModal !== null && (
        <KRASheetModal
          kraNumber={activeKraModal}
          sheet={modalSheet}
          isLoading={isSheetsLoading}
          onClose={() => setActiveKraModal(null)}
        />
      )}
    </div>
  );
}
