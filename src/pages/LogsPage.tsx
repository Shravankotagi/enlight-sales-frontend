import { useQuery } from '@tanstack/react-query';
import { activityLogsApi, inquiriesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  History,
  RefreshCw,
  Search,
  X,
  FileText,
  ShoppingCart,
  MapPin,
  AlertTriangle,
  Layers,
  User,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';

type MainTab = 'activity' | 'review' | 'bot_raw';
type ModuleFilter = 'All' | 'Inquiries' | 'Orders' | 'Visits' | 'Complaints';

export default function LogsPage() {
  const { effectivePhone } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>('activity');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: '30_days',
    from: getDaysAgo(30),
    to: formatLocalDate(),
  });

  const fromDate = dateRange.from
    ? dateRange.from.includes('T')
      ? dateRange.from
      : `${dateRange.from}T00:00:00.000Z`
    : undefined;
  const toDate = dateRange.to
    ? dateRange.to.includes('T')
      ? dateRange.to
      : `${dateRange.to}T23:59:59.999Z`
    : undefined;

  // 1. Fetch Activity Logs
  const {
    data: activityLogsData,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['activity-logs', effectivePhone, dateRange, moduleFilter, searchQuery],
    queryFn: () =>
      activityLogsApi
        .getAll({
          salesperson_phone: effectivePhone || undefined,
          from: fromDate,
          to: toDate,
          module: moduleFilter === 'All' ? undefined : moduleFilter,
          search: searchQuery.trim() || undefined,
          limit: 200,
        })
        .then((r) => {
          const raw = r?.data;
          return Array.isArray(raw)
            ? raw
            : raw?.data && Array.isArray(raw.data)
              ? raw.data
              : [];
        }),
  });

  // 2. Fetch Review Queue Logs
  const {
    data: reviewData,
    isLoading: reviewLoading,
    refetch: refetchReview,
  } = useQuery({
    queryKey: ['logs-review', effectivePhone, dateRange],
    queryFn: () =>
      inquiriesApi
        .getReviewQueue({ salesperson_phone: effectivePhone || undefined, from: fromDate, to: toDate })
        .then((r) => {
          const raw = r?.data;
          return Array.isArray(raw)
            ? raw
            : raw?.data && Array.isArray(raw.data)
              ? raw.data
              : [];
        }),
  });

  // 3. Fetch Raw Bot Logs
  const {
    data: rawBotData,
    isLoading: rawBotLoading,
    refetch: refetchRawBot,
  } = useQuery({
    queryKey: ['logs-raw-bot', effectivePhone, dateRange],
    queryFn: () =>
      inquiriesApi
        .getAll({ salesperson_phone: effectivePhone || undefined, from: fromDate, to: toDate })
        .then((r) => {
          const raw = r?.data;
          return Array.isArray(raw)
            ? raw
            : raw?.data && Array.isArray(raw.data)
              ? raw.data
              : [];
        }),
  });

  const handleRefresh = () => {
    if (mainTab === 'activity') refetchActivity();
    else if (mainTab === 'review') refetchReview();
    else refetchRawBot();
  };

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'Inquiries':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FileText size={12} />
            Inquiries
          </span>
        );
      case 'Orders':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShoppingCart size={12} />
            Orders
          </span>
        );
      case 'Visits':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <MapPin size={12} />
            Visits
          </span>
        );
      case 'Complaints':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle size={12} />
            Complaints
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Layers size={12} />
            {mod || 'General'}
          </span>
        );
    }
  };

  const formatRelativeTime = (timestampStr: string) => {
    if (!timestampStr) return '';
    try {
      const diffSec = Math.floor((Date.now() - new Date(timestampStr).getTime()) / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  // Counts for Module pills in Activity Tab
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      Inquiries: 0,
      Orders: 0,
      Visits: 0,
      Complaints: 0,
    };
    if (activityLogsData && Array.isArray(activityLogsData)) {
      counts.All = activityLogsData.length;
      for (const log of activityLogsData) {
        if (log.module && counts[log.module] !== undefined) {
          counts[log.module]++;
        }
      }
    }
    return counts;
  }, [activityLogsData]);

  const isLoading =
    mainTab === 'activity'
      ? activityLoading
      : mainTab === 'review'
        ? reviewLoading
        : rawBotLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <History className="text-indigo-600" size={28} />
            Activity Logs
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Minimal, searchable activity trail across Inquiries, Orders, Visits, and Complaints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateFilterControl onChange={setDateRange} initialPreset="30_days" />

          <button
            onClick={handleRefresh}
            className="p-2.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-xs"
            title="Refresh Logs"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setMainTab('activity')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            mainTab === 'activity'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History size={16} />
          Activity Logs
          {activityLogsData && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                mainTab === 'activity' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {activityLogsData.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('review')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            mainTab === 'review'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertCircle size={16} />
          Bot Review Queue
          {reviewData && reviewData.length > 0 && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                mainTab === 'review' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700'
              }`}
            >
              {reviewData.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('bot_raw')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            mainTab === 'bot_raw'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers size={16} />
          Raw Bot Captures
        </button>
      </div>

      {/* ACTIVITY LOGS TAB CONTENT */}
      {mainTab === 'activity' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Module Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by customer, salesperson, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Module Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {(['All', 'Inquiries', 'Orders', 'Visits', 'Complaints'] as ModuleFilter[]).map(
                (mod) => {
                  const isActive = moduleFilter === mod;
                  return (
                    <button
                      key={mod}
                      onClick={() => setModuleFilter(mod)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {mod}
                      {moduleCounts[mod] !== undefined && moduleCounts[mod] > 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {moduleCounts[mod]}
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Activity Logs Stream List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
              <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
              <p className="text-sm text-slate-500 font-medium">Loading activity logs...</p>
            </div>
          ) : !activityLogsData || activityLogsData.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <History size={24} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No activity logs recorded</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                Activities logged across Inquiries, Orders, Visits, and Complaints will appear here
                automatically.
              </p>
              {(searchQuery || moduleFilter !== 'All') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setModuleFilter('All');
                  }}
                  className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  Clear search &amp; filters
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
              {activityLogsData.map((log: any, idx: number) => {
                const relativeTime = formatRelativeTime(log.timestamp || log.created_at);
                const fullTime = log.timestamp
                  ? new Date(log.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : '-';

                return (
                  <div
                    key={log.id || idx}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    {/* Left: Module Badge + Description + Customer */}
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <div className="shrink-0">{getModuleBadge(log.module)}</div>

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 font-medium leading-snug break-words">
                          {log.description || 'Activity recorded'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                          {log.customer_name && (
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {log.customer_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-500">
                            <User size={12} className="text-slate-400" />
                            {log.salesperson_name || 'Sales Team'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Relative Time */}
                    <div className="shrink-0 text-left sm:text-right text-xs text-slate-500 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <span className="font-medium text-slate-700">{fullTime}</span>
                      {relativeTime && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {relativeTime}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BOT REVIEW QUEUE TAB */}
      {mainTab === 'review' && (
        <div className="space-y-4">
          {reviewLoading ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sender / Customer</th>
                    <th className="px-4 py-3">Raw Message Text</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reviewData || []).map((log: any, idx: number) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={14} className="text-orange-500" />
                          <span className="text-xs capitalize font-medium text-orange-700">
                            {log.status || 'review'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {log.sender_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {log.sender_phone || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 max-w-sm">
                        <p
                          className="text-xs text-slate-700 font-mono bg-slate-50 p-1.5 rounded border border-slate-200 truncate"
                          title={log.raw_text}
                        >
                          {log.raw_text || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-0.5 rounded-full capitalize">
                          {log.source_channel || 'whatsapp'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-bold text-amber-600">
                          {log.overall_confidence != null
                            ? `${Math.round((log.overall_confidence > 1 ? log.overall_confidence / 100 : log.overall_confidence) * 100)}%`
                            : 'Review Needed'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!reviewData || reviewData.length === 0) && (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500" />
                  Review queue is completely clear!
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* RAW BOT CAPTURES TAB */}
      {mainTab === 'bot_raw' && (
        <div className="space-y-4">
          {rawBotLoading ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sender / Phone</th>
                    <th className="px-4 py-3">Raw Message Text</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(rawBotData || []).map((log: any, idx: number) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs capitalize font-medium px-2 py-0.5 rounded-full ${
                            log.status === 'processed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-orange-50 text-orange-700'
                          }`}
                        >
                          {log.status || 'review'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-slate-900">
                          {log.sender_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {log.sender_phone || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 max-w-sm">
                        <p
                          className="text-xs text-slate-700 font-mono bg-slate-50 p-1.5 rounded border border-slate-200 truncate"
                          title={log.raw_text}
                        >
                          {log.raw_text || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-0.5 rounded-full capitalize">
                          {log.source_channel || 'whatsapp'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">
                        {log.overall_confidence != null
                          ? `${Math.round((log.overall_confidence > 1 ? log.overall_confidence / 100 : log.overall_confidence) * 100)}%`
                          : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!rawBotData || rawBotData.length === 0) && (
                <div className="text-center py-12 text-slate-400">No bot captures found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
