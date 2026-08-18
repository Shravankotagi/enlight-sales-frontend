import { useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';

export type FilterPreset = '7_days' | '14_days' | 'this_month' | 'custom' | 'monthly';

export type DateFilterRange = {
  preset: FilterPreset;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  month?: number; // 0-11
  year?: number;
};

interface DateFilterControlProps {
  onChange: (range: DateFilterRange) => void;
  initialPreset?: FilterPreset;
}

export default function DateFilterControl({ onChange, initialPreset = 'this_month' }: DateFilterControlProps) {
  const now = new Date();
  const [preset, setPreset] = useState<FilterPreset>(initialPreset);
  const [showCustom, setShowCustom] = useState(initialPreset === 'custom');

  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [customFrom, setCustomFrom] = useState(
    new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [customTo, setCustomTo] = useState(todayStr);

  const handleSelectPreset = (newPreset: FilterPreset) => {
    setPreset(newPreset);

    if (newPreset === '7_days') {
      const fromStr = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      setShowCustom(false);
      onChange({ preset: '7_days', from: fromStr, to: todayStr });
    } else if (newPreset === '14_days') {
      const fromStr = new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0];
      setShowCustom(false);
      onChange({ preset: '14_days', from: fromStr, to: todayStr });
    } else if (newPreset === 'this_month') {
      setShowCustom(false);
      onChange({ preset: 'this_month', from: firstDayOfMonth, to: lastDayOfMonth });
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
          <option value="this_month">This Month</option>
          <option value="7_days">Last 7 Days</option>
          <option value="14_days">Last 15 Days</option>
          <option value="custom">Custom Date Range</option>
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
