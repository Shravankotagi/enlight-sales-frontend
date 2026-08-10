import { useState, useEffect } from 'react';
import { FileText, Plus, Search, CheckCircle, Clock, RefreshCw, X, Building2, Phone, Calendar } from 'lucide-react';
import { inquiriesApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';

interface InquiryItem {
  id: string;
  sender_name?: string;
  customer_name?: string;
  sender_phone?: string;
  raw_text?: string;
  inquiry_type?: string;
  status?: string;
  source_channel?: string;
  overall_confidence?: number;
  created_at: string;
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    to: now.toISOString().split('T')[0]
  });

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRequirement, setFormRequirement] = useState('');
  const [formInquiryType, setFormInquiryType] = useState('Product Requirement');

  const fetchMonthlyInquiries = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;

      const res = await inquiriesApi.getAll(params);
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      setInquiries(list);
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

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);
      await inquiriesApi.create({
        sender_name: formCustomerName,
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

  const isProductEnquiry = (i: InquiryItem) => {
    if (i.source_channel === 'web_dashboard') return true;
    const text = (i.raw_text || '').trim().toLowerCase();
    if (!text) return false;

    // Exclude single digits / choice selections (1, 2, 3)
    if (/^\d{1,2}$/.test(text)) return false;

    // Exclude Deal ID codes (#DEAL-...)
    if (/^#deal-[a-f0-9]+$/i.test(text)) return false;

    // Exclude deal status commands (won/lost updates)
    if (/\b(deal is won|deal lost|deal closed|won deal|lost deal|marked as won|marked as lost)\b/i.test(text)) return false;

    // Exclude question lookups / PO queries
    if (/\b(can you share|po number|show my|what is the|where is the|login link|portal link|dashboard link)\b/i.test(text)) return false;

    // Exclude payment messages
    if (/\b(paid|advance|cheque|rtgs|neft|upi|balance|outstanding|payment received)\b/i.test(text)) return false;

    // Include if contains product keywords / tonnage / requirement intent
    const hasProductKeywords = /\b(ton|tons|mt|kg|coil|coils|plate|plates|sheet|sheets|tmt|bar|bars|hr|cr|ms|steel|pipe|pipes|beam|angle|channel|requirement|requires|need|asking for|quote|quotation|price for|rate for)\b/i.test(text);

    return hasProductKeywords || text.length > 3;
  };

  const safeInquiries = (Array.isArray(inquiries) ? inquiries : []).filter(isProductEnquiry);

  // Filter inquiries by search & status
  const filtered = safeInquiries.filter(i => {
    const name = i?.sender_name || i?.customer_name || '';
    const text = i?.raw_text || '';
    const phone = i?.sender_phone || '';

    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || (i?.status || '').toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalThisMonth = safeInquiries.length;
  const newCount = safeInquiries.filter(i => ['new', 'review', 'needs_review', 'pending'].includes(i?.status || '')).length;
  const processedCount = safeInquiries.filter(i => ['processed', 'won', 'converted'].includes(i?.status || '')).length;

  const currentMonthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="text-blue-600" size={28} />
            Customer Product Inquiries
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Detailed breakdown of customer product inquiries and material requirements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={fetchMonthlyInquiries}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} />
            Log New Inquiry
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">New Inquiries ({currentMonthName})</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalThisMonth}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <FileText size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Active / Pending Review ⏳</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{newCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Processed / Converted 📈</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{processedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle size={22} />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, material requirement, phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Inquiry Statuses</option>
            <option value="review">Pending Review</option>
            <option value="processed">Processed / Converted</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Sr.</th>
                <th className="px-4 py-3">Received Date</th>
                <th className="px-4 py-3">Customer / Company Name</th>
                <th className="px-4 py-3">Contact Phone</th>
                <th className="px-4 py-3">Inquiry Type</th>
                <th className="px-4 py-3">Full Requirements Details</th>
                <th className="px-4 py-3">Source Channel</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading monthly inquiries...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No new inquiries received this month yet.
                  </td>
                </tr>
              ) : (
                filtered.map((inq, idx) => {
                  const custName = inq?.sender_name || inq?.customer_name || 'Customer';
                  const isProcessed = inq?.status === 'processed' || inq?.status === 'won';

                  return (
                    <tr key={inq.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {inq.created_at ? new Date(inq.created_at).toLocaleString('en-IN') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-blue-500" />
                          {custName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 font-mono">
                        {inq.sender_phone ? (
                          <span className="flex items-center gap-1">
                            <Phone size={12} className="text-slate-400" /> {inq.sender_phone}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {inq.inquiry_type || 'Product Requirement'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-800 font-medium max-w-sm" title={inq.raw_text}>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 leading-relaxed">
                          {inq.raw_text || 'No requirement details specified.'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 capitalize">
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
                            <Clock size={12} /> In Review ⏳
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

      {/* Log Inquiry Modal */}
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
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Engineering"
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9822012345"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Inquiry Type</label>
                  <input
                    type="text"
                    placeholder="Product Requirement"
                    value={formInquiryType}
                    onChange={e => setFormInquiryType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Requirements &amp; Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter details of customer material requirements..."
                  value={formRequirement}
                  onChange={e => setFormRequirement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  {submitting ? 'Saving Inquiry...' : 'Log Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
