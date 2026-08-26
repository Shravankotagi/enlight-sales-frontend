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
  MessageSquare,
  Globe,
  ImageIcon,
  Sparkles,
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
        .getReviewQueue({
          salesperson_phone: effectivePhone || undefined,
          from: fromDate,
          to: toDate,
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

  // 3. Fetch Raw Bot Logs
  const {
    data: rawBotData,
    isLoading: rawBotLoading,
    refetch: refetchRawBot,
  } = useQuery({
    queryKey: ['logs-raw-bot', effectivePhone, dateRange],
    queryFn: () =>
      inquiriesApi
        .getAll({
          salesperson_phone: effectivePhone || undefined,
          from: fromDate,
          to: toDate,
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

  const handleRefresh = () => {
    if (mainTab === 'activity') refetchActivity();
    else if (mainTab === 'review') refetchReview();
    else refetchRawBot();
  };

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'Inquiries':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <FileText size={12} className="text-blue-600" />
            Inquiries
          </span>
        );
      case 'Orders':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShoppingCart size={12} className="text-emerald-600" />
            Orders
          </span>
        );
      case 'Visits':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <MapPin size={12} className="text-purple-600" />
            Visits
          </span>
        );
      case 'Complaints':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle size={12} className="text-rose-600" />
            Complaints
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Layers size={12} className="text-slate-500" />
            {mod || 'General'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || 'review').toLowerCase();
    if (s === 'confirmed' || s === 'processed' || s === 'won') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle size={12} className="text-emerald-600" />
          {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Confirmed'}
        </span>
      );
    }
    if (s === 'quoted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <FileText size={12} className="text-blue-600" />
          Quoted
        </span>
      );
    }
    if (s === 'review' || s === 'pending' || s === 'needs_review') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertCircle size={12} className="text-amber-600" />
          Review
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        {status || 'Unknown'}
      </span>
    );
  };

  const getChannelBadge = (channel: string) => {
    const c = (channel || '').toLowerCase();
    if (c.includes('image')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/80">
          <ImageIcon size={12} className="text-purple-600" />
          WhatsApp Image
        </span>
      );
    }
    if (c.includes('po') || c.includes('order')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <ShoppingCart size={12} className="text-emerald-600" />
          WhatsApp PO
        </span>
      );
    }
    if (c.includes('web') || c.includes('dashboard')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/80">
          <Globe size={12} className="text-sky-600" />
          Web Dashboard
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
        <MessageSquare size={12} className="text-emerald-600" />
        WhatsApp Text
      </span>
    );
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

  const formatDateTime = (timestampStr: string) => {
    if (!timestampStr) return { date: '-', time: '' };
    try {
      const d = new Date(timestampStr);
      return {
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
    } catch {
      return { date: timestampStr, time: '' };
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
    <div className="space-y-6 w-full animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <History className="text-indigo-600" size={28} />
            Activity Logs
          </h1>
          
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateFilterControl onChange={setDateRange} initialPreset="30_days" />

          <button
            onClick={handleRefresh}
            className="p-2.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-2xs"
            title="Refresh Logs"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
        <button
          onClick={() => setMainTab('activity')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-2 ${
            mainTab === 'activity'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <History
            size={16}
            className={mainTab === 'activity' ? 'text-indigo-600' : 'text-slate-400'}
          />
          Activity Logs
          {activityLogsData && (
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full font-bold ${
                mainTab === 'activity'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {activityLogsData.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('review')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-2 ${
            mainTab === 'review'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <AlertCircle
            size={16}
            className={mainTab === 'review' ? 'text-amber-600' : 'text-slate-400'}
          />
          Bot Review Queue
          {reviewData && reviewData.length > 0 && (
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full font-bold ${
                mainTab === 'review'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {reviewData.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('bot_raw')}
          className={`px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-2 ${
            mainTab === 'bot_raw'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Layers
            size={16}
            className={mainTab === 'bot_raw' ? 'text-blue-600' : 'text-slate-400'}
          />
          Raw Bot Captures
        </button>
      </div>

      {/* ─── TAB 1: ACTIVITY LOGS STREAM ─── */}
      {mainTab === 'activity' && (
        <div className="space-y-4 w-full">
          {/* Controls Bar: Search & Module Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs w-full">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by customer, salesperson, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all font-medium"
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

          {/* Activity Logs List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-200 w-full">
              <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
              <p className="text-sm text-slate-500 font-medium">Loading activity logs...</p>
            </div>
          ) : !activityLogsData || activityLogsData.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs w-full">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <History size={24} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No activity logs found</h3>
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
            <div className="w-full bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden divide-y divide-slate-100">
              {activityLogsData.map((log: any, idx: number) => {
                const relativeTime = formatRelativeTime(log.timestamp || log.created_at);
                const { date, time } = formatDateTime(log.timestamp || log.created_at);

                return (
                  <div
                    key={log.id || idx}
                    className="p-4 hover:bg-slate-50/90 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    {/* Left: Module Badge + Action Description + Customer */}
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      <div className="shrink-0 pt-0.5 sm:pt-0">{getModuleBadge(log.module)}</div>

                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 font-semibold leading-snug break-words">
                          {log.description || 'Activity recorded'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                          {log.customer_name && (
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {log.customer_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-slate-500 font-medium">
                            <User size={12} className="text-slate-400" />
                            {log.salesperson_name || 'Sales Team'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Date, Time & Relative Time */}
                    <div className="shrink-0 text-left sm:text-right text-xs text-slate-500 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="flex items-center sm:flex-col sm:items-end gap-1.5 sm:gap-0">
                        <span className="font-semibold text-slate-700">{date}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{time}</span>
                      </div>
                      {relativeTime && (
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 font-bold px-1.5 py-0.2 rounded border border-indigo-100 mt-1">
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

      {/* ─── TAB 2: BOT REVIEW QUEUE ─── */}
      {mainTab === 'review' && (
        <div className="space-y-4 w-full">
          {reviewLoading ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200 w-full">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : (
            <div className="w-full bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 w-32 whitespace-nowrap">Status</th>
                      <th className="px-5 py-3.5 w-56 whitespace-nowrap">Sender / Customer</th>
                      <th className="px-5 py-3.5 min-w-[280px]">Raw Message</th>
                      <th className="px-5 py-3.5 w-44 whitespace-nowrap">Channel</th>
                      <th className="px-5 py-3.5 w-36 whitespace-nowrap">AI Confidence</th>
                      <th className="px-5 py-3.5 w-44 text-right whitespace-nowrap">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(reviewData || []).map((log: any, idx: number) => {
                      const { date, time } = formatDateTime(log.created_at);
                      const conf = log.overall_confidence != null
                        ? Math.round((log.overall_confidence > 1 ? log.overall_confidence / 100 : log.overall_confidence) * 100)
                        : null;

                      return (
                        <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getStatusBadge(log.status || 'review')}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-bold text-slate-900">
                              {log.sender_name || 'Unknown Customer'}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {log.sender_phone || '-'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p
                              className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50 p-2.5 rounded-lg border border-slate-200 break-words"
                              title={log.raw_text}
                            >
                              {log.raw_text || '-'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getChannelBadge(log.source_channel)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {conf !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${
                                  conf >= 85
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                <Sparkles size={11} />
                                {conf}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <p className="text-xs font-semibold text-slate-800">{date}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{time}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(!reviewData || reviewData.length === 0) && (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle size={28} className="mx-auto mb-2 text-emerald-500" />
                  <p className="font-semibold text-slate-700">Review queue is completely clear!</p>
                  <p className="text-xs text-slate-400 mt-1">No items require human intervention.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: RAW BOT CAPTURES ─── */}
      {mainTab === 'bot_raw' && (
        <div className="space-y-4 w-full">
          {rawBotLoading ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200 w-full">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          ) : (
            <div className="w-full bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 w-32 whitespace-nowrap">Status</th>
                      <th className="px-5 py-3.5 w-56 whitespace-nowrap">Sender / Customer</th>
                      <th className="px-5 py-3.5 min-w-[280px]">Raw Message Text</th>
                      <th className="px-5 py-3.5 w-44 whitespace-nowrap">Channel</th>
                      <th className="px-5 py-3.5 w-36 whitespace-nowrap">AI Confidence</th>
                      <th className="px-5 py-3.5 w-44 text-right whitespace-nowrap">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(rawBotData || []).map((log: any, idx: number) => {
                      const { date, time } = formatDateTime(log.created_at);
                      const conf = log.overall_confidence != null
                        ? Math.round((log.overall_confidence > 1 ? log.overall_confidence / 100 : log.overall_confidence) * 100)
                        : null;

                      return (
                        <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getStatusBadge(log.status || 'review')}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-bold text-slate-900">
                              {log.sender_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">
                              {log.sender_phone || '-'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p
                              className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50 p-2.5 rounded-lg border border-slate-200 break-words"
                              title={log.raw_text}
                            >
                              {log.raw_text || '-'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {getChannelBadge(log.source_channel)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {conf !== null ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold ${
                                  conf >= 85
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                <Sparkles size={11} />
                                {conf}%
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <p className="text-xs font-semibold text-slate-800">{date}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{time}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
