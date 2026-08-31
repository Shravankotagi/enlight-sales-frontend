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
  Hash,
} from 'lucide-react';
import { complaintsApi, employeesApi, customersApi, dealsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  getFirstDayOfMonth,
  getLastDayOfMonth,
  formatLocalDate,
  getDaysAgo,
} from '../utils/dateUtils';
import CustomerCombobox, { type CustomerDirectoryItem } from '../components/CustomerCombobox';
import DealProductCombobox, { type SelectedDealItem } from '../components/DealProductCombobox';

interface Complaint {
  id: string;
  customer_name: string;
  deal_id?: string | null;
  po_number?: string | null;
  product_name?: string | null;
  affected_product?: string | null;
  complaint_type?: string | null;
  description?: string | null;
  corrective_action?: string | null;
  status: 'reported' | 'resolved' | 'reopened' | 'open' | string;
  resolution_notes?: string | null;
  created_at?: string | null;
  reported_at?: string | null;
  resolved_at?: string | null;
  reported_by?: string | null;
  salesperson_name?: string | null;
}

export function formatComplaintDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-IN', { month: 'short' });
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const formattedHours = String(hours).padStart(2, '0');
  return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
}

export default function ComplaintsPage() {
  const { isSalesManager, isAdmin, effectivePhone } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Date Filter Presets
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
  const [editSelectedDeals, setEditSelectedDeals] = useState<SelectedDealItem[]>([]);
  const [editType, setEditType] = useState('Quality Defect');
  const [editDescription, setEditDescription] = useState('');
  const [editCorrectiveAction, setEditCorrectiveAction] = useState('');
  const [editStatus, setEditStatus] = useState('reported');
  const [editResolutionNotes, setEditResolutionNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editCustomerDeals, setEditCustomerDeals] = useState<any[]>([]);

  // Create Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formSelectedDeals, setFormSelectedDeals] = useState<SelectedDealItem[]>([]);
  const [formType, setFormType] = useState('Quality Defect');
  const [formDescription, setFormDescription] = useState('');
  const [formCorrectiveAction, setFormCorrectiveAction] = useState('');
  const [formStatus, setFormStatus] = useState('reported');
  const [formResolutionNotes, setFormResolutionNotes] = useState('');
  const [customerDeals, setCustomerDeals] = useState<any[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

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
        if (clean) map.set(clean, emp.name || emp.full_name || 'Sales Rep');
      }
    });
    return map;
  }, [employees]);

  const customerDirectory = useMemo<CustomerDirectoryItem[]>(() => {
    const dirMap = new Map<string, CustomerDirectoryItem>();

    customers.forEach(c => {
      const rawName = (c?.customer_name || c?.name || '').trim();
      if (!rawName) return;
      dirMap.set(rawName.toLowerCase(), {
        id: c.id,
        customer_name: rawName,
        contact_phone: c?.customer_phone || c?.phone || undefined,
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

  // Fetch won deals when customer is chosen in Create Form
  useEffect(() => {
    if (!formCustomerName.trim()) {
      setCustomerDeals([]);
      return;
    }
    let isMounted = true;
    setLoadingDeals(true);
    dealsApi
      .getAll({ customer_name: formCustomerName.trim(), stage: 'won' })
      .then(res => {
        if (!isMounted) return;
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        // Strict client-side won filter guard
        const wonList = list.filter((d: any) => (d?.stage || '').toLowerCase() === 'won');
        setCustomerDeals(wonList);
      })
      .catch(() => {
        if (isMounted) setCustomerDeals([]);
      })
      .finally(() => {
        if (isMounted) setLoadingDeals(false);
      });

    return () => {
      isMounted = false;
    };
  }, [formCustomerName]);

  // Fetch won deals when customer is chosen in Edit Form
  useEffect(() => {
    if (!editCustomerName.trim()) {
      setEditCustomerDeals([]);
      return;
    }
    dealsApi
      .getAll({ customer_name: editCustomerName.trim(), stage: 'won' })
      .then(res => {
        const raw = res?.data;
        const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        const wonList = list.filter((d: any) => (d?.stage || '').toLowerCase() === 'won');
        setEditCustomerDeals(wonList);
      })
      .catch(() => setEditCustomerDeals([]));
  }, [editCustomerName]);

  const handleSelectCustomerForCreate = (cust: CustomerDirectoryItem) => {
    setFormCustomerName(cust.customer_name);
    setFormSelectedDeals([]);
    if (formErrors.customerName) setFormErrors(prev => ({ ...prev, customerName: false }));
  };

  const handleSelectCustomerForEdit = (cust: CustomerDirectoryItem) => {
    setEditCustomerName(cust.customer_name);
    setEditSelectedDeals([]);
  };

  const getSalespersonDisplayName = (comp: Complaint) => {
    if (comp.salesperson_name && comp.salesperson_name !== comp.reported_by) {
      return comp.salesperson_name;
    }
    if (comp.reported_by) {
      const cleanPhone = comp.reported_by.replace(/\D/g, '').slice(-10);
      if (cleanPhone && employeeMap.has(cleanPhone)) {
        return employeeMap.get(cleanPhone) || 'Sales Rep';
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
      if (effectivePhone) params.salesperson_phone = effectivePhone;
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
  }, [dateRange, effectivePhone]);

  const handleOpenAddModal = () => {
    setFormCustomerName('');
    setFormSelectedDeals([]);
    setFormType('Quality Defect');
    setFormDescription('');
    setFormCorrectiveAction('');
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
    if (formSelectedDeals.length === 0) errors.deals = true;
    if (!formType) errors.type = true;
    if (!formDescription.trim()) errors.description = true;
    if (!formStatus) errors.status = true;
    if (formStatus === 'resolved' && !formResolutionNotes.trim()) {
      errors.resolutionNotes = true;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.deals) {
        toast.error('Please select at least one Won Deal / PO & Product.');
      } else if (errors.resolutionNotes) {
        toast.error('Resolution notes are required when status is marked as Resolved.');
      }
      return;
    }

    try {
      setSubmitting(true);

      const primaryDeal = formSelectedDeals[0];
      const combinedProducts = formSelectedDeals.map(d => d.product).filter(Boolean).join(', ');
      const combinedPoNumbers = Array.from(new Set(formSelectedDeals.map(d => d.poNumber).filter(Boolean))).join(', ');

      await complaintsApi.create({
        customer_name: formCustomerName.trim(),
        deal_id: primaryDeal ? primaryDeal.dealId : null,
        po_number: combinedPoNumbers || null,
        product_name: combinedProducts || 'General Material',
        affected_product: combinedProducts || 'General Material',
        complaint_type: formType,
        description: formDescription.trim(),
        corrective_action: formCorrectiveAction.trim() || null,
        status: formStatus,
        resolution_notes: formResolutionNotes.trim() || null,
      });

      setIsSavedSuccess(true);
      toast.success('Complaint logged successfully!');

      setTimeout(() => {
        setIsSavedSuccess(false);
        setShowCreateModal(false);
        setFormCustomerName('');
        setFormSelectedDeals([]);
        setFormType('Quality Defect');
        setFormDescription('');
        setFormCorrectiveAction('');
        setFormStatus('reported');
        setFormResolutionNotes('');
        setFormErrors({});
        fetchComplaints();
      }, 500);
    } catch (err: any) {
      console.error('Error creating complaint:', err);
      toast.error(err?.response?.data?.message || 'Failed to log complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (comp: Complaint) => {
    setEditingComplaint(comp);
    setEditCustomerName(comp.customer_name || '');

    if (comp.deal_id) {
      const cleanId = comp.deal_id.startsWith('DEAL-') ? comp.deal_id.replace(/^DEAL-/, '') : comp.deal_id.substring(0, 6).toUpperCase();
      const product = comp.product_name || comp.affected_product || 'General Material';
      setEditSelectedDeals([
        {
          dealId: comp.deal_id,
          dealCode: `#DEAL-${cleanId}`,
          poNumber: comp.po_number || '',
          product: product,
          fullLabel: `#DEAL-${cleanId} — ${product}`,
        },
      ]);
    } else {
      setEditSelectedDeals([]);
    }

    setEditType(comp.complaint_type || 'Quality Defect');
    setEditDescription(comp.description || '');
    setEditCorrectiveAction(comp.corrective_action || '');
    setEditStatus(comp.status || 'reported');
    setEditResolutionNotes(comp.resolution_notes || '');
  };

  // Save Edited Complaint
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComplaint || !editCustomerName.trim()) return;

    if (editSelectedDeals.length === 0) {
      toast.error('Please select at least one Won Deal / PO & Product.');
      return;
    }

    if (editStatus === 'resolved' && !editResolutionNotes.trim()) {
      toast.error('Resolution notes are required when status is marked as Resolved.');
      return;
    }

    try {
      setEditSaving(true);
      const primaryDeal = editSelectedDeals[0];
      const combinedProducts = editSelectedDeals.map(d => d.product).filter(Boolean).join(', ');
      const combinedPoNumbers = Array.from(new Set(editSelectedDeals.map(d => d.poNumber).filter(Boolean))).join(', ');

      const updatedPayload: any = {
        customer_name: editCustomerName.trim(),
        deal_id: primaryDeal ? primaryDeal.dealId : null,
        po_number: combinedPoNumbers || null,
        product_name: combinedProducts || 'General Material',
        affected_product: combinedProducts || 'General Material',
        complaint_type: editType,
        description: editDescription.trim(),
        corrective_action: editCorrectiveAction.trim() || null,
        status: editStatus,
        resolution_notes: editResolutionNotes.trim() || null,
      };

      await complaintsApi.update(editingComplaint.id, updatedPayload);

      // If this complaint was open in the details modal, update it too
      if (selectedComplaint && selectedComplaint.id === editingComplaint.id) {
        setSelectedComplaint(prev => (prev ? { ...prev, ...updatedPayload } : null));
      }

      setEditingComplaint(null);
      toast.success('Complaint updated successfully!');
      fetchComplaints();
    } catch (err: any) {
      console.error('Error updating complaint:', err);
      toast.error(err?.response?.data?.message || 'Failed to update complaint.');
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
    const notes = modalResolutionNotes.trim();
    if (!notes) {
      toast.error('Resolution notes are required before marking complaint as resolved.');
      return;
    }

    try {
      setModalActionLoading(true);
      await complaintsApi.update(selectedComplaint.id, {
        status: 'resolved',
        resolution_notes: notes,
      });
      setSelectedComplaint(prev =>
        prev ? { ...prev, status: 'resolved', resolution_notes: notes, resolved_at: new Date().toISOString() } : null,
      );
      toast.success('Complaint marked as resolved!');
      fetchComplaints();
    } catch (err: any) {
      console.error('Error resolving complaint in modal:', err);
      toast.error(err?.response?.data?.message || 'Failed to resolve complaint.');
    } finally {
      setModalActionLoading(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center justify-center">
          Resolved
        </span>
      );
    }
    if (s === 'reopened') {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 inline-flex items-center justify-center">
          Reopened
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center">
        Pending
      </span>
    );
  };

  // Reopen inside Details Modal
  const handleReopenInModal = async () => {
    if (!selectedComplaint) return;
    try {
      setModalActionLoading(true);
      await complaintsApi.update(selectedComplaint.id, {
        status: 'reopened',
      });
      setSelectedComplaint(prev => (prev ? { ...prev, status: 'reopened' } : null));
      toast.success('Complaint reopened!');
      fetchComplaints();
    } catch (err: any) {
      console.error('Error reopening complaint in modal:', err);
      toast.error(err?.response?.data?.message || 'Failed to reopen complaint.');
    } finally {
      setModalActionLoading(false);
    }
  };

  const safeComplaints = Array.isArray(complaints) ? complaints : [];

  // Filter complaints
  const filtered = safeComplaints.filter(c => {
    const timeToTest = c.created_at || c.reported_at;
    if (dateRange.from && dateRange.to && timeToTest) {
      const dateStr = timeToTest;
      const complaintDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      if (complaintDate < dateRange.from || complaintDate > dateRange.to) {
        return false;
      }
    }

    if (filterStatus !== 'all') {
      const s = (c.status || '').toLowerCase();
      if (filterStatus === 'pending') {
        if (s !== 'reported' && s !== 'pending' && s !== 'open') return false;
      } else if (filterStatus === 'resolved') {
        if (s !== 'resolved') return false;
      } else if (filterStatus === 'reopened') {
        if (s !== 'reopened') return false;
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const customer = (c.customer_name || '').toLowerCase();
      const desc = (c.description || '').toLowerCase();
      const type = (c.complaint_type || '').toLowerCase();
      const prod = (c.product_name || c.affected_product || '').toLowerCase();
      const dealId = (c.deal_id || '').toLowerCase();
      const poNum = (c.po_number || '').toLowerCase();
      const rep = (getSalespersonDisplayName(c) || '').toLowerCase();

      return (
        customer.includes(term) ||
        desc.includes(term) ||
        type.includes(term) ||
        prod.includes(term) ||
        dealId.includes(term) ||
        poNum.includes(term) ||
        rep.includes(term)
      );
    }

    return true;
  });

  const totalCount = safeComplaints.length;
  const pendingCount = safeComplaints.filter(c => {
    const s = (c.status || '').toLowerCase();
    return s === 'reported' || s === 'pending' || s === 'open';
  }).length;
  const resolvedCount = safeComplaints.filter(c => (c.status || '').toLowerCase() === 'resolved').length;
  const reopenedCount = safeComplaints.filter(c => (c.status || '').toLowerCase() === 'reopened').length;

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedComplaints = filtered.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
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
            className="px-2 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
            <Plus size={15} />
            Log Complaint
          </button>
        </div>
      </div>

      {/* Stats Cards (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            <p className="text-xs text-slate-500 font-medium">Pending</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Reopened</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{reopenedCount}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <RefreshCw size={22} />
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
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* 1. Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={canViewSalesperson ? 'Search Customer, Deal, PO, Issue, Rep...' : 'Search Customer, Deal, PO, Issue, Product...'}
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

          {/* 2. Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            {['all', 'pending', 'reopened', 'resolved'].map(status => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setFilterStatus(status);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${filterStatus === status
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Preset Date Dropdown & Custom Range Pickers */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative">
            <select
              value={dayPreset}
              onChange={e => handleDayPresetChange(e.target.value)}
              className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {showCustomDate && (
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 p-1 border border-slate-200 rounded-xl">
              <input
                type="date"
                value={customFrom}
                onChange={e => handleCustomFromChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none text-xs font-medium"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={e => handleCustomToChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none text-xs font-medium"
              />
            </div>
          )}
        </div>
      </div>

      {/* Complaints Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3.5 text-center w-12">#</th>
                <th className="px-5 py-3.5 text-left min-w-[220px]">Customer</th>
                <th className="px-4 py-3.5 text-left min-w-[190px]">Deal / PO &amp; Product</th>
                <th className="px-4 py-3.5 text-left min-w-[160px]">Date &amp; Time</th>
                <th className="px-4 py-3.5 text-center min-w-[120px]">Status</th>
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
                    <AlertTriangle size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No complaints found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting the filters or log a new complaint.</p>
                  </td>
                </tr>
              ) : (
                paginatedComplaints.map((comp, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const salespersonName = getSalespersonDisplayName(comp);
                  const prodDisplay = comp.product_name || comp.affected_product || '';
                  const cleanDealCode = comp.deal_id
                    ? (comp.deal_id.startsWith('DEAL-') ? comp.deal_id.replace(/^DEAL-/, '') : comp.deal_id.substring(0, 6).toUpperCase())
                    : '';

                  return (
                    <tr
                      key={comp.id || idx}
                      onClick={() => openComplaintDetails(comp)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors group">
                      {/* 0. Serial Number */}
                      <td className="px-3 py-3.5 font-medium text-slate-500 text-center">
                        {globalIdx}
                      </td>

                      {/* 1. Customer (+ Sales Rep) */}
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

                      {/* 2. Deal / PO & Product */}
                      <td className="px-4 py-3.5 text-xs">
                        {cleanDealCode ? (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                                #{`DEAL-${cleanDealCode}`}
                              </span>
                              {comp.po_number && (
                                <span className="font-mono text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                                  PO: {comp.po_number}
                                </span>
                              )}
                            </div>
                            {prodDisplay && (
                              <div className="text-slate-600 font-medium mt-1 truncate max-w-[220px]">
                                {prodDisplay}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <Package size={13} className="text-blue-500 shrink-0" />
                            <span className="truncate max-w-[220px]">{prodDisplay || 'General Steel Material'}</span>
                          </div>
                        )}
                      </td>

                      {/* 3. Date & Time */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          {formatComplaintDateTime(comp.created_at || comp.reported_at)}
                        </div>
                      </td>

                      {/* 4. Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {renderStatusBadge(comp.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
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

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto space-y-4">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedComplaint.customer_name}</h2>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {formatComplaintDateTime(selectedComplaint.created_at || selectedComplaint.reported_at)}
                  </span>
                  {canViewSalesperson && (
                    <span>
                      • Rep: <strong className="text-slate-700">{getSalespersonDisplayName(selectedComplaint)}</strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {renderStatusBadge(selectedComplaint.status)}
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                  title="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Info Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              {/* Linked Deal / PO */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs font-medium text-slate-400 mb-1">Linked Won Deal &amp; PO</p>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                  <Hash size={14} className="text-blue-600 shrink-0" />
                  {selectedComplaint.deal_id ? (
                    <span className="font-mono text-blue-700">
                      #{selectedComplaint.deal_id.startsWith('DEAL-') ? selectedComplaint.deal_id : `DEAL-${selectedComplaint.deal_id.substring(0, 6).toUpperCase()}`}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-normal">Won Order</span>
                  )}
                  {selectedComplaint.po_number && (
                    <span className="text-xs font-mono font-semibold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                      PO: {selectedComplaint.po_number}
                    </span>
                  )}
                </div>
              </div>

              {/* Complaint Type */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <p className="text-xs font-medium text-slate-400 mb-1">Complaint Type</p>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  {selectedComplaint.complaint_type || 'Quality Defect'}
                </div>
              </div>

              {/* Product Name */}
              {(selectedComplaint.product_name || selectedComplaint.affected_product) && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 col-span-1 sm:col-span-2">
                  <p className="text-xs font-medium text-slate-400 mb-1">Product(s) Affected</p>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Package size={14} className="text-blue-600 shrink-0" />
                    {selectedComplaint.product_name || selectedComplaint.affected_product}
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

            {/* Corrective Action if present */}
            {selectedComplaint.corrective_action && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-1 shrink-0">
                <p className="text-amber-900 font-semibold">Corrective Action Taken:</p>
                <p className="text-amber-800">{selectedComplaint.corrective_action}</p>
              </div>
            )}

            {/* Resolution Workspace */}
            <div className="p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5 shrink-0">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-blue-600" />
                Resolution Notes <span className="text-rose-500">*</span>
              </p>

              {selectedComplaint.status === 'resolved' ? (
                <div className="space-y-1.5">
                  <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg leading-relaxed">
                    {selectedComplaint.resolution_notes || 'Marked as resolved.'}
                  </p>
                  {selectedComplaint.resolved_at && (
                    <p className="text-[11px] text-slate-500">
                      Resolved on {formatComplaintDateTime(selectedComplaint.resolved_at)}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Enter resolution notes before resolving..."
                    value={modalResolutionNotes}
                    onChange={e => setModalResolutionNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Resolution notes are mandatory before marking as resolved.</p>
                </div>
              )}
            </div>

            {/* Modal Bottom Right Action Buttons */}
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
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
              <div className="space-y-3.5 py-4 px-1 overflow-y-auto flex-1 text-xs">
                {/* 1. Customer Combobox */}
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

                {/* 2. Multi-Select Won Deal ID / PO Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Linked Deal ID / PO Number &amp; Product <span className="text-rose-500">*</span>
                  </label>
                  <DealProductCombobox
                    deals={editCustomerDeals}
                    selectedItems={editSelectedDeals}
                    onChange={setEditSelectedDeals}
                    required
                  />
                </div>

                {/* 3. Complaint Type */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Complaint Type <span className="text-rose-500">*</span></label>
                  <div className="relative flex items-center">
                    <select
                      value={editType}
                      onChange={e => setEditType(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer appearance-none">
                      <option value="Quality Defect">Quality Defect</option>
                      <option value="Physical Damage">Physical Damage</option>
                      <option value="Quantity Shortage">Quantity Shortage</option>
                      <option value="Delivery Delay">Delivery Delay / Wrong Delivery</option>
                      <option value="Billing Mismatch">Billing / Invoicing Dispute</option>
                      <option value="Specification Mismatch">Specification Mismatch</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* 4. Description */}
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

                {/* 5. Corrective Action */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Corrective Action Taken</label>
                  <input
                    type="text"
                    placeholder="e.g. Replacement batch dispatched / Credit note issued"
                    value={editCorrectiveAction}
                    onChange={e => setEditCorrectiveAction(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* 6. Status & Resolution Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status <span className="text-rose-500">*</span></label>
                    <div className="relative flex items-center">
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer appearance-none">
                        <option value="reported">Pending (Open)</option>
                        <option value="reopened">Reopened</option>
                        <option value="resolved">Resolved (Closed)</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Resolution Notes {editStatus === 'resolved' && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="Resolution details..."
                      value={editResolutionNotes}
                      onChange={e => setEditResolutionNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      required={editStatus === 'resolved'}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
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
              <div className="space-y-3.5 py-4 px-1 overflow-y-auto flex-1 text-xs">
                {/* 1. Customer Combobox */}
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

                {/* 2. Mandatory Multi-Select Won Deal ID / PO Number Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Linked Deal ID / PO Number &amp; Product <span className="text-rose-500">*</span>
                  </label>
                  <DealProductCombobox
                    deals={customerDeals}
                    selectedItems={formSelectedDeals}
                    onChange={items => {
                      setFormSelectedDeals(items);
                      if (formErrors.deals) setFormErrors(prev => ({ ...prev, deals: false }));
                    }}
                    loading={loadingDeals}
                    error={formErrors.deals}
                    required
                  />
                  {formErrors.deals && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">Please select at least one Won Deal / PO &amp; Product.</p>
                  )}
                </div>

                {/* 3. Complaint Type */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Complaint Type <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <select
                      value={formType}
                      onChange={e => {
                        setFormType(e.target.value);
                        if (formErrors.type) setFormErrors(prev => ({ ...prev, type: false }));
                      }}
                      className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer appearance-none">
                      <option value="Quality Defect">Quality Defect</option>
                      <option value="Physical Damage">Physical Damage</option>
                      <option value="Quantity Shortage">Quantity Shortage</option>
                      <option value="Delivery Delay">Delivery Delay / Wrong Delivery</option>
                      <option value="Billing Mismatch">Billing / Invoicing Dispute</option>
                      <option value="Specification Mismatch">Specification Mismatch</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* 4. Description */}
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

                {/* 5. Corrective Action */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Corrective Action Taken</label>
                  <input
                    type="text"
                    placeholder="e.g. Replacement dispatched / Inspection scheduled"
                    value={formCorrectiveAction}
                    onChange={e => setFormCorrectiveAction(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                {/* 6. Initial Status & Resolution Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Initial Status <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <select
                        value={formStatus}
                        onChange={e => {
                          setFormStatus(e.target.value);
                          if (formErrors.status) setFormErrors(prev => ({ ...prev, status: false }));
                        }}
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium cursor-pointer appearance-none">
                        <option value="reported">Pending (Open)</option>
                        <option value="resolved">Resolved (Closed)</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {formStatus === 'resolved' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Resolution Notes <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Resolution details..."
                        value={formResolutionNotes}
                        onChange={e => setFormResolutionNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
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
