import { useState, useEffect } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import {
  formatLocalDate,
  getFirstDayOfWeek,
  getLastDayOfWeek,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getFirstDayOfQuarter,
  getLastDayOfQuarter,
  getFirstDayOfYear,
  getLastDayOfYear,
  getDaysAgo,
} from '../utils/dateUtils';

export type FilterPreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom'
  | '7_days'
  | '14_days'
  | '30_days'
  | '90_days'
  | 'monthly';

export type DateFilterRange = {
  preset: FilterPreset;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  month?: number; // 0-11
  year?: number;
};

interface DateFilterControlProps {
  onChange: (range: DateFilterRange) => void;
  initialPreset?: FilterPreset;
  value?: DateFilterRange;
  resetKey?: number | string;
}

export default function DateFilterControl({ onChange, initialPreset = 'this_month', value, resetKey }: DateFilterControlProps) {
  const [preset, setPreset] = useState<FilterPreset>(value?.preset || initialPreset);
  const [showCustom, setShowCustom] = useState((value?.preset || initialPreset) === 'custom');
  const todayStr = formatLocalDate();

  const [customFrom, setCustomFrom] = useState(value?.from || getDaysAgo(7));
  const [customTo, setCustomTo] = useState(value?.to || todayStr);

  useEffect(() => {
    if (resetKey !== undefined) {
      setPreset(initialPreset);
      setShowCustom(initialPreset === 'custom');
      setCustomFrom(getDaysAgo(7));
      setCustomTo(todayStr);
    }
  }, [resetKey, initialPreset, todayStr]);

  useEffect(() => {
    if (value && value.preset !== preset) {
      setPreset(value.preset);
      setShowCustom(value.preset === 'custom');
      if (value.from) setCustomFrom(value.from);
      if (value.to) setCustomTo(value.to);
    }
  }, [value]);

  const handleSelectPreset = (newPreset: FilterPreset) => {
    setPreset(newPreset);

    if (newPreset === 'today') {
      setShowCustom(false);
      onChange({ preset: 'today', from: todayStr, to: todayStr });
    } else if (newPreset === '7_days') {
      const fromStr = getDaysAgo(7);
      setShowCustom(false);
      onChange({ preset: '7_days', from: fromStr, to: todayStr });
    } else if (newPreset === '14_days') {
      const fromStr = getDaysAgo(14);
      setShowCustom(false);
      onChange({ preset: '14_days', from: fromStr, to: todayStr });
    } else if (newPreset === '30_days') {
      const fromStr = getDaysAgo(30);
      setShowCustom(false);
      onChange({ preset: '30_days', from: fromStr, to: todayStr });
    } else if (newPreset === '90_days') {
      const fromStr = getDaysAgo(90);
      setShowCustom(false);
      onChange({ preset: '90_days', from: fromStr, to: todayStr });
    } else if (newPreset === 'this_week') {
      const fromStr = getFirstDayOfWeek();
      const toStr = getLastDayOfWeek();
      setShowCustom(false);
      onChange({ preset: 'this_week', from: fromStr, to: toStr });
    } else if (newPreset === 'this_month') {
      const fromStr = getFirstDayOfMonth();
      const toStr = getLastDayOfMonth();
      setShowCustom(false);
      onChange({ preset: 'this_month', from: fromStr, to: toStr });
    } else if (newPreset === 'this_quarter') {
      const fromStr = getFirstDayOfQuarter();
      const toStr = getLastDayOfQuarter();
      setShowCustom(false);
      onChange({ preset: 'this_quarter', from: fromStr, to: toStr });
    } else if (newPreset === 'this_year') {
      const fromStr = getFirstDayOfYear();
      const toStr = getLastDayOfYear();
      setShowCustom(false);
      onChange({ preset: 'this_year', from: fromStr, to: toStr });
    } else if (newPreset === 'custom') {
      setShowCustom(true);
      onChange({ preset: 'custom', from: customFrom, to: customTo });
    }
  };

  const handleCustomFromChange = (newFrom: string) => {
    setCustomFrom(newFrom);
    if (newFrom && customTo) {
      onChange({ preset: 'custom', from: newFrom, to: customTo });
    }
  };

  const handleCustomToChange = (newTo: string) => {
    setCustomTo(newTo);
    if (customFrom && newTo) {
      onChange({ preset: 'custom', from: customFrom, to: newTo });
    }
  };

  const handleApplyCustom = () => {
    onChange({ preset: 'custom', from: customFrom, to: customTo });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dropdown Select Menu */}
      <div className="relative inline-flex items-center">
        <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
        <select
          value={preset}
          onChange={(e) => handleSelectPreset(e.target.value as FilterPreset)}
          className="pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs appearance-none cursor-pointer transition-all"
        >
          <option value="today">Today</option>
          <option value="7_days">Last 7 Days</option>
          <option value="30_days">Last 30 Days</option>
          <option value="this_month">This Month</option>
          <option value="90_days">Last 90 Days</option>
          <option value="this_quarter">This Quarter</option>
          <option value="this_year">This Year</option>
          <option value="custom">Custom Range</option>
        </select>
        <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
      </div>

      {/* Custom Date Range Pickers */}
      {showCustom && (
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm text-xs animate-in fade-in slide-in-from-left-2 duration-150">
          <input
            type="date"
            value={customFrom}
            onChange={e => handleCustomFromChange(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <span className="text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => handleCustomToChange(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors flex items-center gap-1 shadow-2xs">
            <Check size={12} /> Apply
          </button>
        </div>
      )}
    </div>
  );
}
