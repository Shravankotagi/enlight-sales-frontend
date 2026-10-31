import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export type NewCustomerSeed = {
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  deliveryLocation?: string;
  email?: string;
  gstNumber?: string;
  industry?: string;
  region?: string;
};

interface NewCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (createdCustomer: any) => void;
  seed?: NewCustomerSeed;
  assignedSalespersonPhone?: string;
}

export default function NewCustomerModal({
  open,
  onClose,
  onSuccess,
  seed,
  assignedSalespersonPhone,
}: NewCustomerModalProps) {
  const { isAdmin } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [saving, setSaving] = useState(false);
  const [similarityAlert, setSimilarityAlert] = useState<{
    message: string;
    existingName?: string;
    repName?: string;
    repPhone?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setCompanyName(seed?.companyName || '');
    setContactPerson(seed?.contactPerson || '');
    setMobileNumber(seed?.mobile || '');
    setDeliveryLocation(seed?.deliveryLocation || '');
    setEmail(seed?.email || '');
    setGstNumber(seed?.gstNumber || '');
    setIndustry(seed?.industry || '');
    setRegion(seed?.region || '');
    setSimilarityAlert(null);
  }, [open, seed]);

  if (!open) return null;

  const phoneDigits = mobileNumber.replace(/\D/g, '');
  const canSave = Boolean(
    companyName.trim() &&
    contactPerson.trim() &&
    phoneDigits.length >= 10 &&
    deliveryLocation.trim() &&
    !saving,
  );

  const handleSave = async (e?: React.FormEvent, allowSimilar = false) => {
    if (e) e.preventDefault();

    const name = companyName.trim();
    const contact = contactPerson.trim();
    const phone = phoneDigits.slice(-10);
    const location = deliveryLocation.trim();
    const emailVal = email.trim();
    const gstVal = gstNumber.trim().toUpperCase();

    if (!name) {
      toast.error('Company Name is required');
      return;
    }
    if (!contact) {
      toast.error('Contact Person is required');
      return;
    }
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!location) {
      toast.error('Delivery Location is required');
      return;
    }
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (gstVal && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstVal)) {
      toast.error('GST Number should be 15 characters (e.g. 29ABCDE1234F1Z5)');
      return;
    }

    setSaving(true);
    try {
      const res = await customersApi.createCustomer({
        customer_name: name,
        contact_person: contact,
        customer_phone: phone,
        customer_address: location,
        customer_email: emailVal || undefined,
        customer_gst: gstVal || undefined,
        industry: industry.trim() || undefined,
        region: region.trim() || undefined,
        assigned_salesperson_phone: assignedSalespersonPhone || undefined,
        allow_similar: allowSimilar || undefined,
      });

      const created = res.data?.data || res.data || {};
      toast.success('Customer added successfully');
      setSimilarityAlert(null);
      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
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
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <h2 className="text-lg font-bold text-slate-900">New Customer</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Col 1, Row 1: Company Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Company Name <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. PQR Steel Industries"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Col 2, Row 1: Contact Person */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Contact Person <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Ravi Kumar"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Col 1, Row 2: Mobile Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Mobile Number <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                required
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Col 2, Row 2: Delivery Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Delivery Location <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="e.g. Chakan, Pune"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Col 1, Row 3: Industry (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Industry <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                list="new-cust-modal-industry-options"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Boilers, Storage Racks, Automobile"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
              <datalist id="new-cust-modal-industry-options">
                <option value="Boilers" />
                <option value="Storage Racks" />
                <option value="Automobile" />
                <option value="Fabricator" />
                <option value="OEM" />
                <option value="PEB / Structure" />
                <option value="Tubes & Pipes" />
              </datalist>
            </div>

            {/* Col 2, Row 3: Region / State (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Region / State <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Pune, Gujarat, Karnataka"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Col 1, Row 4: Email (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Email <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>

            {/* Col 2, Row 4: GST Number (optional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                GST Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="29ABCDE1234F1Z5"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/15 transition-all"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      </div>

      {similarityAlert && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
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
                  onClick={() => handleSave(undefined, true)}
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
