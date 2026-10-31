import { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { INDIAN_GST_STATES, resolveCustomerState } from '../utils/pricingEngine';
import { Select } from './ui/select';

export function isCustomerInAssignedList(inputName: string, assignedList: string[]): boolean {
  if (!inputName || !inputName.trim()) return false;
  const cleanInput = inputName.trim().toLowerCase();
  if (assignedList.some(c => c.trim().toLowerCase() === cleanInput)) return true;

  const stripSuffixes = (str: string) =>
    str
      .toLowerCase()
      .replace(/\b(private\s+limited|pvt\s+ltd|pvt\s+limited|private\s+ltd|co\s+ltd|llp|limited|pvt|ltd|inc|corp)\b/gi, '')
      .replace(/[^a-z0-9]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const strippedInput = stripSuffixes(cleanInput);
  if (!strippedInput) return false;

  return assignedList.some(c => {
    const strippedC = stripSuffixes(c);
    return Boolean(
      strippedC &&
      (strippedC === strippedInput || strippedInput.startsWith(strippedC) || strippedC.startsWith(strippedInput)),
    );
  });
}

export type AddCustomerSeed = {
  companyName: string;
  contactPerson: string;
  mobile: string;
  deliveryLocation: string;
  gstin: string;
  email?: string;
  industry?: string;
};

type AddAssignedCustomerDialogProps = {
  open: boolean;
  seed: AddCustomerSeed;
  assignPhone: string;
  onClose: () => void;
  onSaved: (saved: {
    companyName: string;
    mobile: string;
    deliveryLocation: string;
    customerState?: string;
    gstin?: string;
    email?: string;
    industry?: string;
  }) => void;
};

export default function AddAssignedCustomerDialog({
  open,
  seed,
  assignPhone,
  onClose,
  onSaved,
}: AddAssignedCustomerDialogProps) {
  const { guardAction, isAdmin } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [gstin, setGstin] = useState('');
  const [email, setEmail] = useState('');
  const [industry, setIndustry] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [stateManuallyEdited, setStateManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [similarityAlert, setSimilarityAlert] = useState<{
    message: string;
    existingName?: string;
    repName?: string;
    repPhone?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyName(seed.companyName || '');
    setContactPerson(seed.contactPerson || '');
    setMobile(seed.mobile || '');
    setDeliveryLocation(seed.deliveryLocation || '');
    setGstin(seed.gstin || '');
    setEmail(seed.email || '');
    setIndustry(seed.industry || '');
    setSimilarityAlert(null);
    const initialState = resolveCustomerState({
      gstin: seed.gstin,
      address: seed.deliveryLocation,
    });
    setCustomerState(initialState?.label || '');
    setStateManuallyEdited(false);
    // Seed is copied only when the dialog opens so typing is not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || stateManuallyEdited) return;
    const derived = resolveCustomerState({
      gstin,
      address: deliveryLocation,
    });
    if (derived) {
      setCustomerState(derived.label);
    }
  }, [gstin, deliveryLocation, open, stateManuallyEdited]);

  if (!open) return null;

  const phoneDigits = mobile.replace(/\D/g, '');
  const canSave = Boolean(
    companyName.trim() &&
    contactPerson.trim() &&
    phoneDigits.length >= 10 &&
    deliveryLocation.trim(),
  );

  const handleSave = async (allowSimilar = false) => {
    if (!guardAction('customers.create')) return;
    const name = companyName.trim();
    const contact = contactPerson.trim();
    const phone = mobile.replace(/\D/g, '').slice(-10);
    const delivery = deliveryLocation.trim();
    if (!name || !contact || phone.length < 10 || !delivery) {
      toast.error('Company name, contact person, mobile number, and delivery location are required');
      return;
    }
    if (!assignPhone) {
      toast.error('Could not determine which salesperson should own this customer');
      return;
    }
    const resolvedState =
      customerState.trim() ||
      resolveCustomerState({ gstin: gstin.trim(), address: delivery })?.label ||
      '';
    setSaving(true);
    try {
      await customersApi.createCustomer({
        customer_name: name,
        contact_person: contact,
        customer_phone: phone,
        customer_address: delivery,
        customer_gst: gstin.trim() || null,
        customer_email: email.trim() || null,
        customer_state: resolvedState || null,
        industry: industry.trim() || null,
        assigned_salesperson_phone: assignPhone,
        allow_similar: allowSimilar || undefined,
      });
      toast.success('Customer added to your list');
      setSimilarityAlert(null);
      onSaved({
        companyName: name,
        mobile: phone,
        deliveryLocation: delivery,
        customerState: resolvedState || undefined,
        gstin: gstin.trim() || undefined,
        email: email.trim() || undefined,
        industry: industry.trim() || undefined,
      });
    } catch (err: any) {
      const data = err?.response?.data;
      const isSimilar =
        data?.conflictType === 'similar' ||
        /Kindly contact your admin/i.test(data?.error || data?.message || '');

      if (isSimilar) {
        const msg =
          data?.error ||
          data?.message ||
          `"${data?.existingName || 'Another customer'}" is already assigned for other customer and still do you want to add customer "${name}"? Kindly contact your admin for adding only this customer.`;
        setSimilarityAlert({
          message: msg,
          existingName: data?.existingName,
          repName: data?.repName,
          repPhone: data?.repPhone,
        });
        return;
      }

      const errorText =
        (typeof data?.error === 'string' ? data.error : null) ||
        (typeof data?.message === 'string' ? data.message : null) ||
        (Array.isArray(data?.message) ? data.message.join(', ') : null) ||
        err?.message ||
        'Could not add customer. Please verify details.';
      toast.error(errorText, { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mobile-sheet-overlay fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4">
      <div className="mobile-sheet bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 p-5 space-y-3 overflow-y-auto">
        <div className="sheet-header flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Add this customer</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          Company name
          <input
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Contact person <span className="text-red-500 font-bold">*</span>
          <input
            value={contactPerson}
            onChange={e => setContactPerson(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Mobile number <span className="text-red-500 font-bold">*</span>
          <input
            type="tel"
            inputMode="numeric"
            value={mobile}
            onChange={e => setMobile(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Delivery location <span className="text-red-500 font-bold">*</span>
          <input
            value={deliveryLocation}
            onChange={e => setDeliveryLocation(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="block text-xs font-semibold text-slate-700">
            Industry <span className="text-slate-400 font-normal">(optional)</span>
            <input
              list="assigned-dialog-industry-options"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. Boilers, Storage Racks"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="assigned-dialog-industry-options">
              <option value="Boilers" />
              <option value="Storage Racks" />
              <option value="Automobile" />
              <option value="Fabricator" />
              <option value="OEM" />
              <option value="PEB / Structure" />
              <option value="Tubes & Pipes" />
            </datalist>
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Email <span className="text-slate-400 font-normal">(optional)</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="block text-xs font-semibold text-slate-700">
            GSTIN
            <input
              value={gstin}
              onChange={e => setGstin(e.target.value)}
              placeholder="e.g. 27AAICE..."
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="block text-xs font-semibold text-slate-700">
            <span className="block mb-1">State (GST)</span>
            <Select
              value={customerState}
              onChange={e => {
                setCustomerState(e.target.value);
                setStateManuallyEdited(true);
              }}
              className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white hover:border-blue-400"
              placeholder="Auto-detect"
            >
              <option value="">Auto-detect</option>
              {INDIAN_GST_STATES.map(st => (
                <option key={st.code} value={st.label}>
                  {st.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={() => handleSave(false)}
            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg disabled:opacity-50">
            {saving ? 'Saving...' : 'Save customer'}
          </button>
        </div>
      </div>

      {similarityAlert && (
        <div className="fixed inset-0 z-[95] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <AlertCircle size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Similar Customer Already Assigned
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {similarityAlert.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSimilarityAlert(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Understood
              </button>
              {isAdmin && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSave(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
                >
                  {saving ? 'Adding...' : 'Add as Admin Anyway'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
