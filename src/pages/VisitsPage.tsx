import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  X,
  User,
  Users,
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
  AlertCircle,
  Check,
} from 'lucide-react';
import { visitsApi, employeesApi, customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  formatLocalDate,
  getDaysAgo,
} from '../utils/dateUtils';
import CustomerCombobox, { type CustomerDirectoryItem } from '../components/CustomerCombobox';

import { type CustomerVisit, getFollowUpStatusInfo } from '../utils/visitUtils';
export type { CustomerVisit };
export { getFollowUpStatusInfo };

export function formatCityLocality(rawLocation?: string | null, rawAddress?: string | null): string {
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
  const autoOpenedVisitRef = useRef<string | null>(null);
  const [modalReturnTo, setModalReturnTo] = useState<string | null>(() => searchParams.get('returnTo'));

  const { isSalesManager, isAdmin, effectivePhone, activeRole, activeMode } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [filterFollowup, setFilterFollowup] = useState(() => searchParams.get('followup') || 'all');
  const [filterSalesperson, setFilterSalesperson] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const fuParam = searchParams.get('followup');
    if (fuParam) {
      setFilterFollowup(fuParam);
    }
  }, [searchParams]);

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

  const salespeopleList = useMemo(() => {
    const list = employees.filter(
      (e: any) => !e.role || e.role === 'salesperson' || e.role === 'sales_lead' || e.role === 'sales_manager'
    );
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

  const handleCloseVisitModal = () => {
    setSelectedVisit(null);
    setIsEditing(false);
    setModalReturnTo(null);

    // Clean visit search params from URL so subsequent filter changes/polling don't reopen modal
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('visitId') || currentParams.has('id') || currentParams.has('returnTo')) {
      currentParams.delete('visitId');
      currentParams.delete('id');
      currentParams.delete('returnTo');
      const newSearch = currentParams.toString();
      navigate({ search: newSearch ? `?${newSearch}` : '' }, { replace: true });
    }
  };

  // Auto-open requested visit modal if navigated with ?visitId=... or ?id=...
  useEffect(() => {
    if (!targetVisitId || autoOpenedVisitRef.current === targetVisitId) return;
    const found = visits.find(
      (v) => String(v.id) === targetVisitId || String(v.id).includes(targetVisitId),
    );
    if (found) {
      autoOpenedVisitRef.current = targetVisitId;
      if (returnTo) setModalReturnTo(returnTo);
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
            autoOpenedVisitRef.current = targetVisitId;
            if (returnTo) setModalReturnTo(returnTo);
            setSelectedVisit(match);
            setIsEditing(false);
          }
        })
        .catch((err) => {
          console.warn('Could not auto-open requested visit:', err);
          autoOpenedVisitRef.current = targetVisitId;
        });
    }
  }, [targetVisitId, visits, returnTo]);

  // Create Form state
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formPersonMet, setFormPersonMet] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formOutcome, setFormOutcome] = useState('positive');
  const [formRemarks, setFormRemarks] = useState('');
  const [formFollowup, setFormFollowup] = useState('');
  const [formFollowupDate, setFormFollowupDate] = useState('');
  const [formVisitDate, setFormVisitDate] = useState(formatLocalDate());
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Preset Days Helper
  const setFollowupPresetDays = (days: number, isEdit = false) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const ymd = formatLocalDate(d);
    if (isEdit) {
      setEditFollowupDate(ymd);
    } else {
      setFormFollowupDate(ymd);
    }
  };

  // Reset form and open Add New Visit modal cleanly
  const handleOpenAddModal = () => {
    setFormCustomerName('');
    setFormPersonMet('');
    setFormContactPhone('');
    setFormLocation('');
    setFormOutcome('positive');
    setFormRemarks('');
    setFormFollowup('');
    setFormFollowupDate('');
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
  const [editFollowupDate, setEditFollowupDate] = useState('');
  const [editFollowupStatus, setEditFollowupStatus] = useState<'pending' | 'completed'>('pending');
  const [editVisitDate, setEditVisitDate] = useState(formatLocalDate());

  const fetchVisits = async (isBackground?: boolean | any) => {
    const silent = isBackground === true;
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setVisits([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits(false);
  }, [dateRange, effectivePhone, activeRole, activeMode]);

  useEffect(() => {
    const handleDbChange = (e: any) => {
      const { table } = e.detail || {};
      if (table === 'customer_visits') {
        fetchVisits(true);
      }
    };
    window.addEventListener('enlight-db-change', handleDbChange);

    // 15s silent background polling fail-safe
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchVisits(true);
      }
    }, 15000);

    const handleFocus = () => {
      fetchVisits(true);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('enlight-db-change', handleDbChange);
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
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
        follow_up_action: formFollowup.trim() || undefined,
        follow_up_date: formFollowup.trim() ? (formFollowupDate || undefined) : undefined,
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
        setFormFollowupDate('');
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
    // 1. Explicit outcome field if valid
    const o = (v?.outcome || '').toLowerCase().trim();
    if (o === 'positive') return 'positive';
    if (o === 'neutral') return 'neutral';
    if (o === 'negative' || o === 'closed') return 'negative';

    // 2. Check [Outcome: ...] meta tag in remarks
    const raw = v?.remarks || v?.raw_remarks || '';
    const match = raw.match(/\[Outcome:\s*([^\]]+)\]/i);
    if (match) {
      const tagOutcome = match[1].toLowerCase().trim();
      if (tagOutcome === 'positive') return 'positive';
      if (tagOutcome === 'neutral') return 'neutral';
      if (tagOutcome === 'negative' || tagOutcome === 'closed') return 'negative';
    }

    // 3. Fallback sentiment analysis on raw remarks
    const lowerRem = raw.toLowerCase();
    if (
      /\b(?:negative|bad|rejected|rejection|unsuccessful|declined|not\s+(?:at\s+all\s+)?inter(?:e)?sted|uninterested|no\s+interest|not\s+buying|not\s+interested|no\s+(?:immediate\s+)?need|no\s+requirement|refused|unfavorable|dissatisfied|cancelled|lost)\b/i.test(
        lowerRem,
      ) ||
      /\b(?:nahi\s+chahiye|interest\s+nahi|mana\s+kar\s+diya|reject\s+hua)\b/i.test(
        lowerRem,
      )
    ) {
      return 'negative';
    }
    if (
      /\b(?:positive|went\s+well|good|great|successful|favorable|interested|keen|promising|order\s+confirmed|deal\s+done)\b/i.test(
        lowerRem,
      ) &&
      !/\b(?:not\s+|no\s+|nahi\s+)(?:positive|good|great|interested|keen|promising)\b/i.test(
        lowerRem,
      )
    ) {
      return 'positive';
    }

    // 4. Default fallback: Neutral (NEVER positive)
    return 'neutral';
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
    setEditFollowupDate(v.follow_up_date ? new Date(v.follow_up_date).toISOString().split('T')[0] : '');
    setEditFollowupStatus((v.follow_up_status as any) === 'completed' ? 'completed' : 'pending');
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
        follow_up_action: editFollowup.trim() || null,
        follow_up_date: editFollowup.trim() ? editFollowupDate || null : null,
        follow_up_status: editFollowup.trim() ? editFollowupStatus : null,
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

  const handleToggleFollowUpStatus = async (
    e: React.MouseEvent,
    v: CustomerVisit,
  ) => {
    e.stopPropagation();
    const currentStatus = v.follow_up_status === 'completed' ? 'completed' : 'pending';
    const newStatus: 'pending' | 'completed' =
      currentStatus === 'completed' ? 'pending' : 'completed';

    const completedAt = newStatus === 'completed' ? new Date().toISOString() : undefined;

    // Optimistic UI update for visits list
    setVisits((prev) =>
      prev.map((item) =>
        item.id === v.id
          ? {
              ...item,
              follow_up_status: newStatus,
              follow_up_completed_at: completedAt,
            }
          : item,
      ),
    );

    // Optimistic UI update for selected modal visit if open
    if (selectedVisit && selectedVisit.id === v.id) {
      setSelectedVisit((prev) =>
        prev
          ? {
              ...prev,
              follow_up_status: newStatus,
              follow_up_completed_at: completedAt,
            }
          : null,
      );
    }

    try {
      await visitsApi.updateFollowUpStatus(v.id, newStatus);
      toast.success(
        newStatus === 'completed'
          ? `Follow-up completed for ${v.customer_name}`
          : `Follow-up marked pending for ${v.customer_name}`,
      );
      // Background silent refetch to guarantee persistence
      fetchVisits(true);
    } catch (err) {
      console.error('Failed to toggle follow-up status:', err);
      toast.error('Failed to update follow-up status.');
      // Revert on error
      setVisits((prev) =>
        prev.map((item) => (item.id === v.id ? v : item)),
      );
      if (selectedVisit && selectedVisit.id === v.id) {
        setSelectedVisit(v);
      }
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
      handleCloseVisitModal();
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

  // 1. Base scoped visits: filtered by date range, salesperson dropdown, and search text
  const baseScopedVisits = useMemo(() => {
    return safeVisits.filter(v => {
      if (dateRange.from && dateRange.to) {
        const dateStr = v.visited_at;
        if (dateStr) {
          const itemDate = new Date(dateStr).toISOString().split('T')[0];
          if (itemDate < dateRange.from || itemDate > dateRange.to) return false;
        }
      }

      const repName = getSalespersonDisplayName(v) || '';
      if (filterSalesperson !== 'all') {
        const vPhone = (v.salesperson_phone || '').replace(/\D/g, '').slice(-10);
        const selPhone = filterSalesperson.replace(/\D/g, '').slice(-10);
        const matchesPhone = selPhone && vPhone === selPhone;
        const matchesName = repName.toLowerCase().trim() === filterSalesperson.toLowerCase().trim();
        if (!matchesPhone && !matchesName) return false;
      }

      const matchesSearch =
        (v?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.person_met || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.customer_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.remarks || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.follow_up_action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.material_requirement || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        repName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [safeVisits, dateRange, filterSalesperson, searchTerm, employeeMap]);

  // 2. Further filtered by Outcome & Follow-up status for table view
  const filtered = useMemo(() => {
    return baseScopedVisits.filter(v => {
      const matchesOutcome =
        filterOutcome === 'all' ||
        getNormalizedOutcome(v) === filterOutcome.toLowerCase();

      const fuInfo = getFollowUpStatusInfo(v);
      let matchesFollowup = true;
      if (filterFollowup === 'due') {
        matchesFollowup = fuInfo.hasFollowUp && (fuInfo.urgency === 'overdue' || fuInfo.urgency === 'today');
      } else if (filterFollowup === 'pending') {
        matchesFollowup = fuInfo.hasFollowUp && fuInfo.status === 'pending';
      } else if (filterFollowup === 'overdue') {
        matchesFollowup = fuInfo.hasFollowUp && fuInfo.urgency === 'overdue';
      } else if (filterFollowup === 'due_today') {
        matchesFollowup = fuInfo.hasFollowUp && fuInfo.urgency === 'today';
      } else if (filterFollowup === 'completed') {
        matchesFollowup = fuInfo.hasFollowUp && fuInfo.status === 'completed';
      } else if (filterFollowup === 'none') {
        matchesFollowup = !fuInfo.hasFollowUp;
      }

      return matchesOutcome && matchesFollowup;
    });
  }, [baseScopedVisits, filterOutcome, filterFollowup]);

  // Dynamic Stat Cards (cross-filter aware)
  const visitsForOutcomeMetrics = useMemo(() => {
    if (filterFollowup === 'all') return baseScopedVisits;
    return baseScopedVisits.filter(v => {
      const fuInfo = getFollowUpStatusInfo(v);
      if (filterFollowup === 'due') return fuInfo.hasFollowUp && (fuInfo.urgency === 'overdue' || fuInfo.urgency === 'today');
      if (filterFollowup === 'pending') return fuInfo.hasFollowUp && fuInfo.status === 'pending';
      if (filterFollowup === 'overdue') return fuInfo.hasFollowUp && fuInfo.urgency === 'overdue';
      if (filterFollowup === 'due_today') return fuInfo.hasFollowUp && fuInfo.urgency === 'today';
      if (filterFollowup === 'completed') return fuInfo.hasFollowUp && fuInfo.status === 'completed';
      if (filterFollowup === 'none') return !fuInfo.hasFollowUp;
      return true;
    });
  }, [baseScopedVisits, filterFollowup]);

  const visitsForFollowupMetrics = useMemo(() => {
    if (filterOutcome === 'all') return baseScopedVisits;
    return baseScopedVisits.filter(v => getNormalizedOutcome(v) === filterOutcome.toLowerCase());
  }, [baseScopedVisits, filterOutcome]);

  const totalVisits = (filterOutcome !== 'all' || filterFollowup !== 'all') ? filtered.length : baseScopedVisits.length;
  const positiveVisits = visitsForOutcomeMetrics.filter(v => getNormalizedOutcome(v) === 'positive').length;
  const neutralVisits = visitsForOutcomeMetrics.filter(v => getNormalizedOutcome(v) === 'neutral').length;
  const negativeVisits = visitsForOutcomeMetrics.filter(v => getNormalizedOutcome(v) === 'negative').length;

  const dueFollowupsCount = visitsForFollowupMetrics.filter(v => {
    const fu = getFollowUpStatusInfo(v);
    return fu.hasFollowUp && (fu.urgency === 'overdue' || fu.urgency === 'today');
  }).length;

  const pendingFollowupsCount = visitsForFollowupMetrics.filter(v => {
    const fu = getFollowUpStatusInfo(v);
    return fu.hasFollowUp && fu.status === 'pending';
  }).length;

  const overdueFollowupsCount = visitsForFollowupMetrics.filter(v => {
    const fu = getFollowUpStatusInfo(v);
    return fu.hasFollowUp && fu.urgency === 'overdue';
  }).length;

  const dueTodayFollowupsCount = visitsForFollowupMetrics.filter(v => {
    const fu = getFollowUpStatusInfo(v);
    return fu.hasFollowUp && fu.urgency === 'today';
  }).length;

  const completedFollowupsCount = visitsForFollowupMetrics.filter(v => {
    const fu = getFollowUpStatusInfo(v);
    return fu.hasFollowUp && fu.status === 'completed';
  }).length;

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterOutcome, filterFollowup, filterSalesperson, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedVisits = filtered.slice(startIndex, startIndex + pageSize);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterOutcome('all');
    setFilterFollowup('all');
    setFilterSalesperson('all');
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

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={fetchVisits}
              className="h-9 w-9 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-60 shrink-0"
              title="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>
            <button
              onClick={handleOpenAddModal}
              className="h-9 flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0">
              <Plus size={15} />
              Log Customer Visit
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div
            onClick={() => { setFilterOutcome('all'); setFilterFollowup('all'); }}
            className={`bg-white p-4 rounded-xl border ${
              filterOutcome === 'all' && filterFollowup === 'all'
                ? 'border-blue-500 ring-2 ring-blue-100'
                : 'border-slate-200'
            } shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-all`}>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Visits</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{totalVisits}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <MapPin size={22} />
            </div>
          </div>

          <div
            onClick={() => setFilterOutcome(filterOutcome === 'positive' ? 'all' : 'positive')}
            className={`bg-white p-4 rounded-xl border ${
              filterOutcome === 'positive'
                ? 'border-emerald-500 ring-2 ring-emerald-100'
                : 'border-slate-200'
            } shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-300 transition-all`}>
            <div>
              <p className="text-xs text-slate-500 font-medium">Positive</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{positiveVisits}</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <ThumbsUp size={22} />
            </div>
          </div>

          <div
            onClick={() => setFilterOutcome(filterOutcome === 'neutral' ? 'all' : 'neutral')}
            className={`bg-white p-4 rounded-xl border ${
              filterOutcome === 'neutral'
                ? 'border-amber-500 ring-2 ring-amber-100'
                : 'border-slate-200'
            } shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-300 transition-all`}>
            <div>
              <p className="text-xs text-slate-500 font-medium">Neutral</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{neutralVisits}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Clock size={22} />
            </div>
          </div>

          <div
            onClick={() => setFilterOutcome(filterOutcome === 'negative' ? 'all' : 'negative')}
            className={`bg-white p-4 rounded-xl border ${
              filterOutcome === 'negative'
                ? 'border-rose-500 ring-2 ring-rose-100'
                : 'border-slate-200'
            } shadow-sm flex items-center justify-between cursor-pointer hover:border-rose-300 transition-all`}>
            <div>
              <p className="text-xs text-slate-500 font-medium">Negative</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{negativeVisits}</p>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
              <ThumbsDown size={22} />
            </div>
          </div>

          <div
            onClick={() => setFilterFollowup(filterFollowup === 'due' ? 'all' : 'due')}
            className={`bg-white p-4 rounded-xl border ${filterFollowup === 'due' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-all`}>
            <div>
              <p className="text-xs text-slate-500 font-medium">Follow-ups Due</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-blue-600">{dueFollowupsCount}</p>
                {overdueFollowupsCount > 0 && (
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                    {overdueFollowupsCount} overdue
                  </span>
                )}
                {dueTodayFollowupsCount > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                    {dueTodayFollowupsCount} today
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Clock size={22} />
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

          {/* 2. Salesperson Filter Dropdown (Admin & Sales Manager only) */}
          {canViewSalesperson && (
            <div className="relative inline-flex items-center w-full sm:w-auto">
              <Users size={14} className="absolute left-3 text-blue-600 pointer-events-none" />
              <select
                value={filterSalesperson}
                onChange={e => setFilterSalesperson(e.target.value)}
                className="w-full sm:w-auto pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
                <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>
                  All Salespersons ({salespeopleList.length})
                </option>
                {salespeopleList.map((sp: any) => (
                  <option
                    key={sp.phone || sp.name}
                    value={sp.name}
                    className="font-normal text-slate-700"
                    style={{ fontWeight: 'normal' }}>
                    {sp.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
            </div>
          )}

          {/* 3. Date Preset Dropdown with 'Last 30 Days' default */}
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

          {/* 4. Outcome Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterOutcome}
              onChange={e => setFilterOutcome(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Outcomes ({baseScopedVisits.length})</option>
              <option value="positive" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Positive ({positiveVisits})</option>
              <option value="neutral" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Neutral ({neutralVisits})</option>
              <option value="negative" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Negative ({negativeVisits})</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 5. Follow-up Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterFollowup}
              onChange={e => setFilterFollowup(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Follow-ups ({baseScopedVisits.length})</option>
              <option value="due" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Due / Overdue ({dueFollowupsCount})</option>
              <option value="overdue" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Overdue ({overdueFollowupsCount})</option>
              <option value="due_today" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Due Today ({dueTodayFollowupsCount})</option>
              <option value="pending" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>All Pending ({pendingFollowupsCount})</option>
              <option value="completed" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>Completed ({completedFollowupsCount})</option>
              <option value="none" className="font-normal text-slate-700" style={{ fontWeight: 'normal' }}>No Follow-up</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 6. Clear Filter Button */}
          {(searchTerm || filterOutcome !== 'all' || filterFollowup !== 'all' || filterSalesperson !== 'all' || dayPreset !== 'all') && (
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
                <th className="px-4 py-3.5 text-center min-w-[120px]">Outcome</th>
                <th className="px-4 py-3.5 text-left min-w-[220px]">Follow-up</th>
                <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                    Loading visit logs...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
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

                      {/* 5. Follow-up Action & Status */}
                      <td className="px-4 py-3.5 text-xs">
                        {(() => {
                          const fu = getFollowUpStatusInfo(v);
                          if (!fu.hasFollowUp) {
                            return <span className="text-slate-400 font-mono">-</span>;
                          }
                          const isCompleted = fu.status === 'completed';
                          return (
                            <div className="space-y-1.5 min-w-[200px] max-w-[280px]">
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleFollowUpStatus(e, v)}
                                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                    isCompleted
                                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                      : 'bg-white border-slate-300 hover:border-blue-500 text-transparent hover:text-slate-400'
                                  }`}
                                  title={isCompleted ? 'Mark as pending' : 'Mark as completed'}>
                                  <Check size={11} strokeWidth={3} className={isCompleted ? 'text-white' : 'currentColor'} />
                                </button>
                                <span
                                  className={`font-bold leading-snug line-clamp-2 ${
                                    isCompleted ? 'line-through text-slate-400 font-medium' : 'text-slate-900'
                                  }`}
                                  title={fu.action}>
                                  {fu.action}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 pl-6">
                                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full inline-flex items-center gap-1 shadow-2xs ${fu.badgeClass}`}>
                                  {fu.urgency === 'completed' && <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />}
                                  {fu.urgency === 'overdue' && <AlertCircle size={11} className="text-rose-600 shrink-0" />}
                                  {fu.urgency === 'today' && <Clock size={11} className="text-amber-600 shrink-0" />}
                                  {fu.urgency === 'upcoming' && <Calendar size={11} className="text-blue-600 shrink-0" />}
                                  {fu.urgency === 'no_date' && <Clock size={11} className="text-slate-500 shrink-0" />}
                                  {fu.relativeText}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 6. Actions */}
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
                              } w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 text-left animate-in fade-in-50 duration-100`}>
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

                <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block font-semibold text-slate-700">Follow-up Action &amp; Due Date</label>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-medium">Quick Due:</span>
                      <button
                        type="button"
                        onClick={() => setFollowupPresetDays(1, false)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium cursor-pointer transition-colors shadow-2xs">
                        +1d (Tomorrow)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowupPresetDays(3, false)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium cursor-pointer transition-colors shadow-2xs">
                        +3d
                      </button>
                      <button
                        type="button"
                        onClick={() => setFollowupPresetDays(7, false)}
                        className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium cursor-pointer transition-colors shadow-2xs">
                        +7d (Next Week)
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="e.g. Send rate quotation next week"
                        value={formFollowup}
                        onChange={e => {
                          const val = e.target.value;
                          setFormFollowup(val);
                          if (val.trim() && !formFollowupDate) {
                            const nextWeek = new Date();
                            nextWeek.setDate(nextWeek.getDate() + 7);
                            setFormFollowupDate(formatLocalDate(nextWeek));
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={formFollowupDate}
                        onChange={e => setFormFollowupDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer bg-white"
                        title="Follow-up Due Date"
                      />
                    </div>
                  </div>
                  {formFollowup && formFollowupDate && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5 font-medium">
                      <Clock size={12} className="text-blue-600 shrink-0" />
                      <span>Reminder scheduled for: <strong className="text-slate-800">{new Date(formFollowupDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                    </div>
                  )}
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
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto"
          onClick={handleCloseVisitModal}>
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto"
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                {(modalReturnTo || returnTo) && (
                  <button
                    type="button"
                    onClick={() => navigate(modalReturnTo || returnTo!)}
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
                      {selectedVisit.location && <span>• {selectedVisit.location}</span>}
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
                        <ThumbsUp size={12} /> Positive
                      </span>
                    ) : getNormalizedOutcome(selectedVisit) === 'neutral' ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 inline-flex items-center gap-1 shadow-2xs">
                        <Clock size={12} /> Neutral
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 inline-flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 size={12} /> Negative
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={handleCloseVisitModal}
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
                          /\[(?:Outcome|Location|Follow-?Up|Follow-?up\s*Action|Requirement|Requirements|Interests?):[^\]]*\]\s*/gi,
                          '',
                        )
                        .replace(/(?:^|\||\n)\s*Follow-?up(?:\s*Action)?:\s*[^|\n]+/gi, '')
                        .replace(/(?:^|\||\n)\s*(?:Material )?Requirement:\s*[^|\n]+/gi, '')
                        .replace(/(?:^|\||\n)\s*Location:\s*[^|\n]+/gi, '')
                        .replace(/(?:^|\||\n)\s*Interests?:\s*[^|\n]+/gi, '')
                        .replace(/^[\s|]+|[\s|]+$/g, '')
                        .trim() || 'No detailed remarks recorded for this visit.'}
                    </div>
                  </div>

                  {/* Follow-up Action & Status (Independently Scrollable) */}
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-500">Follow-up Action</p>
                      {(() => {
                        const fu = getFollowUpStatusInfo(selectedVisit);
                        if (!fu.hasFollowUp) return null;
                        return (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleToggleFollowUpStatus(e, selectedVisit)}
                              className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border shadow-2xs ${
                                fu.status === 'completed'
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                              }`}>
                              <Check size={11} strokeWidth={3} />
                              {fu.status === 'completed' ? 'Reopen' : 'Mark Done'}
                            </button>
                            {fu.urgency === 'completed' ? (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center gap-1 ${fu.badgeClass}`}>
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                Done
                              </span>
                            ) : fu.urgency === 'overdue' ? (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center gap-1 ${fu.badgeClass}`}>
                                <AlertCircle size={11} className="text-rose-600" />
                                Overdue
                              </span>
                            ) : fu.urgency === 'today' ? (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center gap-1 ${fu.badgeClass}`}>
                                <Clock size={11} className="text-amber-600" />
                                Due Today
                              </span>
                            ) : fu.urgency === 'upcoming' ? (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center gap-1 ${fu.badgeClass}`}>
                                <Calendar size={11} className="text-blue-600" />
                                Upcoming
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center gap-1 ${fu.badgeClass}`}>
                                <Clock size={11} className="text-slate-500" />
                                Pending
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="max-h-24 overflow-y-auto pr-1 text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap font-medium">
                      {(() => {
                        const fu = getFollowUpStatusInfo(selectedVisit);
                        if (!fu.hasFollowUp) return 'None';
                        return (
                          <div>
                            <p className={fu.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}>
                              {fu.action}
                            </p>
                            {fu.dueDateStr && (
                              <p className="text-[11px] text-slate-500 font-mono mt-1">
                                Due Date: {new Date(fu.dueDateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        );
                      })()}
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

                  <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block font-semibold text-slate-700">Follow-up Action &amp; Due Date</label>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400 font-medium">Quick Due:</span>
                        <button
                          type="button"
                          onClick={() => setFollowupPresetDays(1, true)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium cursor-pointer transition-colors shadow-2xs">
                          +1d (Tomorrow)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowupPresetDays(3, true)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium cursor-pointer transition-colors shadow-2xs">
                          +3d
                        </button>
                        <button
                          type="button"
                          onClick={() => setFollowupPresetDays(7, true)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium cursor-pointer transition-colors shadow-2xs">
                          +7d (Next Week)
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <input
                          type="text"
                          placeholder="e.g. Send rate quotation"
                          value={editFollowup}
                          onChange={e => {
                            const val = e.target.value;
                            setEditFollowup(val);
                            if (val.trim() && !editFollowupDate) {
                              const nextWeek = new Date();
                              nextWeek.setDate(nextWeek.getDate() + 7);
                              setEditFollowupDate(formatLocalDate(nextWeek));
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                        />
                      </div>
                      <div>
                        <input
                          type="date"
                          value={editFollowupDate}
                          onChange={e => setEditFollowupDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer bg-white"
                          title="Follow-up Due Date"
                        />
                      </div>
                      <div>
                        <select
                          value={editFollowupStatus}
                          onChange={e => setEditFollowupStatus(e.target.value as 'pending' | 'completed')}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    {editFollowup && editFollowupDate && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5 font-medium">
                        <Clock size={12} className="text-blue-600 shrink-0" />
                        <span>Reminder scheduled for: <strong className="text-slate-800">{new Date(editFollowupDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                      </div>
                    )}
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
                    onClick={handleCloseVisitModal}
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
