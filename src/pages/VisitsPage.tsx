import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ThumbsUp,
  RefreshCw,
  X,
  User,
  Phone,
  Map as MapIcon,
  Edit2,
  Trash2,
  Calendar,
  MoreVertical,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { visitsApi, employeesApi, customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  formatLocalDate,
  getDaysAgo,
} from '../utils/dateUtils';
import CustomerCombobox, { type CustomerDirectoryItem } from '../components/CustomerCombobox';

interface CustomerVisit {
  id: string;
  customer_name: string;
  person_met?: string;
  contact_phone?: string;
  contact_no?: string;
  location?: string;
  customer_address?: string;
  outcome?: 'positive' | 'neutral' | 'negative' | string;
  remarks?: string;
  raw_remarks?: string;
  material_requirement?: string;
  requirement?: string;
  follow_up_action?: string;
  follow_up?: string;
  followup?: string;
  visited_at: string;
  salesperson_phone?: string;
  salesperson_name?: string;
}

export function formatCityLocality(rawLocation?: string, rawAddress?: string): string {
  const str = (rawLocation || rawAddress || '').trim();
  if (!str || str === '-' || str.toLowerCase() === 'null') return '-';

  // Clean up pin codes, trailing states/countries
  const cleaned = str
    .replace(/,\s*India\b/i, '')
    .replace(/,\s*Maharashtra\b/i, '')
    .replace(/\b\d{6}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, '');

  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 2) {
    return parts.join(', ');
  }
  return parts.slice(-2).join(', ');
}

