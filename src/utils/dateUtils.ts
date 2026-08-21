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
