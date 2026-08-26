import { useState, useEffect } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import {
  formatLocalDate,
  getDaysAgo,
} from '../utils/dateUtils';

export type FilterPreset =
  | 'today'
  | '7_days'
  | '30_days'
  | '90_days'
  | 'custom'
  | 'this_month'
  | 'this_quarter'
  | 'this_year'
  | 'this_week'
  | '14_days'
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

export default function DateFilterControl({ onChange, initialPreset = '30_days', value, resetKey }: DateFilterControlProps) {
  const effectivePreset = (initialPreset === 'this_month' || initialPreset === 'this_quarter' || initialPreset === 'this_year') ? '30_days' : initialPreset;
  const [preset, setPreset] = useState<FilterPreset>(value?.preset || effectivePreset);
  const [showCustom, setShowCustom] = useState((value?.preset || effectivePreset) === 'custom');
  const todayStr = formatLocalDate();

  const [customFrom, setCustomFrom] = useState(value?.from || getDaysAgo(30));
  const [customTo, setCustomTo] = useState(value?.to || todayStr);

  useEffect(() => {
    if (resetKey !== undefined) {
      setPreset(effectivePreset);
      setShowCustom(effectivePreset === 'custom');
      setCustomFrom(getDaysAgo(30));
      setCustomTo(todayStr);
    }
  }, [resetKey, effectivePreset, todayStr]);

  useEffect(() => {
    if (value && value.preset !== preset) {
      const p = (value.preset === 'this_month' || value.preset === 'this_quarter' || value.preset === 'this_year') ? '30_days' : value.preset;
      setPreset(p);
      setShowCustom(p === 'custom');
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
    } else if (newPreset === '30_days') {
      const fromStr = getDaysAgo(30);
      setShowCustom(false);
      onChange({ preset: '30_days', from: fromStr, to: todayStr });
    } else if (newPreset === '90_days') {
      const fromStr = getDaysAgo(90);
      setShowCustom(false);
      onChange({ preset: '90_days', from: fromStr, to: todayStr });
    } else if (newPreset === 'custom') {
      setShowCustom(true);
      onChange({ preset: 'custom', from: customFrom, to: customTo });
    }
  };

  const handleCustomFromChange = (newFrom: string) => {
    setCustomFrom(newFrom);
    let effectiveTo = customTo;
    if (newFrom && customTo && newFrom > customTo) {
      effectiveTo = newFrom;
      setCustomTo(newFrom);
    }
    if (newFrom && effectiveTo) {
      onChange({ preset: 'custom', from: newFrom, to: effectiveTo });
    }
  };

  const handleCustomToChange = (newTo: string) => {
    let effectiveTo = newTo;
    if (newTo && customFrom && newTo < customFrom) {
      effectiveTo = customFrom;
    }
    setCustomTo(effectiveTo);
    if (customFrom && effectiveTo) {
      onChange({ preset: 'custom', from: customFrom, to: effectiveTo });
    }
  };

  const handleApplyCustom = () => {
    let effectiveTo = customTo;
    if (customFrom && customTo && customTo < customFrom) {
      effectiveTo = customFrom;
      setCustomTo(customFrom);
    }
    onChange({ preset: 'custom', from: customFrom, to: effectiveTo });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Dropdown Select Menu */}
      <div className="relative inline-flex items-center">
        <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
        <select
          value={preset === 'this_month' || preset === 'this_quarter' || preset === 'this_year' ? '30_days' : preset}
          onChange={(e) => handleSelectPreset(e.target.value as FilterPreset)}
          className="pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs appearance-none cursor-pointer transition-all"
        >
          <option value="today" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Today</option>
          <option value="7_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 7 Days</option>
          <option value="30_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 30 Days</option>
          <option value="90_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 90 Days</option>
          <option value="custom" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Custom Range</option>
        </select>
        <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
      </div>

      {/* Custom Date Range Pickers */}
      {showCustom && (
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm text-xs animate-in fade-in slide-in-from-left-2 duration-150">
          <input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={e => handleCustomFromChange(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
          <span className="text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
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