export default function VisitsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetVisitId = searchParams.get('visitId') || searchParams.get('id');
  const returnTo = searchParams.get('returnTo');

  const { isSalesManager, isAdmin, effectivePhone, activeRole, activeMode } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Date Filter Presets (Matching Inquiry tab pattern)
  const [dayPreset, setDayPreset] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomDate, setShowCustomDate] = useState<boolean>(false);

  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({
    from: undefined,
    to: undefined,
  });

  const handleDayPresetChange = (preset: string) => {
    setDayPreset(preset);
    if (preset === 'all') {
      setDateRange({ from: undefined, to: undefined });
      setShowCustomDate(false);
      setCustomFrom('');
      setCustomTo('');
    } else if (preset === 'today') {
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

  // Close active action dropdown when clicking outside
  useEffect(() => {
    if (!activeActionMenuId) return;
    const handleClickOutside = () => setActiveActionMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeActionMenuId]);

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

  // Fetch customers list for combobox & autofill
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

  // Build unified customer directory combining registered customers + existing visits
  const customerDirectory = useMemo<CustomerDirectoryItem[]>(() => {
    const dirMap = new Map<string, CustomerDirectoryItem>();

    customers.forEach(c => {
      const rawName = (c?.customer_name || '').trim();
      if (!rawName) return;
      const key = rawName.toLowerCase();

      let contactPerson = (c?.contact_person || '').trim();
      if (!contactPerson && c?.notes) {
        const match = c.notes.match(/Contact:\s*([^|]+)/i);
        if (match && match[1]) contactPerson = match[1].trim();
      }

      const phone = (c?.contact_phone || c?.phone || '').trim();
      const loc = (c?.location || c?.address || '').trim();

      dirMap.set(key, {
        id: c.id,
        customer_name: rawName,
        contact_person: contactPerson || undefined,
        contact_phone: phone || undefined,
        location: loc || undefined,
      });
    });

    visits.forEach(v => {
      const rawName = (v?.customer_name || '').trim();
      if (!rawName) return;
      const key = rawName.toLowerCase();
      const existing = dirMap.get(key);

      const personMet =
        v.person_met && v.person_met !== 'null' && v.person_met !== 'Contact Person'
          ? v.person_met.trim()
          : undefined;
      const phone = (v.contact_phone || v.contact_no || '').trim();
      const loc = (v.location || v.customer_address || '').trim();

      if (!existing) {
        dirMap.set(key, {
          id: v.id,
          customer_name: rawName,
          contact_person: personMet,
          contact_phone: phone || undefined,
          location: loc || undefined,
        });
      } else {
        if (!existing.contact_person && personMet) existing.contact_person = personMet;
        if (!existing.contact_phone && phone) existing.contact_phone = phone;
        if (!existing.location && loc) existing.location = loc;
      }
    });

    return Array.from(dirMap.values()).sort((a, b) =>
      a.customer_name.localeCompare(b.customer_name)
    );
  }, [customers, visits]);

  const handleSelectCustomerForCreate = (cust: CustomerDirectoryItem) => {
    setFormCustomerName(cust.customer_name);
    if (formErrors.customerName) setFormErrors(prev => ({ ...prev, customerName: false }));
    if (cust.contact_person) {
      setFormPersonMet(cust.contact_person);
      if (formErrors.personMet) setFormErrors(prev => ({ ...prev, personMet: false }));
    }
    if (cust.contact_phone) {
      setFormContactPhone(cust.contact_phone);
      if (formErrors.contactPhone) setFormErrors(prev => ({ ...prev, contactPhone: false }));
    }
    if (cust.location && !formLocation) {
      setFormLocation(cust.location);
      if (formErrors.location) setFormErrors(prev => ({ ...prev, location: false }));
    }
  };

  const handleSelectCustomerForEdit = (cust: CustomerDirectoryItem) => {
    setEditCustomerName(cust.customer_name);
    if (cust.contact_person) setEditPersonMet(cust.contact_person);
    if (cust.contact_phone) setEditContactPhone(cust.contact_phone);
    if (cust.location && !editLocation) setEditLocation(cust.location);
  };

  const getSalespersonDisplayName = (v: CustomerVisit) => {
    if (v.salesperson_name && v.salesperson_name !== v.salesperson_phone) {
      return v.salesperson_name;
    }
    if (v.salesperson_phone) {
      const cleanPhone = v.salesperson_phone.replace(/\D/g, '').slice(-10);
      if (cleanPhone && employeeMap.has(cleanPhone)) {
        return employeeMap.get(cleanPhone);
      }
      return v.salesperson_phone;
    }
    return null;
  };

  // Details & Edit Modal States
  const [selectedVisit, setSelectedVisit] = useState<CustomerVisit | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Auto-open requested visit modal if navigated with ?visitId=... or ?id=...
  useEffect(() => {
    if (!targetVisitId) return;
    const found = visits.find(
      (v) => String(v.id) === targetVisitId || String(v.id).includes(targetVisitId),
    );
    if (found) {
      setSelectedVisit(found);
      setIsEditing(false);
    } else if (visits.length > 0) {
      visitsApi
        .getAll()
        .then((res) => {
          const raw = res?.data;
          const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
          const match = list.find((v: any) => String(v.id) === targetVisitId || String(v.id).includes(targetVisitId));
          if (match) {
            setSelectedVisit(match);
            setIsEditing(false);
          }
        })
        .catch((err) => {
          console.warn('Could not auto-open requested visit:', err);
        });
    }
  }, [targetVisitId, visits]);

  // Create Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPersonMet, setFormPersonMet] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formOutcome, setFormOutcome] = useState('positive');
  const [formRemarks, setFormRemarks] = useState('');
  const [formFollowup, setFormFollowup] = useState('');
  const [formVisitDate, setFormVisitDate] = useState(formatLocalDate());
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Reset form and open Add New Visit modal cleanly
  const handleOpenAddModal = () => {
    setFormCustomerName('');
    setFormPersonMet('');
    setFormContactPhone('');
    setFormLocation('');
    setFormOutcome('positive');
    setFormRemarks('');
    setFormFollowup('');
    setFormVisitDate(formatLocalDate());
    setFormErrors({});
    setIsSavedSuccess(false);
    setShowModal(true);
  };

  // Edit Form state
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPersonMet, setEditPersonMet] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOutcome, setEditOutcome] = useState('positive');
  const [editRemarks, setEditRemarks] = useState('');
  const [editFollowup, setEditFollowup] = useState('');
  const [editVisitDate, setEditVisitDate] = useState(formatLocalDate());

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (activeMode) params.mode = activeMode;
      const res = await visitsApi.getAll(params);
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      setVisits(list);
    } catch (err) {
      console.error('Error fetching visits:', err);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
    const interval = setInterval(fetchVisits, 5000);
    return () => clearInterval(interval);
  }, [dateRange, effectivePhone, activeRole, activeMode]);

  useEffect(() => {
    const handleDbChange = (e: any) => {
      const { table } = e.detail || {};
      if (table === 'customer_visits') {
        fetchVisits();
      }
    };
    window.addEventListener('enlight-db-change', handleDbChange);
    return () => window.removeEventListener('enlight-db-change', handleDbChange);
  }, [dateRange, effectivePhone, activeRole, activeMode]);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Required Field Validation & Highlighting
    const errors: Record<string, boolean> = {};
    if (!formCustomerName.trim()) errors.customerName = true;
    if (!formPersonMet.trim()) errors.personMet = true;
    if (!formContactPhone.trim()) errors.contactPhone = true;
    if (!formLocation.trim()) errors.location = true;
    if (!formVisitDate) errors.visitDate = true;
    if (!formOutcome) errors.outcome = true;
    if (!formRemarks.trim()) errors.remarks = true;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      await visitsApi.create({
        customer_name: formCustomerName.trim(),
        person_met: formPersonMet.trim(),
        contact_phone: formContactPhone.trim(),
        location: formLocation.trim(),
        outcome: formOutcome,
        remarks: formRemarks.trim(),
        follow_up_action: formFollowup.trim(),
        visited_at: new Date(formVisitDate).toISOString(),
      });

      setIsSavedSuccess(true);
      toast.success('Visit log saved successfully!');

      setTimeout(() => {
        setIsSavedSuccess(false);
        setShowModal(false);
        setSelectedVisit(null);
        setFormCustomerName('');
        setFormPersonMet('');
        setFormContactPhone('');
        setFormLocation('');
        setFormOutcome('positive');
        setFormRemarks('');
        setFormFollowup('');
        setFormVisitDate(formatLocalDate());
        setFormErrors({});
        fetchVisits();
      }, 500);
    } catch (err: any) {
      console.error('Error creating visit:', err);
      toast.error('Failed to save visit log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getNormalizedOutcome = (v: any) => {
    const o = (v?.outcome || '').toLowerCase();
    const r = (v?.remarks || '').toLowerCase();
    if (o === 'neutral' || r.includes('neutral')) return 'neutral';
    if (o === 'negative' || o === 'closed' || r.includes('negative') || r.includes('closed')) return 'negative';
    return 'positive';
  };

  const openVisitDetails = (v: CustomerVisit, editMode = false) => {
    setSelectedVisit(v);
    setIsEditing(editMode);
    setEditCustomerName(v.customer_name || '');
    setEditPersonMet(v.person_met && v.person_met !== 'null' ? v.person_met : '');
    setEditContactPhone(v.contact_phone || (v as any).contact_no || '');
    setEditLocation(v.location || (v as any).customer_address || '');
    setEditVisitDate(
      v.visited_at ? new Date(v.visited_at).toISOString().split('T')[0] : formatLocalDate(),
    );
    setEditOutcome(getNormalizedOutcome(v));
    const remarksSource = v.remarks || v.raw_remarks || '';
    setEditRemarks(
      remarksSource
        .replace(/\[(Outcome|Requirement|FollowUp|Follow-up|Interests|Location):\s*[^\]]+\]\s*/gi, '')
        .trim(),
    );
    setEditFollowup(v.follow_up_action || (v as any).followup || (v as any).follow_up || '');
  };

  const handleUpdateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit || !editCustomerName.trim()) return;

    try {
      setActionLoading(true);
      const cleanRemarks = editRemarks.trim();
      const updatedData = {
        customer_name: editCustomerName.trim(),
        person_met: editPersonMet.trim(),
        contact_phone: editContactPhone.trim(),
        contact_no: editContactPhone.trim(),
        location: editLocation.trim(),
        customer_address: editLocation.trim(),
        outcome: editOutcome,
        remarks: cleanRemarks,
        raw_remarks: cleanRemarks,
        follow_up_action: editFollowup.trim(),
        visited_at: new Date(editVisitDate).toISOString(),
      };

      await visitsApi.update(selectedVisit.id, updatedData);

      const updatedObj: CustomerVisit = {
        ...selectedVisit,
        ...updatedData,
      };

      setVisits(prev => prev.map(item => (item.id === selectedVisit.id ? updatedObj : item)));
      setSelectedVisit(null);
      setIsEditing(false);
      toast.success('Visit details updated successfully!');
      await fetchVisits();
    } catch (err) {
      console.error('Error updating visit:', err);
      toast.error('Failed to update visit details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const executeDeleteVisit = async () => {
    if (!selectedVisit) return;

    try {
      setActionLoading(true);
      await visitsApi.delete(selectedVisit.id);
      setVisits(prev => prev.filter(item => item.id !== selectedVisit.id));
      setShowDeleteModal(false);
      setSelectedVisit(null);
      toast.success('Visit record deleted');
      fetchVisits();
    } catch (err) {
      console.error('Error deleting visit:', err);
      toast.error('Failed to delete visit record.');
    } finally {
      setActionLoading(false);
    }
  };

  const safeVisits = Array.isArray(visits) ? visits : [];

  // Filter visits by date range, search, & outcome
  const filtered = safeVisits.filter(v => {
    if (dateRange.from && dateRange.to) {
      const dateStr = v.visited_at;
      if (dateStr) {
        const itemDate = new Date(dateStr).toISOString().split('T')[0];
        if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
      }
    }

    const repName = getSalespersonDisplayName(v) || '';
    const matchesSearch =
      (v?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.person_met || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.customer_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.follow_up_action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v?.material_requirement || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      repName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOutcome = filterOutcome === 'all' || (v?.outcome || '').toLowerCase() === filterOutcome.toLowerCase();
    return matchesSearch && matchesOutcome;
  });

  const totalVisits = visits.length;
  const positiveVisits = visits.filter(v => getNormalizedOutcome(v) === 'positive').length;
  const neutralVisits = visits.filter(v => getNormalizedOutcome(v) === 'neutral').length;
  const negativeVisits = visits.filter(v => getNormalizedOutcome(v) === 'negative').length;

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOutcome, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedVisits = filtered.slice(startIndex, startIndex + pageSize);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterOutcome('all');
    setDayPreset('all');
    setShowCustomDate(false);
    setCustomFrom('');
    setCustomTo('');
    setDateRange({
      from: undefined,
      to: undefined,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] space-y-4 animate-fade-in font-sans">
      {/* Frozen Upper Section (Header, Stats, Filters) */}
      <div className="shrink-0 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="text-blue-600" size={28} />
              Customer Field Visits Log
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchVisits}
              className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer"
              title="Refresh">
              <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
              <Plus size={15} />
              Log Customer Visit
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Visits</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalVisits}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <MapPin size={22} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Positive</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{positiveVisits}</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <ThumbsUp size={22} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Neutral</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{neutralVisits}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Clock size={22} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">Negative</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{negativeVisits}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar - Single Row matching Inquiry tab layout */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* 1. Compact Search Bar with Clear (X) Icon */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder={canViewSalesperson ? 'Search Customer, Location, Rep...' : 'Search Customer, Location, Remarks...'}
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

          {/* 2. Date Preset Dropdown with 'Last 30 Days' default */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <Calendar size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
            <select
              value={dayPreset}
              onChange={e => handleDayPresetChange(e.target.value)}
              className="w-full sm:w-auto pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Time</option>
              <option value="today" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Today</option>
              <option value="7_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 7 Days</option>
              <option value="30_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 30 Days</option>
              <option value="90_days" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Last 90 Days</option>
              <option value="custom" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Custom Range</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 3. Outcome Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterOutcome}
              onChange={e => setFilterOutcome(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Outcomes ({visits.length})</option>
              <option value="positive" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Positive ({positiveVisits})</option>
              <option value="neutral" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Neutral ({neutralVisits})</option>
              <option value="negative" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Negative ({negativeVisits})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 4. Clear Filter Button */}
          {(searchTerm || filterOutcome !== 'all' || dayPreset !== 'all') && (
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
      </div>

      {/* Lower Section - Scrollable Table Card */}
      <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider shadow-2xs">
              <tr>
                <th className="px-3 py-3.5 text-center w-12">#</th>
                <th className="px-5 py-3.5 text-left min-w-[200px]">Customer</th>
                <th className="px-4 py-3.5 text-left min-w-[150px]">Contact Person</th>
                <th className="px-4 py-3.5 text-left min-w-[150px]">Location</th>
                <th className="px-4 py-3.5 text-center min-w-[130px]">Outcome</th>
                <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                    Loading visit logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No visit logs found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try changing date range or filters, or log a new visit.</p>
                  </td>
                </tr>
              ) : (
                paginatedVisits.map((v, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const outcomeLower = getNormalizedOutcome(v);
                  const phone = v.contact_phone || (v as any).phone || (v as any).customer_phone || (v as any).contact_no || '-';
                  const salespersonName = getSalespersonDisplayName(v);

                  return (
                    <tr
                      key={v.id || idx}
                      className="hover:bg-slate-50/70 transition-colors group">
                      {/* 0. Serial Number */}
                      <td className="px-3 py-3.5 font-medium text-slate-500 text-center">
                        {globalIdx}
                      </td>

                      {/* 1. Customer (+ Date & Time + Sales Rep) */}
                      <td className="px-5 py-3.5 text-left">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                          {v.customer_name || 'Customer'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {v.visited_at ? new Date(v.visited_at).toLocaleString('en-IN') : '-'}
                        </div>
                        {canViewSalesperson && salespersonName && (
                          <div className="text-xs text-slate-500 font-medium inline-flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <User size={11} className="text-slate-400 shrink-0" /> Rep: {salespersonName}
                          </div>
                        )}
                      </td>

                      {/* 2. Contact Person */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          {v.person_met && v.person_met !== 'null' ? v.person_met : '-'}
                        </div>
                        {phone && phone !== '-' && (
                          <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Phone size={11} className="text-slate-400 shrink-0" /> {phone}
                          </div>
                        )}
                      </td>

                      {/* 3. Location */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                          <MapIcon size={12} className="text-slate-400 shrink-0" />
                          {formatCityLocality(v.location, v.customer_address)}
                        </div>
                      </td>

                      {/* 4. Outcome */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {outcomeLower === 'positive' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                            Positive
                          </span>
                        ) : outcomeLower === 'neutral' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                            Neutral
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1">
                            Negative
                          </span>
                        )}
                      </td>

                      {/* 5. Actions */}
                      <td className="pl-4 pr-6 sm:pr-8 py-3.5 text-center relative whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(prev => prev === v.id ? null : v.id);
                            }}
                            className="p-1.5 rounded-lg border bg-white hover:bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300 shadow-2xs transition-all inline-flex items-center justify-center cursor-pointer"
                            title="Actions">
                            <MoreVertical size={16} />
                          </button>

                          {activeActionMenuId === v.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className={`absolute right-0 ${
                                idx >= paginatedVisits.length - 2 && paginatedVisits.length >= 3
                                  ? 'bottom-full mb-1'
                                  : 'top-full mt-1'
                              } w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-left animate-in fade-in-50 duration-100`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  openVisitDetails(v, false);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors cursor-pointer">
                                <Eye size={14} className="text-slate-400" />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  openVisitDetails(v, true);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors cursor-pointer">
                                <Edit2 size={14} className="text-slate-400" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setSelectedVisit(v);
                                  setShowDeleteModal(true);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors border-t border-slate-100 cursor-pointer">
                                <Trash2 size={14} className="text-rose-500" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="shrink-0 px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-900">{filtered.length === 0 ? 0 : startIndex + 1}</span> to{' '}
            <span className="font-bold text-slate-900">{endIndex}</span> of{' '}
            <span className="font-bold text-slate-900">{filtered.length}</span> visits
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
                className={`w-7 h-7 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                  currentPage === pageNum
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

      {/* Log Visit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="text-blue-600" size={18} />
                Log Customer Field Visit
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateVisit} className="flex flex-col flex-1 overflow-hidden mt-3">
              <div className="overflow-y-auto flex-1 space-y-4 px-3.5 py-2.5 text-xs">
                {isSavedSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-fadeIn">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Visit log saved successfully! Redirecting...
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      Customer / Company Name <span className="text-rose-500">*</span>
                    </label>
                  </div>
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
                      Person Met <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Suresh Patel"
                      value={formPersonMet}
                      onChange={e => {
                        setFormPersonMet(e.target.value);
                        if (formErrors.personMet) setFormErrors(prev => ({ ...prev, personMet: false }));
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                        formErrors.personMet ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.personMet && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">Please enter person met.</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9822012345"
                      value={formContactPhone}
                      onChange={e => {
                        setFormContactPhone(e.target.value);
                        if (formErrors.contactPhone) setFormErrors(prev => ({ ...prev, contactPhone: false }));
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                        formErrors.contactPhone ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.contactPhone && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">Please enter contact phone.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      City / Location <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Chakan, Pune"
                      value={formLocation}
                      onChange={e => {
                        setFormLocation(e.target.value);
                        if (formErrors.location) setFormErrors(prev => ({ ...prev, location: false }));
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                        formErrors.location ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.location && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">Please enter location.</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Visit Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formVisitDate}
                      onChange={e => {
                        setFormVisitDate(e.target.value);
                        if (formErrors.visitDate) setFormErrors(prev => ({ ...prev, visitDate: false }));
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all cursor-pointer ${
                        formErrors.visitDate ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />
                    {formErrors.visitDate && (
                      <p className="text-[11px] text-rose-500 font-semibold mt-1">Please select visit date.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Visit Outcome <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formOutcome}
                      onChange={e => {
                        setFormOutcome(e.target.value);
                        if (formErrors.outcome) setFormErrors(prev => ({ ...prev, outcome: false }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                      <option value="positive">Positive</option>
                      <option value="neutral">Neutral</option>
                      <option value="negative">Negative</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Follow-up Action</label>
                    <input
                      type="text"
                      placeholder="e.g. Send rate quotation"
                      value={formFollowup}
                      onChange={e => setFormFollowup(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Meeting Remarks &amp; Requirements <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Details of discussion, product requirements..."
                    value={formRemarks}
                    onChange={e => {
                      setFormRemarks(e.target.value);
                      if (formErrors.remarks) setFormErrors(prev => ({ ...prev, remarks: false }));
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all font-medium ${
                      formErrors.remarks ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                  {formErrors.remarks && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">Please enter meeting remarks.</p>
                  )}
                </div>
              </div>

              {/* Action Buttons with Pill-Shaped "Save" Button */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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

      {/* Interactive Visit Details & Edit Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                {returnTo && (
                  <button
                    type="button"
                    onClick={() => navigate(returnTo)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs border border-blue-200">
                    <ArrowLeft size={14} /> Back to Customer Profile
                  </button>
                )}
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <MapPin size={20} />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isEditing ? 'Edit Visit Details' : selectedVisit.customer_name || 'Customer Visit'}
                  </h2>
                  {!isEditing && (
                    <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                      <Calendar size={12} />
                      {selectedVisit.visited_at
                        ? new Date(selectedVisit.visited_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Recent Visit'}
                      {selectedVisit.location && <span>• 📍 {selectedVisit.location}</span>}
                      {canViewSalesperson && getSalespersonDisplayName(selectedVisit) && (
                        <span>• Rep: <strong className="text-slate-700">{getSalespersonDisplayName(selectedVisit)}</strong></span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Header Right: Outcome Badge (View Mode) & Close Button */}
              <div className="flex items-center gap-2">
                {!isEditing && (
                  <div>
                    {getNormalizedOutcome(selectedVisit) === 'positive' ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1 shadow-2xs">
                        <ThumbsUp size={12} /> Positive 🟢
                      </span>
                    ) : getNormalizedOutcome(selectedVisit) === 'neutral' ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1 shadow-2xs">
                        <Clock size={12} /> Neutral 🟡
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 size={12} /> Negative 🔴
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setSelectedVisit(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Close">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* View Mode */}
            {!isEditing ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="overflow-y-auto flex-1 space-y-3.5 pr-1.5 py-3">
                  {/* Contact Details Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                      <p className="text-slate-400 font-medium">Person Met</p>
                      <p className="text-slate-800 font-semibold flex items-center gap-1.5 text-sm">
                        <User size={14} className="text-slate-400 shrink-0" />
                        {selectedVisit.person_met && selectedVisit.person_met !== 'null'
                          ? selectedVisit.person_met
                          : '-'}
                      </p>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                      <p className="text-slate-400 font-medium">Contact Phone</p>
                      <p className="text-slate-800 font-semibold font-mono flex items-center gap-1.5 text-sm">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        {selectedVisit.contact_phone || (selectedVisit as any).contact_no || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Meeting Remarks & Requirements (Independently Scrollable) */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <p className="text-xs font-semibold text-slate-500">Meeting Remarks &amp; Requirements</p>
                    <div className="max-h-36 overflow-y-auto pr-1 text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap font-normal">
                      {(selectedVisit.remarks || selectedVisit.raw_remarks || '')
                        .replace(
                          /\[(Outcome|Requirement|FollowUp|Follow-up|Interests|Location):\s*[^\]]+\]\s*/gi,
                          '',
                        )
                        .trim() || 'No detailed remarks recorded for this visit.'}
                    </div>
                  </div>

                  {/* Follow-up Action (Independently Scrollable) */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <p className="text-xs font-semibold text-slate-500">Follow-up Action</p>
                    <div className="max-h-24 overflow-y-auto pr-1 text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap font-medium">
                      {selectedVisit.follow_up_action && selectedVisit.follow_up_action.trim() && selectedVisit.follow_up_action !== '-'
                        ? selectedVisit.follow_up_action.trim()
                        : 'None'}
                    </div>
                  </div>
                </div>

                {/* View Mode Footer */}
                <div className="pt-3 border-t border-slate-100 flex justify-end items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={actionLoading}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
                    <Trash2 size={14} />
                    Delete Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer">
                    <Edit2 size={13} />
                    Edit Visit
                  </button>
                </div>
              </div>
            ) : (
              /* Edit Mode Form */
              <form onSubmit={handleUpdateVisit} className="flex flex-col flex-1 overflow-hidden mt-3 text-xs">
                <div className="overflow-y-auto flex-1 space-y-3.5 px-3.5 py-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-slate-700">
                        Customer / Company Name <span className="text-rose-500">*</span>
                      </label>
                    </div>
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
                      <label className="block font-semibold text-slate-700 mb-1">Person Met</label>
                      <input
                        type="text"
                        value={editPersonMet}
                        onChange={e => setEditPersonMet(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={editContactPhone}
                        onChange={e => setEditContactPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={e => setEditLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Visit Date</label>
                      <input
                        type="date"
                        value={editVisitDate}
                        onChange={e => setEditVisitDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Visit Outcome</label>
                      <select
                        value={editOutcome}
                        onChange={e => setEditOutcome(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Follow-up Action</label>
                      <input
                        type="text"
                        placeholder="e.g. Send rate quotation"
                        value={editFollowup}
                        onChange={e => setEditFollowup(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Meeting Remarks &amp; Requirements</label>
                    <textarea
                      rows={3}
                      placeholder="Details of discussion, product requirements..."
                      value={editRemarks}
                      onChange={e => setEditRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>
                </div>

                {/* Single Pill-Shaped Cancel/Save buttons in footer */}
                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5 shrink-0 mt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all shadow-2xs cursor-pointer">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50">
                    <Save size={16} />
                    {actionLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Custom In-App Delete Confirmation Modal */}
      {showDeleteModal && selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Visit Log</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete the visit record for{' '}
              <strong className="text-slate-900 font-semibold">{selectedVisit.customer_name}</strong>?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteVisit}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
                <Trash2 size={14} />
                {actionLoading ? 'Deleting...' : 'Delete Visit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
