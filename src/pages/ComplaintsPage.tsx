import { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Search, CheckCircle, Clock, ShieldAlert, RefreshCw, X } from 'lucide-react';
import { complaintsApi } from '../lib/api';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';

interface Complaint {
  id: string;
  customer_name: string;
  affected_product: string;
  complaint_type: string;
  description: string;
  status: 'reported' | 'resolved' | string;
  resolution_notes?: string;
  reported_at: string;
  sla_due_at?: string;
  resolved_at?: string;
}

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
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
  const [formProduct, setFormProduct] = useState('');
  const [formType, setFormType] = useState('Quality Defect');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('reported');
  const [formResolutionNotes, setFormResolutionNotes] = useState('');

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const res = await complaintsApi.getAll();
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      setComplaints(list);
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);
      await complaintsApi.create({
        customer_name: formCustomerName,
        affected_product: formProduct,
        complaint_type: formType,
        description: formDescription,
        status: formStatus,
        resolution_notes: formResolutionNotes,
      });

      setShowModal(false);
      // Reset form
      setFormCustomerName('');
      setFormProduct('');
      setFormType('Quality Defect');
      setFormDescription('');
      setFormStatus('reported');
      setFormResolutionNotes('');

      fetchComplaints();
    } catch (err) {
      console.error('Error creating complaint:', err);
      alert('Failed to log complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'resolved' ? 'reported' : 'resolved';
    const notes = nextStatus === 'resolved' ? prompt('Enter resolution notes:') || 'Resolved via web dashboard' : undefined;
    try {
      await complaintsApi.updateStatus(id, nextStatus, notes);
      fetchComplaints();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const safeComplaints = Array.isArray(complaints) ? complaints : [];

  // Filter complaints by date range, search, type, & status
  const filtered = safeComplaints.filter(c => {
    // Date filter
    if (dateRange.from && dateRange.to) {
      const dateStr = c.reported_at;
      if (dateStr) {
        const itemDate = new Date(dateStr).toISOString().split('T')[0];
        if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
      }
    }

    const matchesSearch =
      (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.affected_product || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || (c.complaint_type || '').toLowerCase() === filterType.toLowerCase();
    const matchesStatus = filterStatus === 'all' || (c.status || '').toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalCount = filtered.length;
  const resolvedCount = filtered.filter(c => c.status === 'resolved').length;
  const pendingCount = totalCount - resolvedCount;
  const breachedCount = filtered.filter(c => {
    if (c.status === 'resolved') return false;
    if (!c.sla_due_at) return false;
    return new Date(c.sla_due_at) < new Date();
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="text-amber-600" size={28} />
            Customer Complaints
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Track and log customer complaints with 48-hour resolution SLA management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={fetchComplaints}
            className="p-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={18} />
            Log New Complaint
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Complaints</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <AlertTriangle size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Resolved (Closed)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{resolvedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Pending Resolution</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">SLA Breached (&gt;48h)</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{breachedCount}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <ShieldAlert size={22} />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer, product, description..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Statuses</option>
            <option value="reported">Reported / Open</option>
            <option value="resolved">Resolved / Closed</option>
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Complaint Types</option>
            <option value="Quality Defect">Quality Defect</option>
            <option value="Physical Damage">Physical Damage</option>
            <option value="Billing Mismatch">Billing Mismatch</option>
            <option value="Delivery Delay">Delivery Delay</option>
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
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">SLA Target (48h)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    Loading complaints data...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No complaints found.
                  </td>
                </tr>
              ) : (
                filtered.map((comp, idx) => {
                  const isResolved = comp.status === 'resolved';
                  const isBreached = !isResolved && comp.sla_due_at && new Date(comp.sla_due_at) < new Date();

                  return (
                    <tr key={comp.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {comp.reported_at ? new Date(comp.reported_at).toLocaleDateString('en-IN') : '-'}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">{comp.customer_name}</td>
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          {comp.complaint_type || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-800">
                        {comp.affected_product || '-'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 max-w-xs truncate" title={comp.description}>
                        {comp.description || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isResolved ? (
                          <span className="text-xs text-emerald-600 font-medium">Closed ✅</span>
                        ) : isBreached ? (
                          <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-700 rounded">
                            SLA Breached ⚠️
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded">
                            Within SLA ✅
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle size={12} /> Resolved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                            <Clock size={12} /> Reported
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(comp.id, comp.status)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            isResolved
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}>
                          {isResolved ? 'Reopen' : 'Mark Resolved'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Complaint Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                Log Customer Complaint
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mehta Engineering"
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Affected Product</label>
                  <input
                    type="text"
                    placeholder="e.g. CR Sheet 2mm"
                    value={formProduct}
                    onChange={e => setFormProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Complaint Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="Quality Defect">Quality Defect</option>
                    <option value="Physical Damage">Physical Damage</option>
                    <option value="Billing Mismatch">Billing Mismatch</option>
                    <option value="Delivery Delay">Delivery Delay</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Details</label>
                <textarea
                  rows={3}
                  placeholder="Describe the complaint in detail..."
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="reported">Reported / Open</option>
                    <option value="resolved">Resolved / Closed</option>
                  </select>
                </div>

                {formStatus === 'resolved' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Notes</label>
                    <input
                      type="text"
                      placeholder="Resolution details..."
                      value={formResolutionNotes}
                      onChange={e => setFormResolutionNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
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
                  {submitting ? 'Saving...' : 'Save Complaint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
