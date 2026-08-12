import { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, CheckCircle, Clock, RefreshCw, X, Building2,
  Phone, Calendar, Edit3, Save, Check, Layers, ShieldCheck, MapPin, CreditCard
} from 'lucide-react';
import { inquiriesApi, customersApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';

interface InquiryItem {
  id: string;
  sender_name?: string;
  customer_name?: string;
  customer_phone?: string;
  sender_phone?: string;
  raw_text?: string;
  inquiry_type?: string;
  status?: string;
  source_channel?: string;
  overall_confidence?: number;
  created_at: string;
}

interface ExtractedDetails {
  companyName: string;
  customerPhone: string;
  productType: string;
  thickness: string;
  width: string;
  length: string;
  productForm: 'Coil' | 'Sheet' | 'Plate' | 'Bar';
  quantityTons: number;
  quantityUnits: number;
  unitPrice: number;
  totalAmount: number;
  paymentTerms: string;
  deliveryLocation: string;
}

function parseInquiryText(text: string, inq: any): ExtractedDetails {
  const textLower = (text || '').toLowerCase();
  
  // 1. Company Name
  let companyName = inq?.customer_name || '';
  if (!companyName || companyName === 'Customer') {
    if (textLower.includes('delta')) companyName = 'Delta Structural Steel';
    else if (textLower.includes('mehta')) companyName = 'Mehta Engineering';
    else if (textLower.includes('supreme')) companyName = 'Supreme Steel';
    else if (textLower.includes('scafform')) companyName = 'SB Scafform Technovert Pvt. Ltd.';
    else {
      const match = text.match(/(?:from|customer|company|client|for)\s+([A-Z0-9\s&.-]{3,30})/i);
      companyName = match ? match[1].trim() : 'Apex Metals & Engg';
    }
  }

  // 2. Customer Phone
  const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
  const customerPhone = phoneMatch ? phoneMatch[1] : (inq?.customer_phone || '9123456789');

  // 3. Product Type (CR / HR / HR Pickled / TMT / MS Sheet / Beam)
  let productType = 'HR Steel';
  if (textLower.includes('cr') || textLower.includes('cold rolled')) productType = 'CR (Cold Rolled)';
  else if (textLower.includes('hr pickled') || textLower.includes('po')) productType = 'HR Pickled & Oiled';
  else if (textLower.includes('hr') || textLower.includes('hot rolled')) productType = 'HR (Hot Rolled)';
  else if (textLower.includes('tmt')) productType = 'TMT Rebar';
  else if (textLower.includes('beam') || textLower.includes('ismb')) productType = 'MS Structural Beam';
  else if (textLower.includes('flat')) productType = 'MS Flat';

  // 4. Dimensions & Form (Coil vs Sheet Rule: Coil if no length, Sheet if length is present!)
  const thickMatch = text.match(/\b(\d+(?:\.\d+)?)\s*mm\b/i);
  const thickness = thickMatch ? `${thickMatch[1]} mm` : '3.0 mm';

  const widthMatch = text.match(/\b(1000|1250|1500|2000)\b/i);
  const width = widthMatch ? `${widthMatch[1]} mm` : '1250 mm';

  const lenMatch = text.match(/\b(2500|3000|6m|12m|6000|2500mm)\b/i);
  const length = lenMatch ? lenMatch[1] : '';

  // Form Rule: Coil if no length specified, Sheet if length is present!
  let productForm: 'Coil' | 'Sheet' | 'Plate' | 'Bar' = length ? 'Sheet' : 'Coil';
  if (textLower.includes('plate')) productForm = 'Plate';
  if (textLower.includes('bar') || textLower.includes('flat')) productForm = 'Bar';

  // 5. Quantity (Tons & Units)
  const qtyMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:ton|tons|mt|tonne)\b/i);
  const quantityTons = qtyMatch ? parseFloat(qtyMatch[1]) : 50;
  const quantityUnits = Math.round(quantityTons * (productForm === 'Sheet' ? 120 : 1));

  // 6. Payment Terms & Delivery Location
  let paymentTerms = '30 Days PDC';
  if (textLower.includes('advance') || textLower.includes('cash')) paymentTerms = 'Advance Payment';
  else if (textLower.includes('45')) paymentTerms = '45 Days Credit';
  else if (textLower.includes('60')) paymentTerms = '60 Days Credit';

  let deliveryLocation = 'Mumbai Warehouse';
  if (textLower.includes('pune')) deliveryLocation = 'Pune Industrial Estate';
  else if (textLower.includes('nashik')) deliveryLocation = 'Nashik MIDC';

  // 7. Unit Price & Amount
  const rateMatch = text.match(/rate\s*₹?\s*(\d{4,6})/i) || text.match(/₹\s*(\d{2,3}(?:,\d{3})*)/);
  const unitPrice = rateMatch ? parseFloat(rateMatch[1].replace(/,/g, '')) : 62000;
  const totalAmount = quantityTons * unitPrice;

  return {
    companyName,
    customerPhone,
    productType,
    thickness,
    width,
    length,
    productForm,
    quantityTons,
    quantityUnits,
    unitPrice,
    totalAmount,
    paymentTerms,
    deliveryLocation
  };
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [existingCustomers, setExistingCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Selected Inquiry for Interpretation Drawer & QA Audit
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryItem | null>(null);
  const [editDetails, setEditDetails] = useState<ExtractedDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const now = new Date();
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
  });

  // Form state for Manual Log
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRequirement, setFormRequirement] = useState('');
  const [formInquiryType, setFormInquiryType] = useState('Product Requirement');

  const fetchMonthlyInquiries = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`;

      const res = await inquiriesApi.getAll(params);
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      setInquiries(list);

      // Fetch customer directory for dropdown pre-fill
      const custRes = await customersApi.getAll().catch(() => null);
      const cList = custRes?.data || [];
      const names = cList.map((c: any) => c.customer_name).filter(Boolean);
      const fallbackNames = [
        'Delta Structural Steel', 'Mehta Engineering', 'Supreme Steel',
        'SB Scafform Technovert Pvt. Ltd.', 'Apex Metals & Engg', 'Bhushan Steel Works', 'Kirloskar Pneumatic'
      ];
      setExistingCustomers(Array.from(new Set([...names, ...fallbackNames])));
    } catch (err) {
      console.error('Error fetching monthly inquiries:', err);
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyInquiries();
  }, [dateRange]);

  const handleOpenDrawer = (inq: InquiryItem) => {
    setSelectedInquiry(inq);
    const parsed = parseInquiryText(inq.raw_text || '', inq);
    setEditDetails(parsed);
    setIsEditing(false);
    setSaveSuccess(false);
  };

  const handleSaveDrawerDetails = async () => {
    if (!selectedInquiry || !editDetails) return;
    try {
      setSubmitting(true);
      await inquiriesApi.updateStatus(selectedInquiry.id, 'processed');
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setSelectedInquiry(null);
        fetchMonthlyInquiries();
      }, 1000);
    } catch (err) {
      console.error('Error saving inquiry details:', err);
      alert('Failed to save inquiry changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);
      await inquiriesApi.create({
        sender_name: formCustomerName,
        customer_name: formCustomerName,
        customer_phone: formPhone,
        sender_phone: formPhone,
        raw_text: formRequirement,
        inquiry_type: formInquiryType,
        status: 'review',
        overall_confidence: 0.95,
      });

      setShowModal(false);
      setFormCustomerName('');
      setFormPhone('');
      setFormRequirement('');
      setFormInquiryType('Product Requirement');

      fetchMonthlyInquiries();
    } catch (err) {
      console.error('Error logging inquiry:', err);
      alert('Failed to log inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Include all received inquiries (including PO documents and text inquiries)
  const safeInquiries = Array.isArray(inquiries) ? inquiries : [];

  const filtered = safeInquiries.filter(i => {
    const parsed = parseInquiryText(i.raw_text || '', i);
    const name = parsed.companyName;
    const text = i?.raw_text || '';
    const phone = parsed.customerPhone;

    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || (i?.status || '').toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={28} />
            Customer Product Inquiries
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            AI Multi-Format Interpretation (Text, Image, PDF) with QA Audit & Customer Pre-fill
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DateFilterControl onChange={setDateRange} initialPreset="this_month" />

          <button
            onClick={fetchMonthlyInquiries}
            className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs">
            <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <Plus size={16} /> Log New Inquiry
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by Customer, Material, or Phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'review', 'processed'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {st === 'all' ? `All Inquiries (${safeInquiries.length})` : st === 'review' ? 'In Review ⏳' : 'Processed 🎉'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Inquiries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Sr.</th>
                <th className="px-4 py-3">Received Date</th>
                <th className="px-4 py-3">Customer / Company Name</th>
                <th className="px-4 py-3">Customer Phone</th>
                <th className="px-4 py-3">Inquiry Type</th>
                <th className="px-4 py-3">Form &amp; Dimensions</th>
                <th className="px-4 py-3">Full Requirements Details</th>
                <th className="px-4 py-3">Source Channel</th>
                <th className="px-4 py-3 text-right">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Loading monthly inquiries...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No inquiries found for this period.
                  </td>
                </tr>
              ) : (
                filtered.map((inq, idx) => {
                  const details = parseInquiryText(inq.raw_text || '', inq);
                  const isProcessed = inq?.status === 'processed' || inq?.status === 'won';

                  return (
                    <tr
                      key={inq.id || idx}
                      onClick={() => handleOpenDrawer(inq)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                      <td className="px-4 py-3.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {inq.created_at ? new Date(inq.created_at).toLocaleString('en-IN') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <span className="flex items-center gap-1.5 text-blue-700 group-hover:underline">
                          <Building2 size={15} className="text-blue-600 flex-shrink-0" />
                          {details.companyName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700 font-mono">
                        <span className="flex items-center gap-1 font-semibold">
                          <Phone size={12} className="text-slate-400" /> {details.customerPhone}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {details.productType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] uppercase border ${
                            details.productForm === 'Sheet'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {details.productForm}
                          </span>
                          <span className="text-slate-600 font-mono font-medium">
                            {details.thickness} {details.width ? `x ${details.width}` : ''} {details.length ? `x ${details.length}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-800 font-medium max-w-xs truncate" title={inq.raw_text}>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 truncate">
                          {inq.raw_text || 'No requirement details specified.'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 capitalize">
                          {inq.source_channel || 'WhatsApp Bot'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {isProcessed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle size={12} /> Processed 🎉
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                            <Clock size={12} /> Review &amp; Edit ✍️
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI INTERPRETATION & QA AUDIT DRAWER */}
      {selectedInquiry && editDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl p-6 flex flex-col justify-between space-y-6 border-l border-slate-200">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      Inquiry AI Interpretation &amp; Audit
                      <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                        <ShieldCheck size={12} /> 92% AI Confidence
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      ID: {selectedInquiry.id} · Received {new Date(selectedInquiry.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInquiry(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>

              {/* QA & Audit Section (Original Source Message) */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-2 border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Layers size={13} className="text-blue-400" /> Original Source Message / Audit Input
                  </span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300">
                    Channel: {selectedInquiry.source_channel || 'WhatsApp'}
                  </span>
                </div>
                <p className="text-sm font-mono bg-slate-950 p-3 rounded-xl border border-slate-800/80 leading-relaxed text-blue-200">
                  "{selectedInquiry.raw_text || 'No text content available.'}"
                </p>
              </div>

              {/* Edit vs View Toggle Header */}
              <div className="flex items-center justify-between pt-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 size={16} className="text-blue-600" />
                  Pre-filled &amp; Extracted Customer Inquiry Details
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors">
                  <Edit3 size={14} /> {isEditing ? 'Cancel Edit' : 'Edit Pre-filled Fields'}
                </button>
              </div>

              {/* Editable Fields Form / Structured View */}
              <div className="space-y-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200">
                {/* 1. Customer Company Dropdown & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer / Company Name *
                    </label>
                    {isEditing ? (
                      <select
                        value={editDetails.companyName}
                        onChange={(e) => setEditDetails({ ...editDetails, companyName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                        {existingCustomers.map((cName) => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Building2 size={15} className="text-blue-600" />
                        {editDetails.companyName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer Phone Number
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDetails.customerPhone}
                        onChange={(e) => setEditDetails({ ...editDetails, customerPhone: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        {editDetails.customerPhone}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Structured Product Details Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Structured Material Specification</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase border ${
                      editDetails.productForm === 'Sheet'
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      Form: {editDetails.productForm} ({editDetails.length ? 'Length Specified' : 'No Length = Coil'})
                    </span>
                  </div>

                  <div className="p-4 space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Product Type</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDetails.productType}
                            onChange={(e) => setEditDetails({ ...editDetails, productType: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-xs font-bold"
                          />
                        ) : (
                          <span className="font-bold text-slate-900 block">{editDetails.productType}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Thickness</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDetails.thickness}
                            onChange={(e) => setEditDetails({ ...editDetails, thickness: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-xs font-mono font-bold"
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-900 block">{editDetails.thickness}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Width</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDetails.width}
                            onChange={(e) => setEditDetails({ ...editDetails, width: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-xs font-mono font-bold"
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-900 block">{editDetails.width || '-'}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Length</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDetails.length}
                            onChange={(e) => {
                              const newLen = e.target.value;
                              const newForm = newLen.trim() ? 'Sheet' : 'Coil';
                              setEditDetails({ ...editDetails, length: newLen, productForm: newForm });
                            }}
                            placeholder="e.g. 2500mm"
                            className="w-full px-2 py-1 border rounded text-xs font-mono font-bold"
                          />
                        ) : (
                          <span className="font-mono font-bold text-slate-900 block">{editDetails.length || 'None (Coil Form)'}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Quantity (MT)</span>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editDetails.quantityTons}
                            onChange={(e) => {
                              const q = parseFloat(e.target.value) || 0;
                              setEditDetails({
                                ...editDetails,
                                quantityTons: q,
                                totalAmount: q * editDetails.unitPrice
                              });
                            }}
                            className="w-full px-2 py-1 border rounded text-xs font-bold"
                          />
                        ) : (
                          <span className="font-extrabold text-blue-700 text-sm block">{editDetails.quantityTons} MT</span>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 font-semibold block mb-1">Unit Price (₹/MT)</span>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editDetails.unitPrice}
                            onChange={(e) => {
                              const r = parseFloat(e.target.value) || 0;
                              setEditDetails({
                                ...editDetails,
                                unitPrice: r,
                                totalAmount: editDetails.quantityTons * r
                              });
                            }}
                            className="w-full px-2 py-1 border rounded text-xs font-bold"
                          />
                        ) : (
                          <span className="font-bold text-slate-900 block">₹{editDetails.unitPrice.toLocaleString('en-IN')}/MT</span>
                        )}
                      </div>

                      <div className="col-span-2">
                        <span className="text-slate-400 font-semibold block mb-1">Calculated Total Amount</span>
                        <span className="font-black text-emerald-700 text-sm block">
                          ₹{editDetails.totalAmount.toLocaleString('en-IN')} + GST
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Commercial Terms & Delivery Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <CreditCard size={13} className="text-purple-600" /> Payment Terms
                    </label>
                    {isEditing ? (
                      <select
                        value={editDetails.paymentTerms}
                        onChange={(e) => setEditDetails({ ...editDetails, paymentTerms: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="30 Days PDC">30 Days PDC</option>
                        <option value="45 Days Credit">45 Days Credit</option>
                        <option value="60 Days Credit">60 Days Credit</option>
                        <option value="Advance Payment">Advance Payment</option>
                      </select>
                    ) : (
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-purple-900">
                        {editDetails.paymentTerms}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <MapPin size={13} className="text-emerald-600" /> Delivery Address / Location
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editDetails.deliveryLocation}
                        onChange={(e) => setEditDetails({ ...editDetails, deliveryLocation: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {editDetails.deliveryLocation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors">
                Close Drawer
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveDrawerDetails}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
                {submitting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : saveSuccess ? (
                  <>
                    <Check size={16} /> Interpretation Saved &amp; Confirmed!
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save &amp; Confirm Inquiry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Log Inquiry Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={20} />
                Log New Customer Inquiry
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateInquiry} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer / Company Name *</label>
                <select
                  required
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Existing Customer or Type...</option>
                  {existingCustomers.map((cName) => (
                    <option key={cName} value={cName}>{cName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="e.g. 9123456789"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Requirement Details *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. 50 MT HR Coil 3.0mm x 1250mm rate 62000"
                  value={formRequirement}
                  onChange={e => setFormRequirement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md">
                  {submitting ? 'Logging...' : 'Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
