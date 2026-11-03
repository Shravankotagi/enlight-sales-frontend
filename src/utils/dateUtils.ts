/**
 * Standardized Date Utilities for Enlight Sales OS.
 * Guarantees consistent YYYY-MM-DD formatting in local time without UTC offset date shifts.
 */

export function formatLocalDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalTime(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getFirstDayOfWeek(d: Date = new Date()): string {
  const target = new Date(d);
  const day = target.getDay();
  const diff = target.getDate() - day + (day === 0 ? -6 : 1); // Monday
  target.setDate(diff);
  return formatLocalDate(target);
}

export function getLastDayOfWeek(d: Date = new Date()): string {
  const target = new Date(d);
  const day = target.getDay();
  const diff = target.getDate() - day + (day === 0 ? 0 : 7); // Sunday
  target.setDate(diff);
  return formatLocalDate(target);
}

export function getFirstDayOfPreviousWeek(d: Date = new Date()): string {
  const target = new Date(d);
  target.setDate(target.getDate() - 7);
  return getFirstDayOfWeek(target);
}

export function getLastDayOfPreviousWeek(d: Date = new Date()): string {
  const currentWeekStart = new Date(getFirstDayOfWeek(d) + 'T00:00:00');
  currentWeekStart.setDate(currentWeekStart.getDate() - 1);
  return formatLocalDate(currentWeekStart);
}

export function getFirstDayOfMonth(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function getLastDayOfMonth(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

export function getFirstDayOfPreviousMonth(d: Date = new Date()): string {
  return formatLocalDate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

export function getLastDayOfPreviousMonth(d: Date = new Date()): string {
  return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 0));
}

export function getFirstDayOfQuarter(d: Date = new Date()): string {
  const year = d.getFullYear();
  const quarterMonth = Math.floor(d.getMonth() / 3) * 3;
  const month = String(quarterMonth + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function getLastDayOfQuarter(d: Date = new Date()): string {
  const year = d.getFullYear();
  const quarterEndMonth = Math.floor(d.getMonth() / 3) * 3 + 2;
  const lastDay = new Date(year, quarterEndMonth + 1, 0).getDate();
  const month = String(quarterEndMonth + 1).padStart(2, '0');
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

export function getFirstDayOfYear(d: Date = new Date()): string {
  return `${d.getFullYear()}-01-01`;
}

export function getLastDayOfYear(d: Date = new Date()): string {
  return `${d.getFullYear()}-12-31`;
}

export function getFirstDayOfPreviousYear(d: Date = new Date()): string {
  return `${d.getFullYear() - 1}-01-01`;
}

export function getLastDayOfPreviousYear(d: Date = new Date()): string {
  return `${d.getFullYear() - 1}-12-31`;
}

export function getDaysAgo(days: number, fromDate: Date = new Date()): string {
  const target = new Date(fromDate.getTime() - days * 24 * 60 * 60 * 1000);
  return formatLocalDate(target);
}

export function getIsoStartOfDay(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return dateStr;
  return `${dateStr}T00:00:00.000Z`;
}

export function getIsoEndOfDay(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.includes('T')) return dateStr;
  return `${dateStr}T23:59:59.999Z`;
}

export interface PersistedDateFilter {
  preset: string;
  from?: string;
  to?: string;
  customFrom?: string;
  customTo?: string;
  showCustom?: boolean;
}

export function getPersistedDateFilter(moduleKey: string, defaultPreset: string = '7_days'): PersistedDateFilter {
  const today = formatLocalDate();
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage?.getItem(`enlight_filter_${moduleKey}`) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.preset === 'string') {
        const p = parsed.preset;
        if (p === 'today') {
          return { ...parsed, from: today, to: today };
        }
        if (p === '7_days') {
          return { ...parsed, from: getDaysAgo(7), to: today };
        }
        if (p === '30_days') {
          return { ...parsed, from: getDaysAgo(30), to: today };
        }
        if (p === '90_days') {
          return { ...parsed, from: getDaysAgo(90), to: today };
        }
        if (p === 'all') {
          return { ...parsed, from: undefined, to: undefined };
        }
        if (p === 'this_week') {
          return { ...parsed, from: getFirstDayOfWeek(), to: today };
        }
        if (p === 'previous_week') {
          return { ...parsed, from: getFirstDayOfPreviousWeek(), to: getLastDayOfPreviousWeek() };
        }
        if (p === 'this_month') {
          return { ...parsed, from: getFirstDayOfMonth(), to: today };
        }
        if (p === 'previous_month') {
          return { ...parsed, from: getFirstDayOfPreviousMonth(), to: getLastDayOfPreviousMonth() };
        }
        if (p === 'this_year') {
          return { ...parsed, from: getFirstDayOfYear(), to: today };
        }
        if (p === 'previous_year') {
          return { ...parsed, from: getFirstDayOfPreviousYear(), to: getLastDayOfPreviousYear() };
        }
        if (p === 'custom') {
          const cFrom = parsed.customFrom || parsed.from;
          const cTo = parsed.customTo || parsed.to || cFrom;
          return {
            ...parsed,
            from: cFrom,
            to: cTo,
            customFrom: cFrom,
            customTo: cTo,
            showCustom: true,
          };
        }
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse issues
  }

  if (defaultPreset === 'today') {
    return { preset: 'today', from: today, to: today };
  }
  if (defaultPreset === '30_days') {
    return { preset: '30_days', from: getDaysAgo(30), to: today };
  }
  if (defaultPreset === 'all') {
    return { preset: 'all', from: undefined, to: undefined };
  }
  return { preset: '7_days', from: getDaysAgo(7), to: today };
}

export function setPersistedDateFilter(moduleKey: string, filter: PersistedDateFilter): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(`enlight_filter_${moduleKey}`, JSON.stringify(filter));
    }
  } catch {
    // Ignore storage issues
  }
}

export function clearPersistedDateFilter(moduleKey: string): void {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(`enlight_filter_${moduleKey}`);
    }
  } catch {
    // Ignore storage issues
  }
}
