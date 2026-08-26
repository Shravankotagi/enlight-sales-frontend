import { useQuery } from '@tanstack/react-query';
import { activityLogsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Loader2,
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
  ChevronDown,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';

type ModuleFilter = 'All' | 'Inquiries' | 'Orders' | 'Visits' | 'Complaints';

export default function LogsPage() {
  const { effectivePhone } = useAuth();
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

  // Fetch Activity Logs
  const {
    data: activityLogsData,
    isLoading,
    refetch,
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
          limit: 300,
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

  // Fetch count query for all modules across current date filter
  const { data: allModuleCountsData } = useQuery({
    queryKey: ['activity-logs-counts', effectivePhone, dateRange],
    queryFn: () =>
      activityLogsApi
        .getAll({
          salesperson_phone: effectivePhone || undefined,
          from: fromDate,
          to: toDate,
          limit: 500,
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

  // Accurate module counts for the dropdown
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      Inquiries: 0,
      Orders: 0,
      Visits: 0,
      Complaints: 0,
    };
    const list = allModuleCountsData || activityLogsData || [];
    if (Array.isArray(list)) {
      counts.All = list.length;
      for (const log of list) {
        if (log.module && counts[log.module] !== undefined) {
          counts[log.module]++;
        }
      }
    }
    return counts;
  }, [allModuleCountsData, activityLogsData]);

  return (
    <div className="space-y-6 w-full animate-fade-in pb-12">
      {/* Header Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <History className="text-indigo-600" size={28} />
          Activity Logs
        </h1>
      </div>

      {/* Unified Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs w-full">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          {/* 1. Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search customer, salesperson, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* 2. Module Dropdown Filter */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <Layers size={14} className="absolute left-3 text-indigo-600 pointer-events-none" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value as ModuleFilter)}
              className="w-full sm:w-auto pl-8.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer appearance-none transition-all"
            >
              <option value="All">All Modules ({moduleCounts.All})</option>
              <option value="Inquiries">Inquiries ({moduleCounts.Inquiries})</option>
              <option value="Orders">Orders ({moduleCounts.Orders})</option>
              <option value="Visits">Visits ({moduleCounts.Visits})</option>
              <option value="Complaints">Complaints ({moduleCounts.Complaints})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 3. Date Filter Control */}
          <DateFilterControl onChange={setDateRange} initialPreset="30_days" />

          {/* 4. Refresh Button */}
          <button
            onClick={() => refetch()}
            className="px-2.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer flex items-center justify-center"
            title="Refresh Logs"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* 5. Clear Filter Button (when active) */}
          {(searchQuery || moduleFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setModuleFilter('All');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Activity Logs Stream List */}
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
  );
}
