export function formatIstDateTime(timestampStr?: string | null) {
  if (!timestampStr) return { date: '-', time: '', groupDate: '-', label: '-' };
  const d = new Date(timestampStr);
  if (Number.isNaN(d.getTime())) {
    return { date: timestampStr, time: '', groupDate: timestampStr, label: timestampStr };
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const date = `${get('day')}-${get('month')}-${get('year')}`;
  const time = `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
  return { date, time, groupDate: date.toUpperCase(), label: `${date}, ${time}` };
}

export function formatSessionDuration(minutes?: number | null) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '';
  const mins = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}
