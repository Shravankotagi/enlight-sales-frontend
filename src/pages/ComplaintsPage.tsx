import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  Edit3,
  Calendar,
  Package,
  User,
  Check,
  MessageSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react';
import { complaintsApi, employeesApi, customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  getFirstDayOfMonth,
  getLastDayOfMonth,
  formatLocalDate,
  getDaysAgo,
} from '../utils/dateUtils';
import CustomerCombobox, { type CustomerDirectoryItem } from '../components/CustomerCombobox';

interface Complaint {
  id: string;
  customer_name: string;
  affected_product?: string;
  complaint_type?: string;
  description?: string;
  status: 'reported' | 'resolved' | string;
  resolution_notes?: string;
  reported_at: string;
  resolved_at?: string;
  reported_by?: string;
  salesperson_name?: string;
}

export default function ComplaintsPage() {
  const { isSalesManager, isAdmin } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Date Filter Presets (Matching Visits tab pattern)
  const [dayPreset, setDayPreset] = useState<string>('this_month');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomDate, setShowCustomDate] = useState<boolean>(false);

  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  const handleDayPresetChange = (preset: string) => {
    setDayPreset(preset);
    if (preset === 'today') {
      const today = formatLocalDate();
      setDateRange({ from: today, to: today });
      setShowCustomDate(false);
    } else if (preset === '7_days') {
      setDateRange({ from: getDaysAgo(7), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === '30_days') {
      setDateRange({ from: getDaysAgo(30), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === '90_days') {
      setDateRange({ from: getDaysAgo(90), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === 'this_month') {
      setDateRange({ from: getFirstDayOfMonth(), to: getLastDayOfMonth() });
      setShowCustomDate(false);
    } else if (preset === 'custom') {
      setShowCustomDate(true);
    }
  };

  const handleCustomFromChange = (val: string) => {
    setCustomFrom(val);
    let effectiveTo = customTo;
    if (val && customTo && val > customTo) {
      effectiveTo = val;
      setCustomTo(val);
    }
    if (val && effectiveTo) {
      setDateRange({ from: val, to: effectiveTo });
    } else if (val) {
      setDateRange({ from: val, to: val });
    }
  };

  const handleCustomToChange = (val: string) => {
    let effectiveVal = val;
    if (val && customFrom && val < customFrom) {
      effectiveVal = customFrom;
    }
    setCustomTo(effectiveVal);
    if (customFrom && effectiveVal) {
      setDateRange({ from: customFrom, to: effectiveVal });
    }
  };

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

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

  // Fetch customers directory
  useEffect(() => {
    customersApi
      .getAll()
      .then(res => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        setCustomers(list);
      })
      .catch(err => {
        console.error('Error fetching customers directory:', err);
        setCustomers([]);
      });
  }, []);

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

  // Unified customer directory for combobox
  const customerDirectory = useMemo<CustomerDirectoryItem[]>(() => {
    const dirMap = new Map<string, CustomerDirectoryItem>();

    customers.forEach(c => {
      const rawName = (c?.customer_name || '').trim();
      if (!rawName) return;
      const key = rawName.toLowerCase();
      dirMap.set(key, {
        id: c.id,
        customer_name: rawName,
        contact_person: (c?.contact_person || '').trim() || undefined,
        contact_phone: (c?.customer_phone || c?.phone || '').trim() || undefined,
        location: (c?.customer_address || c?.address || c?.city || '').trim() || undefined,
      });
    });

    complaints.forEach(c => {
      const rawName = (c?.customer_name || '').trim();
      if (!rawName) return;
      const key = rawName.toLowerCase();
      if (!dirMap.has(key)) {
        dirMap.set(key, {
          id: c.id,
          customer_name: rawName,
        });
      }
    });

    return Array.from(dirMap.values()).sort((a, b) =>
      a.customer_name.localeCompare(b.customer_name)
    );
  }, [customers, complaints]);

  const handleSelectCustomerForCreate = (cust: CustomerDirectoryItem) => {
    setFormCustomerName(cust.customer_name);
    if (formErrors.customerName) setFormErrors(prev => ({ ...prev, customerName: false }));
  };

  const handleSelectCustomerForEdit = (cust: CustomerDirectoryItem) => {
    setEditCustomerName(cust.customer_name);
  };

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

  const handleOpenAddModal = () => {
    setFormCustomerName('');
    setFormProduct('');
    setFormType('Quality Defect');
    setFormDescription('');
    setFormStatus('reported');
    setFormResolutionNotes('');
    setFormErrors({});
    setIsSavedSuccess(false);
    setShowCreateModal(true);
  };

  // Create Complaint
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, boolean> = {};
    if (!formCustomerName.trim()) errors.customerName = true;
    if (!formType) errors.type = true;
    if (!formDescription.trim()) errors.description = true;
    if (!formStatus) errors.status = true;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      await complaintsApi.create({
        customer_name: formCustomerName.trim(),
        affected_product: formProduct.trim(),
        complaint_type: formType,
        description: formDescription.trim(),
        status: formStatus,
        resolution_notes: formResolutionNotes.trim(),
      });

      setIsSavedSuccess(true);
      toast.success('Complaint logged successfully!');

      setTimeout(() => {
        setIsSavedSuccess(false);
        setShowCreateModal(false);
        setFormCustomerName('');
        setFormProduct('');
        setFormType('Quality Defect');
        setFormDescription('');
        setFormStatus('reported');
        setFormResolutionNotes('');
        setFormErrors({});
        fetchComplaints();
      }, 500);
    } catch (err) {
      console.error('Error creating complaint:', err);
      toast.error('Failed to log complaint. Please try again.');
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
    if (!editingComplaint || !editCustomerName.trim()) return;

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
      toast.success('Complaint updated successfully!');
      fetchComplaints();
    } catch (err) {
      console.error('Error updating complaint:', err);
      toast.error('Failed to update complaint.');
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
      toast.success('Complaint marked as resolved!');
      fetchComplaints();
    } catch (err) {
      console.error('Error resolving complaint in modal:', err);
      toast.error('Failed to resolve complaint.');
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
      toast.success('Complaint reopened!');
      fetchComplaints();
    } catch (err) {
      console.error('Error reopening complaint in modal:', err);
      toast.error('Failed to reopen complaint.');
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
      (c.complaint_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.reported_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.resolution_notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      repName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' || (c.status || '').toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalCount = complaints.length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
  const pendingCount = totalCount - resolvedCount;

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedComplaints = filtered.slice(startIndex, startIndex + pageSize);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setDayPreset('this_month');
    setShowCustomDate(false);
    setCustomFrom('');
    setCustomTo('');
    setDateRange({
      from: getFirstDayOfMonth(),
      to: getLastDayOfMonth(),
    });
  };

  const hasProduct = (comp: Complaint) => {
    if (!comp.affected_product) return false;
    const trimmed = comp.affected_product.trim();
    return trimmed !== '' && trimmed !== '-';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-blue-600" size={28} />
            Customer Complaints Log
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchComplaints}
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
            <Plus size={15} />
            Log Complaint
          </button>
        </div>
      </div>

      {/* Stats Cards (3 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Complaints</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <MessageSquare size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{resolvedCount}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Pending (Open)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar - Matching Visits Tab */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* 1. Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={canViewSalesperson ? 'Search Customer, Issue, Rep...' : 'Search Customer, Issue, Product...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Clear Search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 2. Date Preset Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
            <select
              value={dayPreset}
              onChange={e => handleDayPresetChange(e.target.value)}
              className="w-full sm:w-auto pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="this_month">This Month</option>
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 3. Status Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all">All Statuses ({complaints.length})</option>
              <option value="reported">Pending ({pendingCount})</option>
              <option value="resolved">Resolved ({resolvedCount})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 4. Clear Filter Button */}
          {(searchTerm || filterStatus !== 'all' || dayPreset !== 'this_month') && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer">
              Clear Filter
            </button>
          )}
        </div>

        {/* Custom Range Inputs */}
        {showCustomDate && (
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
            <span className="text-slate-500 font-semibold">From:</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => handleCustomFromChange(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
            />
            <span className="text-slate-500 font-semibold">To:</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => handleCustomToChange(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Listing Data Table (4 Columns - Actions Removed) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3.5 text-center w-12">#</th>
                <th className="px-5 py-3.5 text-left min-w-[220px]">Customer</th>
                <th className="px-4 py-3.5 text-left min-w-[160px]">Date</th>
                <th className="px-4 py-3.5 text-center min-w-[140px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                    Loading complaints...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                    <AlertTriangle size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No complaints found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting the filters or log a new complaint.</p>
                  </td>
                </tr>
              ) : (
                paginatedComplaints.map((comp, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const isResolved = comp.status === 'resolved';
                  const salespersonName = getSalespersonDisplayName(comp);

                  return (
                    <tr
                      key={comp.id || idx}
                      onClick={() => openComplaintDetails(comp)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors group">
                      {/* 0. Serial Number */}
                      <td className="px-3 py-3.5 font-medium text-slate-500 text-center">
                        {globalIdx}
                      </td>

                      {/* 1. Customer (+ Sales Rep for Managers) */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                          {comp.customer_name || 'Customer'}
                        </div>
                        {canViewSalesperson && salespersonName && (
                          <div className="text-xs text-slate-500 font-medium inline-flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <User size={11} className="text-slate-400 shrink-0" /> Rep: {salespersonName}
                          </div>
                        )}
                      </td>

                      {/* 2. Date */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          {comp.reported_at
                            ? new Date(comp.reported_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                            : '-'}
                        </div>
                      </td>

                      {/* 3. Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {isResolved ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600" /> Resolved
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                            <Clock size={12} className="text-amber-600" /> Pending
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

        {/* Pagination Controls - Visits Tab Style */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-900">{filtered.length === 0 ? 0 : startIndex + 1}</span> to{' '}
            <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
            <span className="font-bold text-slate-900">{filtered.length}</span> complaints
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer flex items-center gap-1">
              <ChevronLeft size={14} className="text-slate-400" />
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-7 h-7 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${currentPage === pageNum
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-transparent hover:border-slate-200'
                  }`}>
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer flex items-center gap-1">
              Next
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Complaint Details Modal (Opened on Row Click) */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto space-y-4">
            {/* Modal Header with Top-Right Status Badge & Single Close X Button */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0">
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

              {/* Status Badge beside single Close Button */}
              <div className="flex items-center gap-3 shrink-0">
                {selectedComplaint.status === 'resolved' ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-600" /> Resolved
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                    <Clock size={12} className="text-amber-600" /> Pending
                  </span>
                )}

                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Separate White Section Cards for Complaint Type & Affected Product */}
            <div className={`grid gap-3 shrink-0 ${hasProduct(selectedComplaint) ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Complaint Type Card */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                <p className="text-xs font-medium text-slate-400 mb-1">Complaint Type</p>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-blue-600 shrink-0" />
                  {selectedComplaint.complaint_type || 'Quality Defect'}
                </div>
              </div>

              {/* Affected Product Card (Shown ONLY if applicable) */}
              {hasProduct(selectedComplaint) && (
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <p className="text-xs font-medium text-slate-400 mb-1">Affected Product</p>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Package size={15} className="text-slate-400 shrink-0" />
                    {selectedComplaint.affected_product}
                  </div>
                </div>
              )}
            </div>

            {/* Complaint Description Block */}
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1 text-xs flex-1 overflow-y-auto">
              <p className="text-slate-500 font-semibold mb-1">Complaint Description:</p>
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedComplaint.description || 'No description provided.'}
              </p>
            </div>

            {/* Resolution Workspace */}
            <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5 shrink-0">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-blue-600" />
                Resolution Notes
              </p>

              {selectedComplaint.status === 'resolved' ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg leading-relaxed">
                    {selectedComplaint.resolution_notes || 'Marked as resolved.'}
                  </p>
                  {selectedComplaint.resolved_at && (
                    <p className="text-[11px] text-slate-500">
                      Resolved on {new Date(selectedComplaint.resolved_at).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Enter resolution notes..."
                  value={modalResolutionNotes}
                  onChange={e => setModalResolutionNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Modal Bottom Right Action Buttons (No Close button here) */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const c = selectedComplaint;
                  setSelectedComplaint(null);
                  openEditModal(c);
                }}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
                <Edit3 size={14} />
                Edit Details
              </button>

              {selectedComplaint.status === 'resolved' ? (
                <button
                  type="button"
                  onClick={handleReopenInModal}
                  disabled={modalActionLoading}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-full transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  <RefreshCw size={14} className={modalActionLoading ? 'animate-spin' : ''} />
                  {modalActionLoading ? 'Updating...' : 'Reopen Complaint'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResolveInModal}
                  disabled={modalActionLoading}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  <Check size={14} />
                  {modalActionLoading ? 'Saving...' : 'Mark as Resolved'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Complaint Modal */}
      {editingComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="text-blue-600" size={18} />
                Edit Complaint Details
              </h2>
              <button
                onClick={() => setEditingComplaint(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="space-y-4 py-4 px-1 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company / Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <CustomerCombobox
                    value={editCustomerName}
                    onChange={setEditCustomerName}
                    onSelectCustomer={handleSelectCustomerForEdit}
                    customers={customerDirectory}
                    placeholder="Search or enter company name..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Complaint Type <span className="text-rose-500">*</span></label>
                    <select
                      value={editType}
                      onChange={e => setEditType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium">
                      <option value="Quality Defect">Quality Defect</option>
                      <option value="Physical Damage">Physical Damage</option>
                      <option value="Billing Mismatch">Billing Mismatch</option>
                      <option value="Delivery Delay">Delivery Delay</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Affected Product</label>
                    <input
                      type="text"
                      placeholder="e.g. CR Sheet 2mm"
                      value={editProduct}
                      onChange={e => setEditProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Complaint Description <span className="text-rose-500">*</span></label>
                  <textarea
                    rows={3}
                    required
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status <span className="text-rose-500">*</span></label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium">
                      <option value="reported">Pending (Open)</option>
                      <option value="resolved">Resolved (Closed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Resolution Notes</label>
                    <input
                      type="text"
                      placeholder="Resolution details..."
                      value={editResolutionNotes}
                      onChange={e => setEditResolutionNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons with Pill-Shaped "Save" Button */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 shrink-0 mt-3">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50">
                  <Save size={16} />
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Complaint Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="text-blue-600" size={18} />
                Log Customer Complaint
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateComplaint} className="flex flex-col flex-1 overflow-hidden">
              <div className="space-y-4 py-4 px-1 overflow-y-auto flex-1 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Company / Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <CustomerCombobox
                    value={formCustomerName}
                    onChange={val => {
                      setFormCustomerName(val);
                      if (formErrors.customerName) setFormErrors(prev => ({ ...prev, customerName: false }));
                    }}
                    onSelectCustomer={handleSelectCustomerForCreate}
                    customers={customerDirectory}
                    placeholder="Search or enter company name..."
                    required
                  />
                  {formErrors.customerName && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">Please select or enter customer name.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Complaint Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formType}
                      onChange={e => {
                        setFormType(e.target.value);
                        if (formErrors.type) setFormErrors(prev => ({ ...prev, type: false }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer">
                      <option value="Quality Defect">Quality Defect</option>
                      <option value="Physical Damage">Physical Damage</option>
                      <option value="Billing Mismatch">Billing Mismatch</option>
                      <option value="Delivery Delay">Delivery Delay</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Affected Product</label>
                    <input
                      type="text"
                      placeholder="e.g. CR Sheet 2mm"
                      value={formProduct}
                      onChange={e => setFormProduct(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Complaint Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the complaint details..."
                    value={formDescription}
                    onChange={e => {
                      setFormDescription(e.target.value);
                      if (formErrors.description) setFormErrors(prev => ({ ...prev, description: false }));
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all font-medium ${formErrors.description ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                  />
                  {formErrors.description && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">Please enter complaint description.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Initial Status <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formStatus}
                      onChange={e => {
                        setFormStatus(e.target.value);
                        if (formErrors.status) setFormErrors(prev => ({ ...prev, status: false }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer">
                      <option value="reported">Pending (Open)</option>
                      <option value="resolved">Resolved (Closed)</option>
                    </select>
                  </div>

                  {formStatus === 'resolved' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Resolution Notes</label>
                      <input
                        type="text"
                        placeholder="Resolution details..."
                        value={formResolutionNotes}
                        onChange={e => setFormResolutionNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons with Pill-Shaped "Save" Button */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all shadow-2xs cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || isSavedSuccess}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50">
                  <Save size={16} />
                  {submitting ? 'Saving...' : isSavedSuccess ? 'Saved!' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
