import { VISIT_CUSTOMER_TYPES } from '../utils/visitForm';

interface VisitCustomerTypeFieldProps {
  value: string;
  other: string;
  error?: string | boolean;
  otherError?: string | boolean;
  required?: boolean;
  onChange: (value: string) => void;
  onOtherChange: (value: string) => void;
}

export default function VisitCustomerTypeField({
  value,
  other,
  error,
  otherError,
  required = false,
  onChange,
  onOtherChange,
}: VisitCustomerTypeFieldProps) {
  return (
    <div>
      <label className="block font-semibold text-slate-700 mb-1">
        Customer Type {required && <span className="text-rose-500">*</span>}
      </label>
      <select
        aria-label="Customer Type"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium ${
          error ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
        }`}
      >
        <option value="" disabled hidden>Select Customer Type</option>
        {VISIT_CUSTOMER_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      {value === 'Other' && (
        <input
          type="text"
          aria-label="Other customer type"
          placeholder="Enter the other customer type"
          value={other}
          onChange={(event) => onOtherChange(event.target.value)}
          className={`mt-2 w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 ${
            otherError ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
          }`}
        />
      )}
      {error && (
        <p className="text-[11px] text-rose-500 font-semibold mt-1">
          {typeof error === 'string' ? error : 'Select a customer type.'}
        </p>
      )}
      {otherError && (
        <p className="text-[11px] text-rose-500 font-semibold mt-1">
          {typeof otherError === 'string' ? otherError : 'Enter the other customer type.'}
        </p>
      )}
    </div>
  );
}
