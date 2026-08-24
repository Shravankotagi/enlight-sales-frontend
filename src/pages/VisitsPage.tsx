import { useState, useEffect, useMemo } from 'react';
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
  Check,
  MoreVertical,
  Eye,
} from 'lucide-react';
import { visitsApi, employeesApi, customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getFirstDayOfMonth, getLastDayOfMonth, formatLocalDate } from '../utils/dateUtils';
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

export default function VisitsPage() {
  const { isSalesManager, isAdmin } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

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

    // 1. Ingest registered recurring customers
    customers.forEach(c => {
      const rawName = (c?.customer_name || '').trim();
      if (!rawName) return;
      const key = rawName.toLowerCase();

      let contactPerson = (c?.contact_person || '').trim();
      if (!contactPerson && c?.notes) {
        const match = c.notes.match(/Contact:\s*([^|]+)/i);
        if (match && match[1]) contactPerson = match[1].trim();
      }

      const phone = (c?.customer_phone || c?.phone || c?.contact_no || '').trim();
      const loc = (c?.customer_address || c?.address || c?.city || '').trim();

      dirMap.set(key, {
        id: c.id,
        customer_name: rawName,
        contact_person: contactPerson || undefined,
        contact_phone: phone || undefined,
        location: loc || undefined,
      });
    });

    // 2. Ingest and enrich from past visits
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
    if (cust.contact_person) {
      setFormPersonMet(cust.contact_person);
    }
    if (cust.contact_phone) {
      setFormContactPhone(cust.contact_phone);
    }
    if (cust.location && !formLocation) {
      setFormLocation(cust.location);
    }
  };

  const handleSelectCustomerForEdit = (cust: CustomerDirectoryItem) => {
    setEditCustomerName(cust.customer_name);
    if (cust.contact_person) {
      setEditPersonMet(cust.contact_person);
    }
    if (cust.contact_phone) {
      setEditContactPhone(cust.contact_phone);
    }
    if (cust.location && !editLocation) {
      setEditLocation(cust.location);
    }
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

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  // Create Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPersonMet, setFormPersonMet] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formOutcome, setFormOutcome] = useState('positive');
  const [formRemarks, setFormRemarks] = useState('');
  const [formFollowup, setFormFollowup] = useState('');
  const [formVisitDate, setFormVisitDate] = useState(formatLocalDate());

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
  }, [dateRange]);

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerName.trim()) return;

    try {
      setSubmitting(true);
      await visitsApi.create({
        customer_name: formCustomerName,
        person_met: formPersonMet,
        contact_phone: formContactPhone,
        location: formLocation,
        outcome: formOutcome,
        remarks: formRemarks,
        follow_up_action: formFollowup,
        visited_at: new Date(formVisitDate).toISOString(),
      });

      setShowModal(false);
      // Reset form
      setFormCustomerName('');
      setFormPersonMet('');
      setFormContactPhone('');
      setFormLocation('');
      setFormOutcome('positive');
      setFormRemarks('');
      setFormFollowup('');
      setFormVisitDate(formatLocalDate());

      fetchVisits();
    } catch (err) {
      console.error('Error creating visit:', err);
      alert('Failed to log visit. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
      setSelectedVisit(updatedObj);
      setIsEditing(false);
      await fetchVisits();
    } catch (err) {
      console.error('Error updating visit:', err);
      alert('Failed to update visit details. Please try again.');
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
      fetchVisits();
    } catch (err) {
      console.error('Error deleting visit:', err);
      alert('Failed to delete visit. Please try again.');
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

  const getNormalizedOutcome = (v: any) => {
    const o = (v?.outcome || '').toLowerCase();
    const r = (v?.remarks || '').toLowerCase();
    if (o === 'neutral' || r.includes('neutral')) return 'neutral';
    if (o === 'negative' || o === 'closed' || r.includes('negative') || r.includes('closed')) return 'negative';
    return 'positive';
  };

  const positiveVisits = visits.filter(v => getNormalizedOutcome(v) === 'positive').length;
  const neutralVisits = visits.filter(v => getNormalizedOutcome(v) === 'neutral').length;
  const negativeVisits = visits.filter(v => getNormalizedOutcome(v) === 'negative').length;

  const [dateFilterResetKey, setDateFilterResetKey] = useState(0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterOutcome('all');
    setDateFilterResetKey(k => k + 1);
    setDateRange({
      preset: 'this_month',
      from: getFirstDayOfMonth(),
      to: getLastDayOfMonth(),
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="text-blue-600" size={28} />
            Customer Visits Log
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchVisits}
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs"
            title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all">
            <Plus size={18} />
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

      {/* Unified Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={canViewSalesperson ? 'Search Customer, Contact, Location, Rep...' : 'Search Customer, Contact, Location, Remarks...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400 bg-white"
          />
        </div>

        {/* Date Filter */}
        <DateFilterControl onChange={setDateRange} resetKey={dateFilterResetKey} />

        {/* Outcome Filter Dropdown */}
        <div className="relative inline-flex items-center">
          <select
            value={filterOutcome}
            onChange={e => setFilterOutcome(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer transition-all">
            <option value="all">All ({visits.length})</option>
            <option value="positive">Positive ({positiveVisits}) 🟢</option>
            <option value="neutral">Neutral ({neutralVisits}) 🟡</option>
            <option value="negative">Negative ({negativeVisits}) 🔴</option>
          </select>
        </div>

        {/* Clear Filter Button */}
        {(searchTerm || filterOutcome !== 'all' || dateRange.preset !== 'this_month') && (
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100/90 hover:bg-slate-200/80 rounded-xl transition-colors shadow-2xs cursor-pointer">
            Clear Filter
          </button>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Customer &amp; Date</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Discussion &amp; Requirements</th>
                <th className="px-4 py-3">Next Action</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
                filtered.map((v, idx) => {
                  const outcomeLower = getNormalizedOutcome(v);
                  const phone = v.contact_phone || (v as any).phone || (v as any).customer_phone || (v as any).contact_no || '-';
                  const loc = v.location || (v as any).city || (v as any).customer_address || '-';
                  const rawRemarks = v.remarks || v.raw_remarks || '';
                  const salespersonName = getSalespersonDisplayName(v);

                  // Follow-up Action Extraction
                  const followUp =
                    v.follow_up_action ||
                    (v as any).follow_up ||
                    (v as any).followup ||
                    rawRemarks.match(/\[FollowUp:\s*([^\]]+)\]/i)?.[1] ||
                    rawRemarks.match(/\[Follow-up:\s*([^\]]+)\]/i)?.[1] ||
                    (rawRemarks.match(/\[Interests:\s*([^\]]+)\]/i)?.[1]
                      ? `Follow-up on ${rawRemarks.match(/\[Interests:\s*([^\]]+)\]/i)?.[1]} requirement`
                      : null) ||
                    '-';

                  // Clean Remarks
                  const cleanRemarks =
                    rawRemarks
                      .replace(
                        /\[(Outcome|Requirement|FollowUp|Follow-up|Interests|Location):\s*[^\]]+\]\s*/gi,
                        '',
                      )
                      .trim() || rawRemarks || '-';

                  return (
                    <tr
                      key={v.id || idx}
                      className="hover:bg-slate-50/70 transition-colors group">
                      {/* 1. Customer & Date */}
                      <td className="px-4 py-3.5 min-w-[190px]">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                          {v.customer_name || 'Customer'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap">
                            <Calendar size={12} className="text-slate-400 shrink-0" />
                            {v.visited_at ? new Date(v.visited_at).toLocaleDateString('en-IN') : '-'}
                          </span>
                          {loc && loc !== '-' && (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                              • <MapIcon size={11} className="text-slate-400 shrink-0" /> {loc}
                            </span>
                          )}
                          {/* Salesperson tag visible ONLY to Sales Managers & Admin */}
                          {canViewSalesperson && salespersonName && (
                            <span className="text-slate-500 font-medium inline-flex items-center gap-1 whitespace-nowrap">
                              • <User size={11} className="text-slate-400 shrink-0" /> {salespersonName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Contact Details */}
                      <td className="px-4 py-3.5 text-xs min-w-[150px]">
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

                      {/* 3. Outcome */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {outcomeLower === 'positive' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
                            Positive 🟢
                          </span>
                        ) : outcomeLower === 'neutral' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                            Neutral 🟡
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1">
                            Negative 🔴
                          </span>
                        )}
                      </td>

                      {/* 4. Discussion & Requirements */}
                      <td className="px-4 py-3.5 text-xs max-w-md">
                        <p className="text-slate-700 leading-relaxed break-words whitespace-normal line-clamp-2">
                          {cleanRemarks}
                        </p>
                      </td>

                      {/* 5. Next Action */}
                      <td className="px-4 py-3.5 text-xs whitespace-normal min-w-[160px]">
                        {followUp && followUp !== '-' ? (
                          <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 text-xs">
                            📅 {followUp}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. Actions (3-dots dropdown) */}
                      <td className="px-4 py-3.5 text-right relative whitespace-nowrap">
                        <div className="inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(prev => prev === v.id ? null : v.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Actions">
                            <MoreVertical size={16} />
                          </button>

                          {activeActionMenuId === v.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-4 top-10 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 min-w-[130px] text-left animate-in fade-in-50 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  openVisitDetails(v, false);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                                <Eye size={14} className="text-slate-400" />
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  openVisitDetails(v, true);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
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
                                className="w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors border-t border-slate-100">
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
      </div>

      {/* Log Visit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="text-blue-600" size={20} />
                Log Customer Field Visit
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateVisit} className="flex flex-col flex-1 overflow-hidden mt-3">
              <div className="overflow-y-auto flex-1 space-y-4 pr-1.5 py-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Customer / Company Name *
                    </label>
                    <span className="text-[11px] text-slate-400 font-normal">Select existing or type new</span>
                  </div>
                  <CustomerCombobox
                    value={formCustomerName}
                    onChange={setFormCustomerName}
                    onSelectCustomer={handleSelectCustomerForCreate}
                    customers={customerDirectory}
                    placeholder="Select existing customer or type new..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Person Met</label>
                    <input
                      type="text"
                      placeholder="e.g. Suresh Patel"
                      value={formPersonMet}
                      onChange={e => setFormPersonMet(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. 9822012345"
                      value={formContactPhone}
                      onChange={e => setFormContactPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City / Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Chakan, Pune"
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Date</label>
                    <input
                      type="date"
                      value={formVisitDate}
                      onChange={e => setFormVisitDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Outcome</label>
                    <select
                      value={formOutcome}
                      onChange={e => setFormOutcome(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="positive">Positive 🟢</option>
                      <option value="neutral">Neutral 🟡</option>
                      <option value="negative">Negative 🔴</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Action</label>
                    <input
                      type="text"
                      placeholder="e.g. Send rate quotation"
                      value={formFollowup}
                      onChange={e => setFormFollowup(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Meeting Remarks &amp; Requirements</label>
                  <textarea
                    rows={3}
                    placeholder="Details of discussion, product requirements..."
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0 mt-3">
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
                  {submitting ? 'Saving...' : 'Save Visit Log'}
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
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
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
              </div>

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-1.5">
                {!isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Edit Visit">
                      <Edit2 size={13} />
                      Edit Visit
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      disabled={actionLoading}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Visit">
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => setSelectedVisit(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg ml-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* View Mode */}
            {!isEditing ? (
              <div className="overflow-y-auto flex-1 space-y-4 pr-1.5 py-3">
                {/* Status & Outcome Banner */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-600">Visit Outcome Status:</span>
                  {getNormalizedOutcome(selectedVisit) === 'positive' ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <ThumbsUp size={12} /> Positive 🟢
                    </span>
                  ) : getNormalizedOutcome(selectedVisit) === 'neutral' ? (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Clock size={12} /> Neutral 🟡
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Negative 🔴
                    </span>
                  )}
                </div>

                {/* Contact & Location Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <p className="text-slate-400 font-medium">Person Met</p>
                    <p className="text-slate-800 font-semibold flex items-center gap-1.5 text-sm">
                      <User size={14} className="text-slate-400 shrink-0" />
                      {selectedVisit.person_met && selectedVisit.person_met !== 'null'
                        ? selectedVisit.person_met
                        : '-'}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <p className="text-slate-400 font-medium">Contact Phone</p>
                    <p className="text-slate-800 font-semibold font-mono flex items-center gap-1.5 text-sm">
                      <Phone size={14} className="text-slate-400 shrink-0" />
                      {selectedVisit.contact_phone || (selectedVisit as any).contact_no || '-'}
                    </p>
                  </div>
                </div>

                {/* Meeting Remarks & Requirements */}
                <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Meeting Remarks &amp; Requirements</p>
                  <p className="text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap">
                    {(selectedVisit.remarks || selectedVisit.raw_remarks || '')
                      .replace(
                        /\[(Outcome|Requirement|FollowUp|Follow-up|Interests|Location):\s*[^\]]+\]\s*/gi,
                        '',
                      )
                      .trim() || 'No detailed remarks recorded for this visit.'}
                  </p>
                </div>

                {/* Next Action Pill */}
                {selectedVisit.follow_up_action && selectedVisit.follow_up_action !== '-' && (
                  <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl flex items-start gap-2.5">
                    <Calendar size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">Next Follow-up Action</p>
                      <p className="text-xs font-semibold text-blue-800 mt-0.5">
                        {selectedVisit.follow_up_action}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Edit Mode Form */
              <form onSubmit={handleUpdateVisit} className="flex flex-col flex-1 overflow-hidden mt-3">
                <div className="overflow-y-auto flex-1 space-y-3.5 pr-1.5 py-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Customer / Company Name *
                      </label>
                      <span className="text-[11px] text-slate-400 font-normal">Select existing or type new</span>
                    </div>
                    <CustomerCombobox
                      value={editCustomerName}
                      onChange={setEditCustomerName}
                      onSelectCustomer={handleSelectCustomerForEdit}
                      customers={customerDirectory}
                      placeholder="Select existing customer or type new..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Person Met</label>
                      <input
                        type="text"
                        value={editPersonMet}
                        onChange={e => setEditPersonMet(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={editContactPhone}
                        onChange={e => setEditContactPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City / Location</label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={e => setEditLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Date</label>
                      <input
                        type="date"
                        value={editVisitDate}
                        onChange={e => setEditVisitDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Visit Outcome</label>
                      <select
                        value={editOutcome}
                        onChange={e => setEditOutcome(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="positive">Positive 🟢</option>
                        <option value="neutral">Neutral 🟡</option>
                        <option value="negative">Negative 🔴</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Follow-up Action</label>
                      <input
                        type="text"
                        placeholder="e.g. Send rate quotation"
                        value={editFollowup}
                        onChange={e => setEditFollowup(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Meeting Remarks &amp; Requirements</label>
                    <textarea
                      rows={3}
                      placeholder="Details of discussion, product requirements..."
                      value={editRemarks}
                      onChange={e => setEditRemarks(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0 mt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5">
                    <Check size={16} />
                    {actionLoading ? 'Saving...' : 'Save Changes'}
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteVisit}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5">
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
