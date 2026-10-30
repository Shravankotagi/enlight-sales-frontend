import { useQuery } from '@tanstack/react-query';
import { activityLogsApi, employeesApi } from '../lib/api';
import { normalizeListResponse } from '../lib/queryKeys';
import { formatIstDateTime, formatSessionDuration } from '../utils/istDateTime';
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
  Calendar,
  Check,
  History,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';
import { type FilterPreset } from '../components/DateFilterControl';
import { Select } from '../components/ui/select';

type ModuleFilter = 'All' | 'Inquiries' | 'Orders' | 'Visits' | 'Complaints' | 'Auth' | 'Employees';
function sessionExpiredLine(log: any): string | null {
  const who = [
    log?.salesperson_name,
    log?.change_detail?.employee_id ? `(${log.change_detail.employee_id})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const expired =
    log?.action_type === 'logout' &&
    (log?.change_detail?.reason === 'session_expired' ||
      log?.description === 'Session expired' ||
      String(log?.description || '').startsWith('Session expired.'));
  const loginExpired =
    log?.action_type === 'login' && log?.logout_status === 'Session expired';
  if (!expired && !loginExpired) return null;
  return `Session expired. ${who || 'Employee'} logged out.`;
}

type ActionFilter =
  | 'all'
  | 'login'
  | 'logout'
  | 'employee_activated'
  | 'employee_deactivated'
  | 'employee_deleted';

export default function LogsPage() {
  const { effectivePhone, activeRole, activeMode, isAdmin } = useAuth();
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('All');
  const [actionType, setActionType] = useState<ActionFilter>('all');
  const [authPhone, setAuthPhone] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<FilterPreset>('all');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({
    from: undefined,
    to: undefined,
  });

  const handleDatePresetChange = (newPreset: FilterPreset) => {
    setDatePreset(newPreset);
    const todayStr = formatLocalDate();
    if (newPreset === 'all') {
      setShowCustomDate(false);
      setCustomFrom('');
      setCustomTo('');
      setDateRange({ from: undefined, to: undefined });
    } else if (newPreset === 'today') {
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
    setDatePreset('all');
    setShowCustomDate(false);
    setActionType('all');
    setAuthPhone('');
    setCustomFrom('');
    setCustomTo('');
    setDateRange({
      from: undefined,
      to: undefined,
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
    queryKey: ['activity-logs', effectivePhone, dateRange, moduleFilter, actionType, authPhone, searchQuery, activeRole, activeMode],
    queryFn: () =>
      activityLogsApi
        .getAll({
          salesperson_phone: (moduleFilter === 'Auth' && authPhone) || effectivePhone || undefined,
          mode: activeMode,
          from: fromDate,
          to: toDate,
          module: moduleFilter === 'All' ? undefined : moduleFilter,
          action_type:
            (moduleFilter === 'Auth' || moduleFilter === 'Employees') && actionType !== 'all'
              ? actionType
              : undefined,
          search: searchQuery.trim() || undefined,
          limit: 300,
        })
        .then((r) => {
          const raw = r?.data;
          if (Array.isArray(raw)) return raw;
          if (Array.isArray(raw?.data)) return raw.data;
          if (Array.isArray(raw?.data?.data)) return raw.data.data;
          return [];
        }),
  });

  // Fetch accurate count query for all modules across current date filter
  const { data: allModuleCountsData } = useQuery({
    queryKey: ['activity-logs-counts', effectivePhone, dateRange],
    queryFn: () =>
      activityLogsApi
        .getCounts({
          salesperson_phone: effectivePhone || undefined,
          from: fromDate,
          to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
        })
        .then((r) => {
          const raw = r?.data;
          const payload = raw?.data || raw;
          if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            return payload as Record<string, number>;
          }
          return null;
        })
        .catch(() => null),
  });

  const { data: authEmployees = [] } = useQuery({
    queryKey: ['logs-auth-employees'],
    enabled: isAdmin && moduleFilter === 'Auth',
    queryFn: async () => {
      const res = await employeesApi.getAll().catch(() => null);
      return normalizeListResponse(res?.data) as { name?: string; phone?: string; role?: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: 0,
      Inquiries: 0,
      Orders: 0,
      Visits: 0,
      Complaints: 0,
    };
    if (allModuleCountsData && typeof allModuleCountsData === 'object' && allModuleCountsData.All !== undefined) {
      counts.All = Number(allModuleCountsData.All) || 0;
      counts.Inquiries = Number(allModuleCountsData.Inquiries) || 0;
      counts.Orders = Number(allModuleCountsData.Orders) || 0;
      counts.Visits = Number(allModuleCountsData.Visits) || 0;
      counts.Complaints = Number(allModuleCountsData.Complaints) || 0;
      return counts;
    }
    const list = activityLogsData || [];
    if (Array.isArray(list)) {
      counts.All = list.length;
      for (const log of list) {
        if (!log.module) continue;
        const mod = String(log.module).toLowerCase();
        if (mod.includes('inquir')) {
          counts.Inquiries++;
        } else if (mod.includes('order') || mod.includes('deal')) {
          counts.Orders++;
        } else if (mod.includes('visit')) {
          counts.Visits++;
        } else if (mod.includes('complaint')) {
          counts.Complaints++;
        }
      }
    }
    return counts;
  }, [allModuleCountsData, activityLogsData]);

  const getModuleBadge = (mod: string) => {
    const lowerMod = String(mod || '').toLowerCase();
    if (lowerMod.includes('inquir')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider bg-blue-50 text-blue-700 border border-blue-200 uppercase shadow-2xs">
          <FileText size={12} className="text-blue-600" />
          Inquiries
        </span>
      );
    }
    if (lowerMod.includes('order') || lowerMod.includes('deal')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase shadow-2xs">
          <ShoppingCart size={12} className="text-emerald-600" />
          Orders
        </span>
      );
    }
    if (lowerMod.includes('visit')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider bg-purple-50 text-purple-700 border border-purple-200 uppercase shadow-2xs">
          <MapPin size={12} className="text-purple-600" />
          Visits
        </span>
      );
    }
    if (lowerMod.includes('complaint')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider bg-rose-50 text-rose-700 border border-rose-200 uppercase shadow-2xs">
          <AlertTriangle size={12} className="text-rose-600" />
          Complaints
        </span>
      );
    }
    if (lowerMod === 'employees') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider bg-amber-50 text-amber-800 border border-amber-200 uppercase shadow-2xs">
          <User size={12} className="text-amber-700" />
          User Management
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200 uppercase">
        <Layers size={12} className="text-slate-500" />
        {mod || 'General'}
      </span>
    );
  };

  const getNodeColor = (mod: string) => {
    const lowerMod = String(mod || '').toLowerCase();
    if (lowerMod.includes('order') || lowerMod.includes('deal')) {
      return 'border-emerald-500 bg-emerald-50 shadow-[0_0_8px_rgba(16,185,129,0.35)]';
    }
    if (lowerMod.includes('inquir')) {
      return 'border-blue-600 bg-blue-50 shadow-[0_0_8px_rgba(37,99,235,0.35)]';
    }
    if (lowerMod.includes('visit')) {
      return 'border-purple-500 bg-purple-50 shadow-[0_0_8px_rgba(168,85,247,0.35)]';
    }
    if (lowerMod.includes('complaint')) {
      return 'border-rose-500 bg-rose-50 shadow-[0_0_8px_rgba(244,63,94,0.35)]';
    }
    if (lowerMod === 'employees') {
      return 'border-amber-500 bg-amber-50 shadow-[0_0_8px_rgba(245,158,11,0.35)]';
    }
    return 'border-blue-500 bg-blue-50 shadow-[0_0_8px_rgba(59,130,246,0.35)]';
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

  const formatDateTime = (timestampStr: string) => formatIstDateTime(timestampStr);

  const exportAuthCsv = () => {
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Employee ID', 'Activity', 'Date', 'Time', 'Session ID', 'Logout', 'Duration'];
    const lines = (activityLogsData || []).map((log: any) => {
      const when = formatIstDateTime(log.timestamp || log.created_at);
      const activity = log.action_type === 'login' ? 'Login' : log.description || 'Logout';
      const logout = log.action_type !== 'login'
        ? ''
        : log.logout_at
          ? `${log.logout_status || 'Logout'} ${formatIstDateTime(log.logout_at).label}`
          : log.logout_status || 'No logout recorded';
      return [
        log.salesperson_name,
        log.change_detail?.employee_id,
        activity,
        when.date,
        when.time,
        log.entity_id,
        logout,
        formatSessionDuration(log.duration_minutes),
      ].map(cell).join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'login-logout-logs.csv';
    link.click();
    URL.revokeObjectURL(url);
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
    datePreset === 'all'
      ? 'all time'
      : datePreset === 'today'
        ? 'today'
        : datePreset === '7_days'
          ? 'last 7 days'
          : datePreset === '90_days'
            ? 'last 90 days'
            : datePreset === 'custom'
              ? 'custom range'
              : 'last 30 days';

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Top Eyebrow & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="text-blue-600" size={28} />
            Activity Logs
          </h1>
        </div>

        {/* Top-right Events Count Pill */}
        <div className="px-4 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs text-xs font-mono text-slate-600 flex items-center gap-2">
          <span className="font-bold text-blue-600">
            {(moduleFilter === 'All'
              ? (moduleCounts.All || (activityLogsData ? activityLogsData.length : 0))
              : (moduleCounts[moduleFilter] ?? (activityLogsData ? activityLogsData.length : 0))
            ).toLocaleString('en-IN')}
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
          <Select
            value={datePreset}
            onChange={(e) => handleDatePresetChange(e.target.value as FilterPreset)}
            prefixIcon={<Calendar size={14} className="text-blue-600" />}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-44"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7_days">Last 7 Days</option>
            <option value="30_days">Last 30 Days</option>
            <option value="90_days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </Select>

          {/* 3. Module Dropdown Filter (3rd Position) */}
          <Select
            value={moduleFilter}
            onChange={(e) => {
              setModuleFilter(e.target.value as ModuleFilter);
              setActionType('all');
            }}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-48"
          >
            <option value="All">All ({moduleCounts.All.toLocaleString('en-IN')})</option>
            <option value="Inquiries">Inquiries ({moduleCounts.Inquiries.toLocaleString('en-IN')})</option>
            <option value="Orders">Orders ({moduleCounts.Orders.toLocaleString('en-IN')})</option>
            <option value="Visits">Visits ({moduleCounts.Visits.toLocaleString('en-IN')})</option>
            <option value="Complaints">Complaints ({moduleCounts.Complaints.toLocaleString('en-IN')})</option>
            {isAdmin && <option value="Auth">Login / Logout</option>}
            {isAdmin && <option value="Employees">User Management</option>}
          </Select>

          {isAdmin && (moduleFilter === 'Auth' || moduleFilter === 'Employees') && (
            <Select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionFilter)}
              wrapperClassName="w-full sm:w-auto inline-flex"
              className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
              menuClassName="w-44"
            >
              <option value="all">{moduleFilter === 'Auth' ? 'All activity' : 'All actions'}</option>
              {moduleFilter === 'Auth' ? (
                <>
                  <option value="login">Login</option>
                  <option value="logout">Logout</option>
                </>
              ) : (
                <>
                  <option value="employee_activated">Activated</option>
                  <option value="employee_deactivated">Deactivated</option>
                  <option value="employee_deleted">Deleted</option>
                </>
              )}
            </Select>
          )}

          {isAdmin && moduleFilter === 'Auth' && (
            <Select
              value={authPhone}
              onChange={(e) => setAuthPhone(e.target.value)}
                wrapperClassName="w-full sm:w-auto inline-flex"
                className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
                menuClassName="w-52"
              >
                <option value="">All salespersons</option>
                {authEmployees
                  .filter((emp) => emp.phone && emp.name)
                  .map((emp) => (
                    <option key={emp.phone} value={emp.phone}>
                      {emp.name}
                    </option>
                  ))}
              </Select>
          )}

          {/* 4. Clear Filter Button (4th Position) */}
          {(searchQuery || moduleFilter !== 'All' || datePreset !== 'all' || actionType !== 'all' || authPhone) && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* 5. Refresh Button Right-Aligned */}
        <div className="flex items-center gap-2 ml-auto">
          {isAdmin && moduleFilter === 'Auth' && (
            <button
              type="button"
              onClick={exportAuthCsv}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer"
            >
              Export CSV
            </button>
          )}
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
        <div className="min-h-[calc(100dvh-16rem)] bg-white border border-slate-200 rounded-2xl px-6 shadow-2xs flex flex-col items-center justify-center text-center">
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
              <div className="text-[11px] tracking-[0.25em] text-slate-500 uppercase font-bold pl-8 flex items-center gap-3">
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
                              {sessionExpiredLine(log) || log.description || 'Activity recorded'}
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
                              {String(log.module || '').toLowerCase() === 'auth' && log.action_type === 'login' && (
                                <span className="text-slate-500">
                                  {log.logout_at
                                    ? `${log.logout_status || 'Logout'} · ${formatIstDateTime(log.logout_at).label}`
                                    : 'No logout recorded'}
                                  {log.duration_minutes != null && ` · ${formatSessionDuration(log.duration_minutes)}`}
                                </span>
                              )}

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
