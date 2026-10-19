interface VisitLocationFieldProps {
  value: string;
  source: '' | 'gps' | 'manual';
  cityLocked?: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  notice: string;
  locating: boolean;
  error?: string | boolean;
  onRetry: () => void;
  onManualChange: (value: string) => void;
}

export default function VisitLocationField({
  value,
  source,
  cityLocked,
  latitude,
  longitude,
  accuracy,
  notice,
  locating,
  error,
  onRetry,
  onManualChange,
}: VisitLocationFieldProps) {
  const locked = cityLocked ?? source === 'gps';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block font-semibold text-slate-700">
          City / Location <span className="text-rose-500">*</span>
        </label>
        <button
          type="button"
          onClick={onRetry}
          disabled={locating}
          className="text-[11px] font-bold text-blue-700 hover:text-blue-800 disabled:opacity-60 cursor-pointer"
        >
          {locating ? 'Reading location...' : 'Retry'}
        </button>
      </div>
      <textarea
        rows={2}
        readOnly={locked}
        aria-readonly={locked}
        placeholder={locked ? 'Reading location...' : 'Enter the city'}
        value={value}
        onChange={(event) => {
          if (!locked) onManualChange(event.target.value);
        }}
        className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all resize-none ${
          error
            ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
            : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
        } ${locked ? 'bg-slate-50 text-slate-700' : ''}`}
      />
      {latitude != null && longitude != null && (
        <p className="mt-1 text-[11px] font-mono text-slate-500">
          Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}
          {accuracy != null ? ` · ±${accuracy} m` : ''}
        </p>
      )}
      {notice && (
        <p className="mt-1 text-[11px] font-semibold text-amber-700">{notice}</p>
      )}
      {error && (
        <p className="text-[11px] text-rose-500 font-semibold mt-1">
          {typeof error === 'string' ? error : 'Please enter location.'}
        </p>
      )}
    </div>
  );
}
