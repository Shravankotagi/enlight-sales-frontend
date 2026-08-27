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
  Clock,
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 uppercase shadow-[0_0_10px_rgba(99,102,241,0.2)]">
            <FileText size={12} className="text-indigo-400" />
            Inquiries
          </span>
        );
      case 'Orders':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 uppercase shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <ShoppingCart size={12} className="text-emerald-400" />
            Orders
          </span>
        );
      case 'Visits':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-purple-950/80 text-purple-300 border border-purple-700/60 uppercase shadow-[0_0_10px_rgba(168,85,247,0.2)]">
            <MapPin size={12} className="text-purple-400" />
            Visits
          </span>
        );
      case 'Complaints':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-rose-950/80 text-rose-300 border border-rose-700/60 uppercase shadow-[0_0_10px_rgba(244,63,94,0.2)]">
            <AlertTriangle size={12} className="text-rose-400" />
            Complaints
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wider bg-slate-900 text-slate-300 border border-slate-700 uppercase">
            <Layers size={12} className="text-slate-400" />
            {mod || 'General'}
          </span>
        );
    }
  };

  const getNodeColor = (mod: string) => {
    switch (mod) {
      case 'Orders':
        return 'border-emerald-400 shadow-[0_0_10px_#10b981]';
      case 'Inquiries':
        return 'border-indigo-400 shadow-[0_0_10px_#6366f1]';
      case 'Visits':
        return 'border-purple-400 shadow-[0_0_10px_#a855f7]';
      case 'Complaints':
        return 'border-rose-400 shadow-[0_0_10px_#f43f5e]';
      default:
        return 'border-cyan-400 shadow-[0_0_10px_#06b6d4]';
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
    <div className="min-h-screen bg-[#060b13] text-slate-100 p-4 sm:p-6 lg:p-8 rounded-2xl relative overflow-hidden font-sans border border-slate-900 shadow-2xl">
      {/* Background Cyberpunk Grid Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.12),rgba(255,255,255,0))]"></div>
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15, 23, 42, 0.6) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      ></div>

      <div className="relative z-10 space-y-6 w-full max-w-7xl mx-auto">
        {/* Top Eyebrow & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            {/* Live Status Eyebrow */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em] text-cyan-400 uppercase">
                LIVE · ENLIGHT METALS SALES
              </span>
            </div>

            {/* Title with Cyan Glyph */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
              <span className="inline-flex items-center justify-center text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                <RefreshCw size={26} className="rotate-45" />
              </span>
              Activity Logs
            </h1>
          </div>

          {/* Top-right Events Count Pill */}
          <div className="px-4 py-1.5 rounded-full bg-[#0b1322] border border-cyan-900/50 shadow-[0_0_12px_rgba(6,182,212,0.1)] text-xs font-mono text-slate-400 flex items-center gap-2">
            <span className="font-bold text-cyan-300">
              {activityLogsData ? activityLogsData.length : 0}
            </span>{' '}
            events · <span className="text-slate-500">{presetLabel}</span>
          </div>
        </div>

        {/* Cyberpunk Filter Action Bar */}
        <div className="bg-[#0a1220]/95 backdrop-blur-md border border-cyan-950/80 rounded-2xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
              {/* 1. Search Bar */}
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-500/70"
                  size={15}
                />
                <input
                  type="text"
                  placeholder="Search customer, rep, action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-[#060c16] border border-slate-800 focus:border-cyan-500/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 font-mono outline-none transition-all focus:ring-1 focus:ring-cyan-500/40 shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Clear Search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* 2. Module Dropdown Filter */}
              <div className="relative inline-flex items-center w-full sm:w-auto">
                <Layers size={14} className="absolute left-3 text-indigo-400 pointer-events-none" />
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value as ModuleFilter)}
                  className="w-full sm:w-auto pl-8.5 pr-8 py-2 bg-[#0c1527] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-mono font-medium rounded-xl appearance-none cursor-pointer outline-none focus:border-cyan-500/80 transition-all shadow-sm"
                >
                  <option value="All" className="bg-[#0c1527] text-slate-200">
                    All ({moduleCounts.All})
                  </option>
                  <option value="Inquiries" className="bg-[#0c1527] text-slate-200">
                    Inquiries ({moduleCounts.Inquiries})
                  </option>
                  <option value="Orders" className="bg-[#0c1527] text-slate-200">
                    Orders ({moduleCounts.Orders})
                  </option>
                  <option value="Visits" className="bg-[#0c1527] text-slate-200">
                    Visits ({moduleCounts.Visits})
                  </option>
                  <option value="Complaints" className="bg-[#0c1527] text-slate-200">
                    Complaints ({moduleCounts.Complaints})
                  </option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 text-slate-500 pointer-events-none"
                />
              </div>

              {/* 3. Dark Date Preset Dropdown */}
              <div className="relative inline-flex items-center w-full sm:w-auto">
                <Clock size={14} className="absolute left-3 text-cyan-400 pointer-events-none" />
                <select
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value as FilterPreset)}
                  className="w-full sm:w-auto pl-8.5 pr-8 py-2 bg-[#0c1527] border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-mono font-medium rounded-xl appearance-none cursor-pointer outline-none focus:border-cyan-500/80 transition-all shadow-sm"
                >
                  <option value="today" className="bg-[#0c1527] text-slate-200">
                    Today
                  </option>
                  <option value="7_days" className="bg-[#0c1527] text-slate-200">
                    Last 7 Days
                  </option>
                  <option value="30_days" className="bg-[#0c1527] text-slate-200">
                    Last 30 Days
                  </option>
                  <option value="90_days" className="bg-[#0c1527] text-slate-200">
                    Last 90 Days
                  </option>
                  <option value="custom" className="bg-[#0c1527] text-slate-200">
                    Custom Range
                  </option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 text-slate-500 pointer-events-none"
                />
              </div>

              {/* 4. Clear Filter Button */}
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-3.5 py-2 bg-[#160d14] border border-rose-900/60 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-mono font-bold transition-all shadow-sm cursor-pointer"
              >
                Clear Filter
              </button>
            </div>

            {/* 5. Refresh Button Right-Aligned */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => refetch()}
                className="p-2 bg-[#081826] border border-cyan-500/40 text-cyan-400 hover:bg-cyan-950/70 hover:border-cyan-400 rounded-xl transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)] cursor-pointer flex items-center justify-center"
                title="Refresh Logs"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin text-cyan-300' : ''} />
              </button>
            </div>
          </div>

          {/* Custom Date Pickers (when custom range is active) */}
          {showCustomDate && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800 text-xs font-mono animate-in fade-in duration-150">
              <span className="text-slate-400 font-medium">From:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1 bg-[#060c16] border border-slate-700 text-slate-200 rounded-lg outline-none focus:border-cyan-500"
              />
              <span className="text-slate-400 font-medium">To:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1 bg-[#060c16] border border-slate-700 text-slate-200 rounded-lg outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleCustomApply}
                className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Check size={12} /> Apply
              </button>
            </div>
          )}
        </div>

        {/* Activity Stream Section */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-[#0a1220]/70 border border-slate-800/80 rounded-2xl">
            <Loader2 className="animate-spin text-cyan-400 mb-2" size={32} />
            <p className="text-xs font-mono text-slate-400">Loading activity stream...</p>
          </div>
        ) : !activityLogsData || activityLogsData.length === 0 ? (
          <div className="bg-[#0a1220]/80 border border-slate-800/80 rounded-2xl p-12 text-center shadow-lg">
            <div className="w-12 h-12 rounded-full bg-slate-900/80 text-cyan-400 border border-cyan-900/40 flex items-center justify-center mx-auto mb-3">
              <RefreshCw size={22} className="rotate-45" />
            </div>
            <h3 className="text-base font-bold text-white font-mono">No activity logs recorded</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 font-mono">
              Events recorded across Inquiries, Orders, Visits, and Complaints will appear on this
              timeline.
            </p>
            {(searchQuery || moduleFilter !== 'All') && (
              <button
                onClick={handleClearAllFilters}
                className="mt-4 px-4 py-1.5 text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 hover:bg-cyan-900/60 rounded-xl transition-all cursor-pointer"
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
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-800 via-slate-800/50 to-transparent"></div>
                </div>

                {/* Timeline Track & Cards */}
                <div className="relative pl-8 space-y-3.5 before:absolute before:left-3 before:top-2 before:bottom-0 before:w-[2px] before:bg-gradient-to-b before:from-cyan-500/40 before:via-indigo-500/20 before:to-transparent">
                  {group.items.map((log: any, idx: number) => {
                    const relativeTime = formatRelativeTime(log.timestamp || log.created_at);
                    const { date, time } = formatDateTime(log.timestamp || log.created_at);
                    const nodeClass = getNodeColor(log.module);

                    return (
                      <div key={log.id || idx} className="relative group">
                        {/* Glowing Timeline Node Dot */}
                        <div
                          className={`w-3.5 h-3.5 rounded-full border-2 bg-[#060b13] absolute -left-[1.7rem] top-5.5 z-10 transition-transform group-hover:scale-125 ${nodeClass}`}
                        ></div>

                        {/* Glassmorphic Activity Card */}
                        <div className="bg-[#0b1322]/90 hover:bg-[#0e192c] border border-slate-800/90 hover:border-cyan-500/30 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.5)] transition-all duration-200">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            {/* Left: Module Tag, Description, Meta */}
                            <div className="space-y-2 flex-1 min-w-0">
                              <div>{getModuleBadge(log.module)}</div>

                              <p className="text-white font-semibold text-sm sm:text-[15px] leading-snug tracking-wide break-words">
                                {log.description || 'Activity recorded'}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                                {log.customer_name && (
                                  <span className="font-semibold text-slate-300 bg-[#0e1a30] px-2.5 py-0.5 rounded-md border border-slate-700/80">
                                    {log.customer_name}
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5 text-slate-400">
                                  <User size={12} className="text-slate-500" />
                                  {log.salesperson_name || 'Sales Team'}
                                </span>
                              </div>
                            </div>

                            {/* Right: Date, Time & Relative Time Badge */}
                            <div className="shrink-0 text-left sm:text-right text-xs font-mono flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
                              <div>
                                <p className="font-semibold text-slate-300">{date}</p>
                                <p className="text-[11px] text-slate-500">{time}</p>
                              </div>
                              {relativeTime && (
                                <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2.5 py-0.5 rounded-full mt-1.5 inline-block shadow-[0_0_8px_rgba(6,182,212,0.15)]">
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
    </div>
  );
}
