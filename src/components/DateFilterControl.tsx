import { useState } from 'react';
import { Calendar, Check } from 'lucide-react';

export type FilterPreset = '7_days' | '15_days' | 'this_month' | 'custom' | 'monthly';

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
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(
    new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [customTo, setCustomTo] = useState(now.toISOString().split('T')[0]);

  const handleSelectPreset = (newPreset: FilterPreset) => {
    setPreset(newPreset);
    const todayStr = now.toISOString().split('T')[0];

    if (newPreset === '7_days') {
      const fromStr = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      setShowCustom(false);
      onChange({ preset: '7_days', from: fromStr, to: todayStr });
    } else if (newPreset === '15_days') {
      const fromStr = new Date(now.getTime() - 15 * 24 * 3600 * 1000).toISOString().split('T')[0];
      setShowCustom(false);
      onChange({ preset: '15_days', from: fromStr, to: todayStr });
    } else if (newPreset === 'this_month') {
      const fromStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setShowCustom(false);
      onChange({ preset: 'this_month', from: fromStr, to: todayStr });
    } else if (newPreset === 'custom') {
      setShowCustom(true);
      onChange({ preset: 'custom', from: customFrom, to: customTo });
    }
  };

  const handleApplyCustom = () => {
    onChange({ preset: 'custom', from: customFrom, to: customTo });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset Pills */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 shadow-sm text-xs font-medium">
        <button
          type="button"
          onClick={() => handleSelectPreset('7_days')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            preset === '7_days'
              ? 'bg-white text-blue-600 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}>
          Last 7 Days
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreset('15_days')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            preset === '15_days'
              ? 'bg-white text-blue-600 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}>
          Last 15 Days
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreset('this_month')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            preset === 'this_month'
              ? 'bg-white text-blue-600 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}>
          This Month
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreset('custom')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
            preset === 'custom'
              ? 'bg-white text-blue-600 font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}>
          <Calendar size={13} />
          Custom Date
        </button>
      </div>

      {/* Custom Date Pickers */}
      {showCustom && (
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm text-xs">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-slate-400 font-medium">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors flex items-center gap-1">
            <Check size={12} /> Apply
          </button>
        </div>
      )}
    </div>
  );
}
