import { formatLocalDate } from './dateUtils';

export interface CustomerVisit {
  id: string;
  customer_name: string;
  person_met?: string | null;
  contact_phone?: string | null;
  contact_no?: string | null;
  location?: string | null;
  customer_address?: string | null;
  outcome?: 'positive' | 'neutral' | 'negative' | string | null;
  remarks?: string | null;
  raw_remarks?: string | null;
  material_requirement?: string | null;
  requirement?: string | null;
  follow_up_action?: string | null;
  follow_up?: string | null;
  followup?: string | null;
  follow_up_date?: string | null;
  follow_up_status?: 'pending' | 'completed' | string | null;
  follow_up_completed_at?: string | null;
  visited_at: string;
  salesperson_phone?: string | null;
  salesperson_name?: string | null;
}

export function getFollowUpStatusInfo(v: CustomerVisit | any): {
  hasFollowUp: boolean;
  action: string;
  dueDateStr: string | null;
  status: 'pending' | 'completed';
  urgency: 'completed' | 'overdue' | 'today' | 'upcoming' | 'no_date';
  diffDays: number | null;
  relativeText: string;
  badgeLabel: string;
  badgeClass: string;
} {
  const rawAction =
    v.follow_up_action ||
    v.followup ||
    v.follow_up ||
    (v.remarks || '').match(/\[(?:Follow-?Up|Follow-?up\s*Action):\s*([^\]]+)\]/i)?.[1] ||
    (v.remarks || '').match(/(?:^|\||\n)\s*Follow-?up(?:\s*Action)?:\s*([^|\]\n]+)/i)?.[1];

  const action = rawAction ? String(rawAction).trim() : '';
  const isNonAction =
    !action ||
    action === '-' ||
    action.toLowerCase() === 'none' ||
    action.toLowerCase() === 'nil' ||
    action.toLowerCase() === 'n/a' ||
    action.toLowerCase().startsWith('no remarks') ||
    action.toLowerCase().startsWith('no follow');

  if (isNonAction) {
    return {
      hasFollowUp: false,
      action: '',
      dueDateStr: null,
      status: 'pending',
      urgency: 'no_date',
      diffDays: null,
      relativeText: '',
      badgeLabel: '',
      badgeClass: '',
    };
  }

  const status: 'pending' | 'completed' =
    v.follow_up_status === 'completed' ? 'completed' : 'pending';

  const dueDate = v.follow_up_date
    ? new Date(v.follow_up_date).toISOString().split('T')[0]
    : null;

  if (status === 'completed') {
    return {
      hasFollowUp: true,
      action,
      dueDateStr: dueDate,
      status: 'completed',
      urgency: 'completed',
      diffDays: null,
      relativeText: 'Done',
      badgeLabel: 'Done',
      badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    };
  }

  if (!dueDate) {
    return {
      hasFollowUp: true,
      action,
      dueDateStr: null,
      status: 'pending',
      urgency: 'no_date',
      diffDays: null,
      relativeText: 'Pending',
      badgeLabel: 'Pending',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    };
  }

  const todayStr = formatLocalDate();
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [dY, dM, dD] = dueDate.split('-').map(Number);
  const todayDate = new Date(Date.UTC(tY, tM - 1, tD));
  const targetDate = new Date(Date.UTC(dY, dM - 1, dD));
  const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  const formattedDate = targetDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const dayLabel = absDays === 1 ? '1 day overdue' : `${absDays} days overdue`;
    return {
      hasFollowUp: true,
      action,
      dueDateStr: dueDate,
      status: 'pending',
      urgency: 'overdue',
      diffDays,
      relativeText: `${dayLabel} (${formattedDate})`,
      badgeLabel: 'Overdue',
      badgeClass: 'bg-rose-100 text-rose-800 border border-rose-200',
    };
  }

  if (diffDays === 0) {
    return {
      hasFollowUp: true,
      action,
      dueDateStr: dueDate,
      status: 'pending',
      urgency: 'today',
      diffDays: 0,
      relativeText: 'Due today',
      badgeLabel: 'Due Today',
      badgeClass: 'bg-amber-100 text-amber-800 border border-amber-200',
    };
  }

  if (diffDays === 1) {
    return {
      hasFollowUp: true,
      action,
      dueDateStr: dueDate,
      status: 'pending',
      urgency: 'upcoming',
      diffDays: 1,
      relativeText: `Due tomorrow (${formattedDate})`,
      badgeLabel: 'Tomorrow',
      badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
    };
  }

  return {
    hasFollowUp: true,
    action,
    dueDateStr: dueDate,
    status: 'pending',
    urgency: 'upcoming',
    diffDays,
    relativeText: `In ${diffDays} days (${formattedDate})`,
    badgeLabel: `In ${diffDays}d`,
    badgeClass: 'bg-blue-100 text-blue-800 border border-blue-200',
  };
}
