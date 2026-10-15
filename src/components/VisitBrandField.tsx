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
  return (
    <div>
      <label className="block font-semibold text-slate-700 mb-1">
        Preferred Brand / Make <span className="text-rose-500">*</span>
      </label>
      <div
        className={`w-full px-3 py-2 border rounded-xl text-xs bg-white space-y-1 ${
          error ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
        }`}
      >
        {VISIT_BRANDS.map((brand) => (
          <label key={brand} className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(brand)}
              onChange={() => onToggle(brand)}
            />
            {brand}
          </label>
        ))}
      </div>
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
