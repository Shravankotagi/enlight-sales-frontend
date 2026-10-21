import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { VISIT_BRANDS } from '../utils/visitForm';

interface VisitBrandFieldProps {
  selected: string[];
  other: string;
  error?: string | boolean;
  otherError?: string | boolean;
  onToggle: (brand: string) => void;
  onOtherChange: (value: string) => void;
}

export default function VisitBrandField({
  selected,
  other,
  error,
  otherError,
  onToggle,
  onOtherChange,
}: VisitBrandFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <label className="block font-semibold text-slate-700 mb-1">
        Preferred Brand / Make <span className="text-rose-500">*</span>
      </label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs outline-none ${
          error
            ? 'border-rose-500 bg-rose-50/30'
            : 'border-slate-300 bg-white'
        } ${selected.length > 0 ? 'font-medium text-slate-800' : 'text-slate-400'}`}
      >
        <span className="truncate">
          {selected.length > 0 ? selected.join(', ') : 'Select brands'}
        </span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          {VISIT_BRANDS.map((brand) => (
            <label key={brand} className="flex cursor-pointer items-center gap-2 font-medium text-slate-700">
              <input
                type="checkbox"
                checked={selected.includes(brand)}
                onChange={() => onToggle(brand)}
              />
              {brand}
            </label>
          ))}
        </div>
      )}
      {error && (
        <p className="text-[11px] text-rose-500 font-semibold mt-1">
          {typeof error === 'string' ? error : 'Select a preferred brand.'}
        </p>
      )}
      {selected.includes('Others') && (
        <div className="mt-2">
          <input
            type="text"
            aria-label="Other brand"
            placeholder="Enter the other brand"
            value={other}
            onChange={(event) => onOtherChange(event.target.value)}
            className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 ${
              otherError ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
            }`}
          />
          {otherError && (
            <p className="text-[11px] text-rose-500 font-semibold mt-1">
              {typeof otherError === 'string' ? otherError : 'Enter the other brand.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
