import { useQuery } from '@tanstack/react-query';
import { activityLogsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Loader2,
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
  Calendar,
  Check,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';
import { type FilterPreset } from '../components/DateFilterControl';

type ModuleFilter = 'All' | 'Inquiries' | 'Orders' | 'Visits' | 'Complaints';

export default function LogsPage() {
  const { effectivePhone } = useAuth();
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<FilterPreset>('30_days');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customFrom, setCustomFrom] = useState(getDaysAgo(30));
  const [customTo, setCustomTo] = useState(formatLocalDate());

  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({
    from: getDaysAgo(30),
    to: formatLocalDate(),
  });

  const handleDatePresetChange = (newPreset: FilterPreset) => {
    setDatePreset(newPreset);
    const todayStr = formatLocalDate();
    if (newPreset === 'today') {
      setShowCustomDate(false);
      setDateRange({ from: todayStr, to: todayStr });
    } else if (newPreset === '7_days') {
      setShowCustomDate(false);
      setDateRange({ from: getDaysAgo(7), to: todayStr });
    } else if (newPreset === '30_days') {
      setShowCustomDate(false);
      setDateRange({ from: getDaysAgo(30), to: todayStr });
    } else if (newPreset === '90_days') {
      setShowCustomDate(false);
      setDateRange({ from: getDaysAgo(90), to: todayStr });
    } else if (newPreset === 'custom') {
      setShowCustomDate(true);
      setDateRange({ from: customFrom, to: customTo });
    }
  };

  const handleCustomApply = () => {
    let effectiveTo = customTo;
    if (customFrom && customTo && customTo < customFrom) {
      effectiveTo = customFrom;
      setCustomTo(customFrom);
    }
    setDateRange({ from: customFrom, to: effectiveTo });
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setModuleFilter('All');
    setDatePreset('30_days');
    setShowCustomDate(false);
    setDateRange({
      from: getDaysAgo(30),
      to: formatLocalDate(),
    });
  };

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

  const getModuleBadge = (mod: string) => {
    switch (mod) {
      case 'Inquiries':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 uppercase shadow-2xs">
            <FileText size={12} className="text-blue-600" />
            Inquiries
          </span>
        );
      case 'Orders':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase shadow-2xs">
            <ShoppingCart size={12} className="text-emerald-600" />
            Orders
          </span>
        );
      case 'Visits':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-purple-50 text-purple-700 border border-purple-200 uppercase shadow-2xs">
            <MapPin size={12} className="text-purple-600" />
            Visits
          </span>
        );
      case 'Complaints':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-rose-50 text-rose-700 border border-rose-200 uppercase shadow-2xs">
            <AlertTriangle size={12} className="text-rose-600" />
            Complaints
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200 uppercase">
            <Layers size={12} className="text-slate-500" />
            {mod || 'General'}
          </span>
        );
    }
  };

  const getNodeColor = (mod: string) => {
    switch (mod) {
      case 'Orders':
        return 'border-emerald-500 bg-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.35)]';
      case 'Inquiries':
        return 'border-blue-600 bg-blue-50 shadow-[0_0_8px_rgba(37,99,235,0.35)]';
      case 'Visits':
        return 'border-purple-500 bg-purple-50 shadow-[0_0_8px_rgba(168,85,247,0.35)]';
      case 'Complaints':
        return 'border-rose-500 bg-rose-50 shadow-[0_0_8px_rgba(244,63,94,0.35)]';
      default:
        return 'border-blue-500 bg-blue-50 shadow-[0_0_8px_rgba(59,130,246,0.35)]';
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
    if (!timestampStr) return { date: '-', time: '', groupDate: '-' };
    try {
      const d = new Date(timestampStr);
      return {
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase(),
        groupDate: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      };
    } catch {
      return { date: timestampStr, time: '', groupDate: timestampStr };
    }
  };

  // Group logs by Date Header (e.g. 26 AUG 2026)
  const groupedLogs = useMemo(() => {
    if (!activityLogsData || !Array.isArray(activityLogsData)) return [];
    const groups: { dateLabel: string; items: any[] }[] = [];
    let currentGroup: { dateLabel: string; items: any[] } | null = null;

    for (const log of activityLogsData) {
      const { groupDate } = formatDateTime(log.timestamp || log.created_at);
      if (!currentGroup || currentGroup.dateLabel !== groupDate) {
        currentGroup = { dateLabel: groupDate, items: [log] };
        groups.push(currentGroup);
      } else {
        currentGroup.items.push(log);
      }
    }
    return groups;
  }, [activityLogsData]);

  const presetLabel =
    datePreset === 'today'
      ? 'today'
      : datePreset === '7_days'
        ? 'last 7 days'
        : datePreset === '90_days'
          ? 'last 90 days'
          : datePreset === 'custom'
            ? 'custom range'
            : 'last 30 days';

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12 font-sans text-slate-800">
      {/* Top Eyebrow & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
            Activity Logs
          </h1>
        </div>

        {/* Top-right Events Count Pill */}
        <div className="px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs text-xs font-mono text-slate-600 flex items-center gap-2">
          <span className="font-bold text-blue-600">
            {activityLogsData ? activityLogsData.length : 0}
          </span>{' '}
          events · <span className="text-slate-400">{presetLabel}</span>
        </div>
      </div>

      {/* Filter & Search Bar - Compact Single Row Matching Image 2 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs w-full">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
          {/* 1. Compact Search Bar with Clear (X) Icon */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search customer, rep, action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400 bg-white shadow-2xs"
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

          {/* 2. Days Filter Dropdown (2nd Position with Calendar Icon) */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as FilterPreset)}
              className="w-full sm:w-auto pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all"
            >
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 3. Module Dropdown Filter (3rd Position) */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value as ModuleFilter)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all"
            >
              <option value="All">All ({moduleCounts.All})</option>
              <option value="Inquiries">Inquiries ({moduleCounts.Inquiries})</option>
              <option value="Orders">Orders ({moduleCounts.Orders})</option>
              <option value="Visits">Visits ({moduleCounts.Visits})</option>
              <option value="Complaints">Complaints ({moduleCounts.Complaints})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 4. Clear Filter Button (4th Position) */}
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            Clear Filter
          </button>
        </div>

        {/* 5. Refresh Button Right-Aligned */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => refetch()}
            className="p-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center justify-center"
            title="Refresh Logs"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-700' : ''} />
          </button>
        </div>

        {/* Custom Date Pickers (when custom range is active) */}
        {showCustomDate && (
          <div className="w-full flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs font-medium animate-in fade-in duration-150">
            <span className="text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-300 text-slate-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleCustomApply}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <Check size={12} /> Apply
            </button>
          </div>
        )}
      </div>

      {/* Activity Stream Section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
          <p className="text-xs text-slate-500 font-medium">Loading activity stream...</p>
        </div>
      ) : !activityLogsData || activityLogsData.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto mb-3">
            <RefreshCw size={22} className="rotate-45" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No activity logs recorded</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Events recorded across Inquiries, Orders, Visits, and Complaints will appear on this
            timeline.
          </p>
          {(searchQuery || moduleFilter !== 'All') && (
            <button
              onClick={handleClearAllFilters}
              className="mt-4 px-4 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedLogs.map((group) => (
            <div key={group.dateLabel} className="space-y-3">
              {/* Date Group Heading (e.g. 26 AUG 2026) */}
              <div className="text-[11px] font-mono tracking-[0.25em] text-slate-500 uppercase font-bold pl-8 flex items-center gap-3">
                <span>{group.dateLabel}</span>
                <div className="h-[1px] flex-1 bg-slate-200"></div>
              </div>

              {/* Timeline Track & Cards */}
              <div className="relative pl-8 space-y-3.5 before:absolute before:left-3 before:top-2 before:bottom-0 before:w-[2px] before:bg-gradient-to-b before:from-blue-400 before:via-slate-200 before:to-transparent">
                {group.items.map((log: any, idx: number) => {
                  const relativeTime = formatRelativeTime(log.timestamp || log.created_at);
                  const { date, time } = formatDateTime(log.timestamp || log.created_at);
                  const nodeClass = getNodeColor(log.module);

                  return (
                    <div key={log.id || idx} className="relative group">
                      {/* Timeline Node Dot */}
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 absolute -left-[1.7rem] top-5.5 z-10 transition-transform group-hover:scale-125 ${nodeClass}`}
                      ></div>

                      {/* Clean Light-Themed Activity Card */}
                      <div className="bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all duration-150">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          {/* Left: Module Tag, Description, Meta */}
                          <div className="space-y-2 flex-1 min-w-0">
                            <div>{getModuleBadge(log.module)}</div>

                            <p className="text-slate-900 font-bold text-sm sm:text-[15px] leading-snug tracking-wide break-words">
                              {log.description || 'Activity recorded'}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                              {log.customer_name && (
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200/80">
                                  {log.customer_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                <User size={13} className="text-slate-400" />
                                {log.salesperson_name || 'Sales Team'}
                              </span>
                            </div>
                          </div>

                          {/* Right: Date, Time & Relative Time Badge */}
                          <div className="shrink-0 text-left sm:text-right text-xs font-mono flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <div>
                              <p className="font-bold text-slate-800">{date}</p>
                              <p className="text-[11px] text-slate-400">{time}</p>
                            </div>
                            {relativeTime && (
                              <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full mt-1.5 inline-block shadow-2xs">
                                {relativeTime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
