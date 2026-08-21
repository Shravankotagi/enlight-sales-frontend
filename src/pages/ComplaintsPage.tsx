import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  X,
  Edit3,
  Calendar,
  Package,
  User,
  Timer,
  Check,
  MessageSquare,
} from 'lucide-react';
import { complaintsApi, employeesApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';

interface Complaint {
  id: string;
  customer_name: string;
  affected_product?: string;
  complaint_type?: string;
  description?: string;
  status: 'reported' | 'resolved' | string;
  resolution_notes?: string;
  reported_at: string;
  sla_due_at?: string;
  resolved_at?: string;
  reported_by?: string;
  salesperson_name?: string;
  resolution_time_hrs?: number;
}

export default function ComplaintsPage() {
  const { isSalesManager, isAdmin } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Details Modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [modalResolutionNotes, setModalResolutionNotes] = useState('');
  const [modalActionLoading, setModalActionLoading] = useState(false);

  // Edit Modal
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editType, setEditType] = useState('Quality Defect');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('reported');
  const [editResolutionNotes, setEditResolutionNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  // Create Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formProduct, setFormProduct] = useState('');
  const [formType, setFormType] = useState('Quality Defect');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState('reported');
  const [formResolutionNotes, setFormResolutionNotes] = useState('');

  // Fetch employees list for salesperson name mapping
  useEffect(() => {
    if (canViewSalesperson) {
      employeesApi
        .getAll()
        .then(res => {
          const raw = res?.data;
          const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
          setEmployees(list);
        })
        .catch(() => setEmployees([]));
    }
  }, [canViewSalesperson]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach(emp => {
      if (emp.phone) {
        const clean = emp.phone.replace(/\D/g, '').slice(-10);
        if (clean) map.set(clean, emp.name);
      }
    });
    return map;
  }, [employees]);

  const getSalespersonDisplayName = (comp: Complaint) => {
    if (comp.salesperson_name && comp.salesperson_name !== comp.reported_by) {
      return comp.salesperson_name;
    }
    if (comp.reported_by) {
      const cleanPhone = comp.reported_by.replace(/\D/g, '').slice(-10);
      if (cleanPhone && employeeMap.has(cleanPhone)) {
        return employeeMap.get(cleanPhone);
      }
      return comp.reported_by;
    }
    return 'Web Admin';
  };

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
      const res = await complaintsApi.getAll(params);
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
  }, [dateRange]);

  // Create Complaint
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

      setShowCreateModal(false);
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

  // Open Edit Modal
  const openEditModal = (comp: Complaint) => {
    setEditingComplaint(comp);
    setEditCustomerName(comp.customer_name || '');
    setEditProduct(comp.affected_product || '');
    setEditType(comp.complaint_type || 'Quality Defect');
    setEditDescription(comp.description || '');
    setEditStatus(comp.status || 'reported');
    setEditResolutionNotes(comp.resolution_notes || '');
  };

  // Save Edited Complaint
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComplaint) return;

    try {
      setEditSaving(true);
      const updatedPayload = {
        customer_name: editCustomerName.trim(),
        affected_product: editProduct.trim(),
        complaint_type: editType,
        description: editDescription.trim(),
        status: editStatus,
        resolution_notes: editResolutionNotes.trim(),
      };

      await complaintsApi.update(editingComplaint.id, updatedPayload);

      // If this complaint was open in the details modal, update it too
      if (selectedComplaint && selectedComplaint.id === editingComplaint.id) {
        setSelectedComplaint(prev => (prev ? { ...prev, ...updatedPayload } : null));
      }

      setEditingComplaint(null);
      fetchComplaints();
    } catch (err) {
      console.error('Error updating complaint:', err);
      alert('Failed to update complaint. Please check your permissions.');
    } finally {
      setEditSaving(false);
    }
  };

  // View Details Modal
  const openComplaintDetails = (comp: Complaint) => {
    setSelectedComplaint(comp);
    setModalResolutionNotes(comp.resolution_notes || '');
  };

  // Resolve inside Details Modal
  const handleResolveInModal = async () => {
    if (!selectedComplaint) return;
    try {
      setModalActionLoading(true);
      const notes = modalResolutionNotes.trim() || 'Resolved via web dashboard';
      await complaintsApi.update(selectedComplaint.id, {
        status: 'resolved',
        resolution_notes: notes,
      });
      setSelectedComplaint(prev =>
        prev ? { ...prev, status: 'resolved', resolution_notes: notes, resolved_at: new Date().toISOString() } : null,
      );
      fetchComplaints();
    } catch (err) {
      console.error('Error resolving complaint in modal:', err);
      alert('Failed to resolve complaint. Please try again.');
    } finally {
      setModalActionLoading(false);
    }
  };

  // Reopen inside Details Modal
  const handleReopenInModal = async () => {
    if (!selectedComplaint) return;
    try {
      setModalActionLoading(true);
      await complaintsApi.update(selectedComplaint.id, {
        status: 'reported',
      });
      setSelectedComplaint(prev => (prev ? { ...prev, status: 'reported' } : null));
      fetchComplaints();
    } catch (err) {
      console.error('Error reopening complaint in modal:', err);
      alert('Failed to reopen complaint. Please try again.');
    } finally {
      setModalActionLoading(false);
    }
  };

  const safeComplaints = Array.isArray(complaints) ? complaints : [];

  // Filter complaints
  const filtered = safeComplaints.filter(c => {
    if (dateRange.from && dateRange.to) {
      const dateStr = c.reported_at;
      if (dateStr) {
        const itemDate = new Date(dateStr).toISOString().split('T')[0];
        if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
      }
    }

    const repName = getSalespersonDisplayName(c) || '';
    const matchesSearch =
      (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.affected_product || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.reported_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      repName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || (c.complaint_type || '').toLowerCase() === filterType.toLowerCase();
    const isBreached =
      c.status !== 'resolved' &&
      ((!!c.sla_due_at && new Date(c.sla_due_at) < new Date()) ||
        (Date.now() - new Date(c.reported_at).getTime()) / (1000 * 60 * 60) >= 48);

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'breached'
        ? isBreached
        : (c.status || '').toLowerCase() === filterStatus.toLowerCase());
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalCount = filtered.length;
  const resolvedCount = filtered.filter(c => c.status === 'resolved').length;
  const pendingCount = totalCount - resolvedCount;
  const breachedCount = filtered.filter(c => {
    if (c.status === 'resolved') return false;
    if (!c.sla_due_at) {
      return (Date.now() - new Date(c.reported_at).getTime()) / (1000 * 60 * 60) >= 48;
    }
    return new Date(c.sla_due_at) < new Date();
  }).length;

  const calculateSlaInfo = (c: Complaint) => {
    const isResolved = c.status === 'resolved';
    if (isResolved) {
      return { isResolved: true, isBreached: false, hoursElapsed: 0, hoursRemaining: 0, label: 'Resolved' };
    }

    const reportedTime = new Date(c.reported_at).getTime();
    const now = Date.now();
    const hoursElapsed = Math.floor((now - reportedTime) / (1000 * 60 * 60));
    const hoursRemaining = Math.max(0, 48 - hoursElapsed);
    const isBreached = hoursElapsed >= 48;

    return {
      isResolved: false,
      isBreached,
      hoursElapsed,
      hoursRemaining,
      label: isBreached ? `Breached (${hoursElapsed}h)` : `${hoursRemaining}h left`,
    };
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-blue-600" size={26} />
            Customer Complaints &amp; SLA
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Track and resolve customer quality and service issues within the strict 48-hour SLA deadline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />
          <button
            onClick={fetchComplaints}
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
            title="Refresh">
            <RefreshCw size={17} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors">
            <Plus size={17} />
            Log Complaint
          </button>
        </div>
      </div>

      {/* Stats Cards - Clean and Calm */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Complaints</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg">
            <MessageSquare size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{resolvedCount}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pending (Open)</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{pendingCount}</p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">SLA Breached</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{breachedCount}</p>
          </div>
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={canViewSalesperson ? 'Search customer, product, rep...' : 'Search customer, product, issue...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
            <option value="all">All Statuses</option>
            <option value="reported">Open Complaints</option>
            <option value="resolved">Resolved Complaints</option>
            <option value="breached">SLA Breached (&gt;48h)</option>
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
            <option value="all">All Issue Types</option>
            <option value="Quality Defect">Quality Defect</option>
            <option value="Physical Damage">Physical Damage</option>
            <option value="Billing Mismatch">Billing Mismatch</option>
            <option value="Delivery Delay">Delivery Delay</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Streamlined, Calm Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 min-w-[200px]">Customer &amp; Date</th>
                <th className="px-4 py-3 min-w-[170px]">Issue &amp; Product</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 min-w-[140px]">Status &amp; SLA</th>
                <th className="px-4 py-3 min-w-[170px]">Resolution Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                    Loading complaints...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    <ShieldCheck size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-700 font-medium text-sm">No complaints found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting the search filters or log a new complaint.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((comp, idx) => {
                  const isResolved = comp.status === 'resolved';
                  const sla = calculateSlaInfo(comp);
                  const salespersonName = getSalespersonDisplayName(comp);

                  return (
                    <tr
                      key={comp.id || idx}
                      onClick={() => openComplaintDetails(comp)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors group">
                      {/* 1. Customer & Date (+ Salesperson for Managers) */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {comp.customer_name || 'Customer'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} className="text-slate-400 shrink-0" />
                            {comp.reported_at ? new Date(comp.reported_at).toLocaleDateString('en-IN') : '-'}
                          </span>
                          {/* Salesperson tag visible ONLY to Sales Managers & Admin */}
                          {canViewSalesperson && salespersonName && (
                            <span className="text-slate-500 font-medium inline-flex items-center gap-1">
                              • <User size={11} className="text-slate-400 shrink-0" /> {salespersonName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Issue Type & Product */}
                      <td className="px-4 py-3.5">
                        <div className="text-xs font-semibold text-slate-700">
                          {comp.complaint_type || 'Quality Defect'}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Package size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{comp.affected_product || 'General Material'}</span>
                        </div>
                      </td>

                      {/* 3. Issue Description */}
                      <td className="px-4 py-3.5 text-xs max-w-sm">
                        <p className="text-slate-600 leading-relaxed line-clamp-2">{comp.description || '—'}</p>
                      </td>

                      {/* 4. Unified Status & SLA */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={12} className="text-emerald-600" /> Resolved
                          </span>
                        ) : sla.isBreached ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            <AlertTriangle size={12} className="text-rose-600" /> Breached ({sla.hoursElapsed}h)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
                            <Clock size={12} className="text-amber-600" /> {sla.hoursRemaining}h left
                          </span>
                        )}
                      </td>

                      {/* 5. Resolution Notes (Clean Text, No Redundant Yellow Pills) */}
                      <td className="px-4 py-3.5 text-xs max-w-[200px]">
                        {isResolved ? (
                          <span className="text-slate-700 font-medium leading-snug line-clamp-2" title={comp.resolution_notes}>
                            {comp.resolution_notes || 'Resolved via dashboard'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Pending resolution</span>
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

      {/* Action-Oriented Details & Resolution Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedComplaint.customer_name}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    {selectedComplaint.reported_at
                      ? new Date(selectedComplaint.reported_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recent'}
                  </span>
                  {canViewSalesperson && (
                    <span>• Rep: <strong className="text-slate-700">{getSalespersonDisplayName(selectedComplaint)}</strong></span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const c = selectedComplaint;
                    setSelectedComplaint(null);
                    openEditModal(c);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Edit Complaint">
                  <Edit3 size={13} />
                  Edit Details
                </button>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* SLA Urgency & Status Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer size={16} className="text-slate-500" />
                <span className="text-xs font-medium text-slate-600">48h SLA Status:</span>
              </div>
              <div>
                {selectedComplaint.status === 'resolved' ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Resolved
                  </span>
                ) : calculateSlaInfo(selectedComplaint).isBreached ? (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                    <AlertTriangle size={12} /> SLA Breached ({calculateSlaInfo(selectedComplaint).hoursElapsed}h)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Clock size={12} /> {calculateSlaInfo(selectedComplaint).hoursRemaining}h remaining
                  </span>
                )}
              </div>
            </div>

            {/* Complaint Info Block */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 font-medium">
                <span>Type: <strong className="text-slate-800">{selectedComplaint.complaint_type || 'General'}</strong></span>
                <span>Product: <strong className="text-slate-800">{selectedComplaint.affected_product || 'General Material'}</strong></span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-slate-500 font-medium mb-1">Issue Details:</p>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{selectedComplaint.description || 'No details provided.'}</p>
              </div>
            </div>

            {/* Resolution Workspace */}
            <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-blue-600" />
                Corrective Action &amp; Resolution
              </p>

              {selectedComplaint.status === 'resolved' ? (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg leading-relaxed">
                    {selectedComplaint.resolution_notes || 'Marked as resolved.'}
                  </p>
                  {selectedComplaint.resolved_at && (
                    <p className="text-[11px] text-slate-500">
                      Resolved on {new Date(selectedComplaint.resolved_at).toLocaleString('en-IN')}
                    </p>
                  )}
                  <button
                    onClick={handleReopenInModal}
                    disabled={modalActionLoading}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors">
                    {modalActionLoading ? 'Updating...' : 'Reopen Complaint'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Enter resolution notes (e.g. Credit note issued, material replaced)..."
                    value={modalResolutionNotes}
                    onChange={e => setModalResolutionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleResolveInModal}
                      disabled={modalActionLoading}
                      className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                      <Check size={14} />
                      {modalActionLoading ? 'Saving...' : 'Mark as Resolved'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Complaint Modal */}
      {editingComplaint && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="text-blue-600" size={18} />
                Edit Complaint Details
              </h2>
              <button
                onClick={() => setEditingComplaint(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={e => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Affected Product</label>
                  <input
                    type="text"
                    value={editProduct}
                    onChange={e => setEditProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Complaint Type</label>
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
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
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="reported">Reported (Open)</option>
                    <option value="resolved">Resolved (Closed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Resolution Notes</label>
                  <input
                    type="text"
                    placeholder="Resolution details..."
                    value={editResolutionNotes}
                    onChange={e => setEditResolutionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingComplaint(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Complaint Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="text-blue-600" size={18} />
                Log Customer Complaint
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mehta Engineering"
                  value={formCustomerName}
                  onChange={e => setFormCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Complaint Type</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
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
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
