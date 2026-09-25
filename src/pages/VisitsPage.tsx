import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
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
  Calendar,
  MoreVertical,
  Eye,
  ChevronDown,
  Save,
  ArrowLeft,
  AlertCircle,
  Check,
  Camera,
  Paperclip,
  ExternalLink,
  FileText,
  Building2,
  Briefcase,
  Mail,
  Truck,
  CreditCard,
  Compass,
} from 'lucide-react';
import { visitsApi, employeesApi, customersApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  formatLocalDate,
  formatLocalTime,
  getDaysAgo,
} from '../utils/dateUtils';
import CustomerCombobox, { type CustomerDirectoryItem } from '../components/CustomerCombobox';
import PaginationControl from '../components/PaginationControl';

import { type CustomerVisit, type VisitAttachment, getFollowUpStatusInfo } from '../utils/visitUtils';
export type { CustomerVisit, VisitAttachment };
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
  const queryClient = useQueryClient();
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
  const [filterCustomerType, setFilterCustomerType] = useState<string>('all');
  const [filterProbability, setFilterProbability] = useState<string>('all');
  const [filterVisitType, setFilterVisitType] = useState<string>('all');
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
          email: v.email || undefined,
          designation: v.designation || undefined,
          customer_type: v.customer_type || undefined,
          delivery_location: v.delivery_location || undefined,
          preferred_make: v.preferred_make || undefined,
          payment_terms: v.payment_terms || undefined,
          monthly_consumption: v.monthly_consumption || undefined,
        });
      } else {
        if (!existing.contact_person && personMet) existing.contact_person = personMet;
        if (!existing.contact_phone && phone) existing.contact_phone = phone;
        if (!existing.location && loc) existing.location = loc;
        if (!existing.email && v.email) existing.email = v.email;
        if (!existing.designation && v.designation) existing.designation = v.designation;
        if (!existing.customer_type && v.customer_type) existing.customer_type = v.customer_type;
        if (!existing.delivery_location && v.delivery_location) existing.delivery_location = v.delivery_location;
        if (!existing.preferred_make && v.preferred_make) existing.preferred_make = v.preferred_make;
        if (!existing.payment_terms && v.payment_terms) existing.payment_terms = v.payment_terms;
        if (!existing.monthly_consumption && v.monthly_consumption) existing.monthly_consumption = v.monthly_consumption;
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
      const clean = cust.contact_phone.replace(/\D/g, '').slice(-10);
      setFormContactPhone(clean);
      if (formErrors.contactPhone) setFormErrors(prev => ({ ...prev, contactPhone: false }));
    }
    if (cust.location && !formLocation) {
      setFormLocation(cust.location);
      if (formErrors.location) setFormErrors(prev => ({ ...prev, location: false }));
    }
    if (cust.email && !formEmail) setFormEmail(cust.email);
    if (cust.designation && !formDesignation) setFormDesignation(cust.designation);
    if (cust.customer_type && !formCustomerType) setFormCustomerType(cust.customer_type);
    if (cust.delivery_location && !formDeliveryLocation) setFormDeliveryLocation(cust.delivery_location);
    if (cust.preferred_make && !formPreferredMake) setFormPreferredMake(cust.preferred_make);
    if (cust.payment_terms && !formPaymentTerms) setFormPaymentTerms(cust.payment_terms);
    if (cust.monthly_consumption && !formMonthlyConsumption) setFormMonthlyConsumption(cust.monthly_consumption);
  };

  const handleSelectCustomerForEdit = (cust: CustomerDirectoryItem) => {
    setEditCustomerName(cust.customer_name);
    if (cust.contact_person) setEditPersonMet(cust.contact_person);
    if (cust.contact_phone) {
      const clean = cust.contact_phone.replace(/\D/g, '').slice(-10);
      setEditContactPhone(clean);
      if (editErrors.contactPhone) setEditErrors(prev => ({ ...prev, contactPhone: false }));
    }
    if (cust.location && !editLocation) setEditLocation(cust.location);
    if (cust.email && !editEmail) setEditEmail(cust.email);
    if (cust.designation && !editDesignation) setEditDesignation(cust.designation);
    if (cust.customer_type && !editCustomerType) setEditCustomerType(cust.customer_type);
    if (cust.delivery_location && !editDeliveryLocation) setEditDeliveryLocation(cust.delivery_location);
    if (cust.preferred_make && !editPreferredMake) setEditPreferredMake(cust.preferred_make);
    if (cust.payment_terms && !editPaymentTerms) setEditPaymentTerms(cust.payment_terms);
    if (cust.monthly_consumption && !editMonthlyConsumption) setEditMonthlyConsumption(cust.monthly_consumption);
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
  const [formVisitTime, setFormVisitTime] = useState(formatLocalTime());
  const [formErrors, setFormErrors] = useState<Record<string, string | boolean>>({});

  // Extended Fields for Create Form
  const [formEmail, setFormEmail] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formCustomerType, setFormCustomerType] = useState('');
  const [formVisitType, setFormVisitType] = useState('First Visit');
  const [formCustomerProbability, setFormCustomerProbability] = useState('');
  const [formProductDetails, setFormProductDetails] = useState('');
  const [formMonthlyConsumption, setFormMonthlyConsumption] = useState('');
  const [formCurrentRequirement, setFormCurrentRequirement] = useState('');
  const [formNextPurchaseExpected, setFormNextPurchaseExpected] = useState('');
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPreferredMake, setFormPreferredMake] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formGpsPhotoUrl, setFormGpsPhotoUrl] = useState<string | null>(null);
  const [formGpsLat, setFormGpsLat] = useState<number | null>(null);
  const [formGpsLng, setFormGpsLng] = useState<number | null>(null);
  const [formGpsAccuracy, setFormGpsAccuracy] = useState<number | null>(null);
  const [formAttachments, setFormAttachments] = useState<VisitAttachment[]>([]);
  const [capturingGps, setCapturingGps] = useState(false);

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

  // GPS Coordinates & File Upload Helpers
  const captureGpsCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        (err) => {
          console.warn('Geolocation capture failed or denied:', err);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  };

  const handlePhotoFileChange = async (file: File | null, isEdit = false) => {
    if (!file) return;
    setCapturingGps(true);
    try {
      const coords = await captureGpsCoordinates();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (isEdit) {
          setEditGpsPhotoUrl(dataUrl);
          if (coords) {
            setEditGpsLat(coords.latitude);
            setEditGpsLng(coords.longitude);
            setEditGpsAccuracy(coords.accuracy);
          }
        } else {
          setFormGpsPhotoUrl(dataUrl);
          if (coords) {
            setFormGpsLat(coords.latitude);
            setFormGpsLng(coords.longitude);
            setFormGpsAccuracy(coords.accuracy);
          }
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setCapturingGps(false);
    }
  };

  const handleOtherFilesChange = (files: FileList | null, isEdit = false) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const item = {
          name: file.name,
          url: reader.result as string,
          size: file.size,
          type: file.type,
        };
        if (isEdit) {
          setEditAttachments((prev) => [...prev, item]);
        } else {
          setFormAttachments((prev) => [...prev, item]);
        }
      };
      reader.readAsDataURL(file);
    });
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

    // Reset extended fields
    setFormEmail('');
    setFormDesignation('');
    setFormCustomerType('');
    setFormVisitType('First Visit');
    setFormCustomerProbability('');
    setFormProductDetails('');
    setFormMonthlyConsumption('');
    setFormCurrentRequirement('');
    setFormNextPurchaseExpected('');
    setFormDeliveryLocation('');
    setFormPreferredMake('');
    setFormPaymentTerms('');
    setFormGpsPhotoUrl(null);
    setFormGpsLat(null);
    setFormGpsLng(null);
    setFormGpsAccuracy(null);
    setFormAttachments([]);

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
  const [editVisitTime, setEditVisitTime] = useState(formatLocalTime());
  const [editErrors, setEditErrors] = useState<Record<string, string | boolean>>({});

  // Extended Fields for Edit Form
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editCustomerType, setEditCustomerType] = useState('');
  const [editVisitType, setEditVisitType] = useState('First Visit');
  const [editCustomerProbability, setEditCustomerProbability] = useState('');
  const [editProductDetails, setEditProductDetails] = useState('');
  const [editMonthlyConsumption, setEditMonthlyConsumption] = useState('');
  const [editCurrentRequirement, setEditCurrentRequirement] = useState('');
  const [editNextPurchaseExpected, setEditNextPurchaseExpected] = useState('');
  const [editDeliveryLocation, setEditDeliveryLocation] = useState('');
  const [editPreferredMake, setEditPreferredMake] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editGpsPhotoUrl, setEditGpsPhotoUrl] = useState<string | null>(null);
  const [editGpsLat, setEditGpsLat] = useState<number | null>(null);
  const [editGpsLng, setEditGpsLng] = useState<number | null>(null);
  const [editGpsAccuracy, setEditGpsAccuracy] = useState<number | null>(null);
  const [editAttachments, setEditAttachments] = useState<VisitAttachment[]>([]);

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
    const errors: Record<string, string | boolean> = {};
    if (!formCustomerName.trim()) errors.customerName = true;
    if (!formPersonMet.trim()) errors.personMet = true;

    const cleanContactPhone = formContactPhone.replace(/\D/g, '');
    if (!cleanContactPhone) {
      errors.contactPhone = 'Please enter contact phone.';
    } else if (cleanContactPhone.length !== 10) {
      errors.contactPhone = 'Please enter a valid 10-digit mobile number.';
    }

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
      const [vYear, vMonth, vDay] = formVisitDate.split('-').map(Number);
      const [vHour, vMinute] = (formVisitTime || formatLocalTime()).split(':').map(Number);
      const visitedAtDate = new Date(vYear, vMonth - 1, vDay, vHour, vMinute, 0);

      await visitsApi.create({
        customer_name: formCustomerName.trim(),
        person_met: formPersonMet.trim(),
        contact_phone: cleanContactPhone,
        location: formLocation.trim(),
        outcome: formOutcome,
        remarks: formRemarks.trim(),
        follow_up_action: formFollowup.trim() || undefined,
        follow_up_date: formFollowup.trim() ? (formFollowupDate || undefined) : undefined,
        visited_at: visitedAtDate.toISOString(),
        email: formEmail.trim() || undefined,
        designation: formDesignation.trim() || undefined,
        customer_type: formCustomerType || undefined,
        visit_type: formVisitType || undefined,
        customer_probability: formCustomerProbability || undefined,
        product_details: formProductDetails.trim() || undefined,
        monthly_consumption: formMonthlyConsumption.trim() || undefined,
        current_requirement: formCurrentRequirement.trim() || undefined,
        next_purchase_expected: formNextPurchaseExpected.trim() || undefined,
        delivery_location: formDeliveryLocation.trim() || undefined,
        preferred_make: formPreferredMake.trim() || undefined,
        payment_terms: formPaymentTerms.trim() || undefined,
        gps_photo_url: formGpsPhotoUrl || undefined,
        gps_latitude: formGpsLat ?? undefined,
        gps_longitude: formGpsLng ?? undefined,
        gps_accuracy: formGpsAccuracy ?? undefined,
        attachments: formAttachments.length > 0 ? formAttachments : undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['customers-churn'] });
      queryClient.invalidateQueries({ queryKey: ['customers-directory'] });

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
        setFormVisitTime(formatLocalTime());
        setFormErrors({});
        setFormEmail('');
        setFormDesignation('');
        setFormCustomerType('');
        setFormVisitType('First Visit');
        setFormCustomerProbability('');
        setFormProductDetails('');
        setFormMonthlyConsumption('');
        setFormCurrentRequirement('');
        setFormNextPurchaseExpected('');
        setFormDeliveryLocation('');
        setFormPreferredMake('');
        setFormPaymentTerms('');
        setFormGpsPhotoUrl(null);
        setFormGpsLat(null);
        setFormGpsLng(null);
        setFormGpsAccuracy(null);
        setFormAttachments([]);
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
    setEditErrors({});
    setEditCustomerName(v.customer_name || '');
    setEditPersonMet(v.person_met && v.person_met !== 'null' ? v.person_met : '');
    setEditContactPhone(
      (v.contact_phone || (v as any).contact_no || '').replace(/\D/g, '').slice(-10),
    );
    setEditLocation(v.location || (v as any).customer_address || '');
    const vDate = v.visited_at ? new Date(v.visited_at) : new Date();
    setEditVisitDate(formatLocalDate(vDate));
    setEditVisitTime(formatLocalTime(vDate));
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

    // Extended fields
    setEditEmail(v.email || '');
    setEditDesignation(v.designation || '');
    setEditCustomerType(v.customer_type || '');
    setEditVisitType(v.visit_type || 'First Visit');
    setEditCustomerProbability(v.customer_probability || '');
    setEditProductDetails(v.product_details || '');
    setEditMonthlyConsumption(v.monthly_consumption || '');
    setEditCurrentRequirement(v.current_requirement || '');
    setEditNextPurchaseExpected(
      v.next_purchase_expected
        ? (v.next_purchase_expected.includes('T')
            ? v.next_purchase_expected.split('T')[0]
            : v.next_purchase_expected)
        : '',
    );
    setEditDeliveryLocation(v.delivery_location || '');
    setEditPreferredMake(v.preferred_make || '');
    setEditPaymentTerms(v.payment_terms || '');
    setEditGpsPhotoUrl(v.gps_photo_url || null);
    setEditGpsLat(v.gps_latitude ?? null);
    setEditGpsLng(v.gps_longitude ?? null);
    setEditGpsAccuracy(v.gps_accuracy ?? null);
    setEditAttachments(Array.isArray(v.attachments) ? v.attachments : []);
  };

  const handleUpdateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;

    const errors: Record<string, string | boolean> = {};
    if (!editCustomerName.trim()) errors.customerName = true;
    if (!editPersonMet.trim()) errors.personMet = true;

    const cleanEditPhone = editContactPhone.replace(/\D/g, '');
    if (!cleanEditPhone) {
      errors.contactPhone = 'Please enter contact phone.';
    } else if (cleanEditPhone.length !== 10) {
      errors.contactPhone = 'Please enter a valid 10-digit mobile number.';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      setActionLoading(true);
      const [eYear, eMonth, eDay] = editVisitDate.split('-').map(Number);
      const [eHour, eMinute] = (editVisitTime || '00:00').split(':').map(Number);
      const visitedAtDate = new Date(eYear, eMonth - 1, eDay, eHour, eMinute, 0);

      const cleanRemarks = editRemarks.trim();
      const updatedData = {
        customer_name: editCustomerName.trim(),
        person_met: editPersonMet.trim(),
        contact_phone: cleanEditPhone,
        contact_no: cleanEditPhone,
        location: editLocation.trim(),
        customer_address: editLocation.trim(),
        outcome: editOutcome,
        remarks: cleanRemarks,
        raw_remarks: cleanRemarks,
        follow_up_action: editFollowup.trim() || null,
        follow_up_date: editFollowup.trim() ? editFollowupDate || null : null,
        follow_up_status: editFollowup.trim() ? editFollowupStatus : null,
        visited_at: visitedAtDate.toISOString(),
        email: editEmail.trim() || null,
        designation: editDesignation.trim() || null,
        customer_type: editCustomerType || null,
        visit_type: editVisitType || null,
        customer_probability: editCustomerProbability || null,
        product_details: editProductDetails.trim() || null,
        monthly_consumption: editMonthlyConsumption.trim() || null,
        current_requirement: editCurrentRequirement.trim() || null,
        next_purchase_expected: editNextPurchaseExpected.trim() || null,
        delivery_location: editDeliveryLocation.trim() || null,
        preferred_make: editPreferredMake.trim() || null,
        payment_terms: editPaymentTerms.trim() || null,
        gps_photo_url: editGpsPhotoUrl || null,
        gps_latitude: editGpsLat ?? null,
        gps_longitude: editGpsLng ?? null,
        gps_accuracy: editGpsAccuracy ?? null,
        attachments: editAttachments.length > 0 ? editAttachments : null,
      };

      await visitsApi.update(selectedVisit.id, updatedData);

      queryClient.invalidateQueries({ queryKey: ['customers-churn'] });
      queryClient.invalidateQueries({ queryKey: ['customers-directory'] });

      const updatedObj: CustomerVisit = {
        ...selectedVisit,
        ...updatedData,
      };

      setVisits(prev => prev.map(item => (item.id === selectedVisit.id ? updatedObj : item)));
      setSelectedVisit(null);
      setIsEditing(false);
      setEditErrors({});
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
        (v?.product_details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.current_requirement || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.customer_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        repName.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [safeVisits, dateRange, filterSalesperson, searchTerm, employeeMap]);

  // 2. Further filtered by Outcome, Follow-up status, Customer Type, Probability & Visit Type for table view
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

      const matchesCustomerType =
        filterCustomerType === 'all' ||
        (v.customer_type || '').toLowerCase() === filterCustomerType.toLowerCase();

      const matchesProbability =
        filterProbability === 'all' ||
        (v.customer_probability || '').toLowerCase() === filterProbability.toLowerCase();

      const matchesVisitType =
        filterVisitType === 'all' ||
        (v.visit_type || '').toLowerCase() === filterVisitType.toLowerCase();

      return matchesOutcome && matchesFollowup && matchesCustomerType && matchesProbability && matchesVisitType;
    });
  }, [baseScopedVisits, filterOutcome, filterFollowup, filterCustomerType, filterProbability, filterVisitType]);

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

  const totalVisits = (filterOutcome !== 'all' || filterFollowup !== 'all' || filterCustomerType !== 'all' || filterProbability !== 'all' || filterVisitType !== 'all') ? filtered.length : baseScopedVisits.length;
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
  }, [searchTerm, filterOutcome, filterFollowup, filterSalesperson, filterCustomerType, filterProbability, filterVisitType, dateRange]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const paginatedVisits = filtered.slice(startIndex, startIndex + pageSize);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterOutcome('all');
    setFilterFollowup('all');
    setFilterSalesperson('all');
    setFilterCustomerType('all');
    setFilterProbability('all');
    setFilterVisitType('all');
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

          {/* 6. Customer Type Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterCustomerType}
              onChange={e => setFilterCustomerType(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700">All Customer Types</option>
              <option value="OEM" className="font-normal text-slate-700">OEM</option>
              <option value="Fabricator" className="font-normal text-slate-700">Fabricator</option>
              <option value="EPC" className="font-normal text-slate-700">EPC</option>
              <option value="Manufacturer" className="font-normal text-slate-700">Manufacturer</option>
              <option value="Trader" className="font-normal text-slate-700">Trader</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 7. Customer Probability Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterProbability}
              onChange={e => setFilterProbability(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700">All Probabilities</option>
              <option value="Hot" className="font-normal text-slate-700">Hot</option>
              <option value="Warm" className="font-normal text-slate-700">Warm</option>
              <option value="Cold" className="font-normal text-slate-700">Cold</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 8. Visit Type Dropdown */}
          <div className="relative inline-flex items-center w-full sm:w-auto">
            <select
              value={filterVisitType}
              onChange={e => setFilterVisitType(e.target.value)}
              className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="all" className="font-normal text-slate-700">All Visit Types</option>
              <option value="First Visit" className="font-normal text-slate-700">First Visit</option>
              <option value="Follow-up 1" className="font-normal text-slate-700">Follow-up 1</option>
              <option value="Follow-up 2" className="font-normal text-slate-700">Follow-up 2</option>
              <option value="Follow-up 3" className="font-normal text-slate-700">Follow-up 3</option>
              <option value="Regular Visit" className="font-normal text-slate-700">Regular Visit</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* 9. Clear Filter Button */}
          {(searchTerm || filterOutcome !== 'all' || filterFollowup !== 'all' || filterSalesperson !== 'all' || filterCustomerType !== 'all' || filterProbability !== 'all' || filterVisitType !== 'all' || dayPreset !== 'all') && (
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

                      {/* 1. Customer (+ Date & Time + Sales Rep + Badges) */}
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
                        {/* Extended tags row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {v.customer_type && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {v.customer_type}
                            </span>
                          )}
                          {v.customer_probability && (
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                v.customer_probability.toLowerCase() === 'hot'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : v.customer_probability.toLowerCase() === 'warm'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}>
                              {v.customer_probability}
                            </span>
                          )}
                          {v.visit_type && v.visit_type !== 'First Visit' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {v.visit_type}
                            </span>
                          )}
                          {v.gps_photo_url && (
                            <span
                              title="GPS Photo attached"
                              className="p-1 rounded-md text-blue-600 bg-blue-50 border border-blue-200 inline-flex items-center">
                              <Camera size={11} />
                            </span>
                          )}
                          {Array.isArray(v.attachments) && v.attachments.length > 0 && (
                            <span
                              title={`${v.attachments.length} attachment(s)`}
                              className="px-1.5 py-0.5 rounded-md text-slate-600 bg-slate-100 border border-slate-200 inline-flex items-center text-[10px] gap-0.5">
                              <Paperclip size={10} />
                              {v.attachments.length}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Contact Person */}
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          {v.person_met && v.person_met !== 'null' ? v.person_met : '-'}
                        </div>
                        {v.designation && (
                          <div className="text-[11px] text-slate-500 font-medium pl-5 mt-0.5">
                            {v.designation}
                          </div>
                        )}
                        {phone && phone !== '-' && (
                          <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Phone size={11} className="text-slate-400 shrink-0" /> {phone}
                          </div>
                        )}
                        {v.email && (
                          <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Mail size={11} className="text-slate-400 shrink-0" /> {v.email}
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
        <PaginationControl
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filtered.length}
          startIndex={filtered.length === 0 ? 0 : startIndex + 1}
          endIndex={endIndex}
          itemLabel="visits"
        />
      </div>

      {/* Log Visit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
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
              <div className="overflow-y-auto flex-1 px-3.5 py-2.5 text-xs">
                {isSavedSuccess && (
                  <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-fadeIn">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Visit log saved successfully! Redirecting...
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left Column: Stakeholder & Classification */}
                  <div className="space-y-3.5">
                    <div className="pb-1 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={13} /> Company &amp; Contact Details
                      </span>
                    </div>

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
                        <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                        <input
                          type="text"
                          placeholder="e.g. Purchase Head"
                          value={formDesignation}
                          onChange={e => setFormDesignation(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Contact Phone <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          placeholder="e.g. 9822012345"
                          value={formContactPhone}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setFormContactPhone(val);
                            if (formErrors.contactPhone) setFormErrors(prev => ({ ...prev, contactPhone: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                            formErrors.contactPhone ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                        {formErrors.contactPhone && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">
                            {typeof formErrors.contactPhone === 'string' ? formErrors.contactPhone : 'Please enter a valid 10-digit mobile number.'}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Email ID</label>
                        <input
                          type="email"
                          placeholder="e.g. suresh@company.com"
                          value={formEmail}
                          onChange={e => setFormEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
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
                        <label className="block font-semibold text-slate-700 mb-1">Customer Type</label>
                        <select
                          value={formCustomerType}
                          onChange={e => setFormCustomerType(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                          <option value="">Select Customer Type</option>
                          <option value="OEM">OEM</option>
                          <option value="Fabricator">Fabricator</option>
                          <option value="EPC">EPC</option>
                          <option value="Manufacturer">Manufacturer</option>
                          <option value="Trader">Trader</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                          className={`w-full px-2.5 py-2 border rounded-xl text-xs outline-none transition-all cursor-pointer ${
                            formErrors.visitDate ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Visit Time</label>
                        <input
                          type="time"
                          value={formVisitTime}
                          onChange={e => setFormVisitTime(e.target.value)}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Visit Type</label>
                        <select
                          value={formVisitType}
                          onChange={e => setFormVisitType(e.target.value)}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                          <option value="First Visit">First Visit</option>
                          <option value="Follow-up 1">Follow-up 1</option>
                          <option value="Follow-up 2">Follow-up 2</option>
                          <option value="Follow-up 3">Follow-up 3</option>
                          <option value="Regular Visit">Regular Visit</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Outcome <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formOutcome}
                          onChange={e => {
                            setFormOutcome(e.target.value);
                            if (formErrors.outcome) setFormErrors(prev => ({ ...prev, outcome: false }));
                          }}
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                          <option value="positive">Positive</option>
                          <option value="neutral">Neutral</option>
                          <option value="negative">Negative</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Customer Probability</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Hot', 'Warm', 'Cold'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setFormCustomerProbability(prev => prev === p ? '' : p)}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              formCustomerProbability === p
                                ? p === 'Hot'
                                  ? 'bg-rose-50 border-rose-400 text-rose-700 ring-2 ring-rose-200'
                                  : p === 'Warm'
                                  ? 'bg-amber-50 border-amber-400 text-amber-700 ring-2 ring-amber-200'
                                  : 'bg-sky-50 border-sky-400 text-sky-700 ring-2 ring-sky-200'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}>
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Commercials, Requirements, Follow-up & Attachments */}
                  <div className="space-y-3.5">
                    <div className="pb-1 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase size={13} /> Commercial Intelligence &amp; Requirements
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Product Details</label>
                        <input
                          type="text"
                          placeholder="e.g. SS 304 Sheets 2mm, Pipe 4 inch"
                          value={formProductDetails}
                          onChange={e => setFormProductDetails(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Monthly Consumption</label>
                        <input
                          type="text"
                          placeholder="e.g. 50 MT/month"
                          value={formMonthlyConsumption}
                          onChange={e => setFormMonthlyConsumption(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Preferred Brand / Make</label>
                        <input
                          type="text"
                          placeholder="e.g. JSW, Jindal, Tata"
                          value={formPreferredMake}
                          onChange={e => setFormPreferredMake(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                        <input
                          type="text"
                          placeholder="e.g. 30 Days PDC, Advance"
                          value={formPaymentTerms}
                          onChange={e => setFormPaymentTerms(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Delivery Location</label>
                        <input
                          type="text"
                          placeholder="e.g. Plant 2, Bhosari MIDC"
                          value={formDeliveryLocation}
                          onChange={e => setFormDeliveryLocation(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Next Purchase Expected</label>
                        <input
                          type="date"
                          value={formNextPurchaseExpected}
                          onChange={e => setFormNextPurchaseExpected(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Current Requirement Collected</label>
                      <input
                        type="text"
                        placeholder="e.g. Needs 10 MT HR Coil within 4 days"
                        value={formCurrentRequirement}
                        onChange={e => setFormCurrentRequirement(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                    </div>

                    <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block font-semibold text-slate-700">Follow-up Action &amp; Due Date</label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400 font-medium">Quick Due:</span>
                          <button
                            type="button"
                            onClick={() => setFollowupPresetDays(1, false)}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium cursor-pointer shadow-2xs">
                            +1d
                          </button>
                          <button
                            type="button"
                            onClick={() => setFollowupPresetDays(3, false)}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium cursor-pointer shadow-2xs">
                            +3d
                          </button>
                          <button
                            type="button"
                            onClick={() => setFollowupPresetDays(7, false)}
                            className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium cursor-pointer shadow-2xs">
                            +7d
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                          />
                        </div>
                        <div>
                          <input
                            type="date"
                            value={formFollowupDate}
                            onChange={e => setFormFollowupDate(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Meeting Remarks &amp; Requirements <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Details of discussion, products discussed, customer pain points..."
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

                    {/* Attachments Section */}
                    <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block font-semibold text-slate-700">Attachments</label>
                        <span className="text-[11px] text-slate-400">Optional</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Customer Visit Photo (GPS Tagged) */}
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium border border-blue-200 shadow-2xs transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handlePhotoFileChange(e.target.files?.[0] || null, false)}
                          />
                          <Camera size={13} />
                          <span>{capturingGps ? 'Capturing GPS...' : formGpsPhotoUrl ? 'Replace Photo' : 'Visit Photo (GPS)'}</span>
                        </label>

                        {/* Other Attachments */}
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-medium border border-slate-200 shadow-2xs transition-colors">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={e => handleOtherFilesChange(e.target.files, false)}
                          />
                          <Paperclip size={13} />
                          <span>Add Documents</span>
                        </label>
                      </div>

                      {/* GPS Photo Preview Card */}
                      {formGpsPhotoUrl && (
                        <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <img src={formGpsPhotoUrl} alt="Visit Photo" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 text-[11px] truncate">Customer Visit Photo</p>
                              {formGpsLat && formGpsLng ? (
                                <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <Compass size={10} className="text-blue-600 shrink-0" />
                                  GPS: {formGpsLat.toFixed(4)}, {formGpsLng.toFixed(4)} (±{formGpsAccuracy || 10}m)
                                </p>
                              ) : (
                                <p className="text-[10px] text-amber-600 font-medium">GPS location not captured</p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormGpsPhotoUrl(null);
                              setFormGpsLat(null);
                              setFormGpsLng(null);
                              setFormGpsAccuracy(null);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Remove Photo">
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {/* Other Attachments List */}
                      {formAttachments.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {formAttachments.map((att, idx) => (
                            <div key={idx} className="flex items-center justify-between p-1.5 px-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                              <span className="truncate max-w-[200px] font-medium text-slate-700 flex items-center gap-1.5">
                                <FileText size={12} className="text-slate-400 shrink-0" />
                                {att.name || att.file_name || 'Attachment'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
                                className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer">
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto"
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

              {/* Header Right: Outcome, Probability, Type Badges & Close Button */}
              <div className="flex items-center gap-2 flex-wrap">
                {!isEditing && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedVisit.customer_type && (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {selectedVisit.customer_type}
                      </span>
                    )}

                    {selectedVisit.customer_probability && (
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                          selectedVisit.customer_probability.toLowerCase() === 'hot'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : selectedVisit.customer_probability.toLowerCase() === 'warm'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                        {selectedVisit.customer_probability}
                      </span>
                    )}

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
                <div className="overflow-y-auto flex-1 space-y-4 pr-1.5 py-3 text-xs">
                  {/* 2-Column Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Card: Stakeholder & Contact Details */}
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5">
                      <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={13} /> Stakeholder &amp; Contact Info
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <p className="text-slate-400 font-medium">Person Met</p>
                          <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1 text-sm">
                            <User size={13} className="text-slate-400 shrink-0" />
                            {selectedVisit.person_met && selectedVisit.person_met !== 'null' ? selectedVisit.person_met : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Designation</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedVisit.designation || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Contact Phone</p>
                          <p className="font-semibold font-mono text-slate-800 mt-0.5 flex items-center gap-1">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            {selectedVisit.contact_phone || (selectedVisit as any).contact_no || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Email ID</p>
                          <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1 truncate">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            {selectedVisit.email || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">City / Location</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedVisit.location || (selectedVisit as any).customer_address || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Delivery Location</p>
                          <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                            <Truck size={12} className="text-slate-400 shrink-0" />
                            {selectedVisit.delivery_location || '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right Card: Commercial Intelligence & Requirements */}
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5">
                      <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase size={13} /> Commercial Intelligence
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <p className="text-slate-400 font-medium">Product Details</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedVisit.product_details || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Monthly Consumption</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedVisit.monthly_consumption || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Preferred Make / Brand</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedVisit.preferred_make || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Payment Terms</p>
                          <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                            <CreditCard size={12} className="text-slate-400 shrink-0" />
                            {selectedVisit.payment_terms || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Next Purchase Expected</p>
                          <p className="font-semibold text-slate-800 mt-0.5 font-mono">
                            {selectedVisit.next_purchase_expected
                              ? new Date(selectedVisit.next_purchase_expected).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400 font-medium">Visit Classification</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedVisit.visit_type || 'First Visit'}
                          </p>
                        </div>
                      </div>

                      {selectedVisit.current_requirement && (
                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-slate-400 font-medium text-[11px]">Current Requirement Collected</p>
                          <p className="font-medium text-slate-800 mt-0.5 leading-relaxed">
                            {selectedVisit.current_requirement}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meeting Remarks & Discussion */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                    <p className="text-xs font-semibold text-slate-500">Meeting Remarks &amp; Discussion</p>
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

                  {/* Follow-up Action & Status */}
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
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
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full inline-flex items-center gap-1 ${fu.badgeClass}`}>
                              {fu.urgency === 'completed' && <CheckCircle2 size={11} className="text-emerald-600" />}
                              {fu.urgency === 'overdue' && <AlertCircle size={11} className="text-rose-600" />}
                              {fu.urgency === 'today' && <Clock size={11} className="text-amber-600" />}
                              {fu.urgency === 'upcoming' && <Calendar size={11} className="text-blue-600" />}
                              {fu.urgency === 'no_date' && <Clock size={11} className="text-slate-500" />}
                              {fu.relativeText}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-slate-800 leading-relaxed break-words whitespace-pre-wrap font-medium">
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

                  {/* Attachments Section */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-semibold text-slate-500">Visit Attachments &amp; Geotag</p>

                    {selectedVisit.gps_photo_url || (Array.isArray(selectedVisit.attachments) && selectedVisit.attachments.length > 0) ? (
                      <div className="space-y-3">
                        {/* GPS Tagged Photo Card */}
                        {selectedVisit.gps_photo_url && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                            <img
                              src={selectedVisit.gps_photo_url}
                              alt="Visit Verification"
                              className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-2xs shrink-0"
                            />
                            <div className="space-y-1 min-w-0">
                              <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                <Camera size={14} className="text-blue-600" /> Customer Visit Photo
                              </p>
                              {selectedVisit.gps_latitude && selectedVisit.gps_longitude ? (
                                <div className="space-y-1">
                                  <p className="font-mono text-slate-600 text-[11px] flex items-center gap-1">
                                    <Compass size={12} className="text-blue-600" />
                                    Coordinates: {selectedVisit.gps_latitude.toFixed(5)}, {selectedVisit.gps_longitude.toFixed(5)}
                                    {selectedVisit.gps_accuracy ? ` (±${Math.round(selectedVisit.gps_accuracy)}m)` : ''}
                                  </p>
                                  <a
                                    href={`https://www.google.com/maps?q=${selectedVisit.gps_latitude},${selectedVisit.gps_longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-[11px] underline">
                                    <ExternalLink size={12} /> Open in Google Maps
                                  </a>
                                </div>
                              ) : (
                                <p className="text-slate-400 text-[11px]">No GPS coordinates captured for this photo.</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Other Attachments */}
                        {Array.isArray(selectedVisit.attachments) && selectedVisit.attachments.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-slate-500">Other Documents</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {selectedVisit.attachments.map((att: VisitAttachment, idx: number) => (
                                <a
                                  key={idx}
                                  href={att.url || att.file_url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center justify-between p-2 px-3 bg-white hover:bg-blue-50/50 rounded-lg border border-slate-200 text-xs text-slate-700 hover:text-blue-700 transition-colors group">
                                  <span className="truncate max-w-[200px] flex items-center gap-1.5 font-medium">
                                    <FileText size={13} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                                    {att.name || att.file_name || 'Attachment'}
                                  </span>
                                  <ExternalLink size={12} className="text-slate-400 group-hover:text-blue-600 shrink-0 ml-2" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs italic">No photo or document attachments recorded for this visit.</p>
                    )}
                  </div>
                </div>

                {/* View Mode Footer */}
                <div className="pt-3 border-t border-slate-100 flex justify-end items-center gap-2 shrink-0">
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
                <div className="overflow-y-auto flex-1 px-3.5 py-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left Column: Stakeholder & Classification */}
                    <div className="space-y-3.5">
                      <div className="pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 size={13} /> Company &amp; Contact Details
                        </span>
                      </div>

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
                          <label className="block font-semibold text-slate-700 mb-1">
                            Person Met <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editPersonMet}
                            onChange={e => {
                              setEditPersonMet(e.target.value);
                              if (editErrors.personMet) setEditErrors(prev => ({ ...prev, personMet: false }));
                            }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                              editErrors.personMet ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 font-medium'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Designation</label>
                          <input
                            type="text"
                            value={editDesignation}
                            onChange={e => setEditDesignation(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Contact Phone <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="e.g. 9822012345"
                            value={editContactPhone}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setEditContactPhone(val);
                              if (editErrors.contactPhone) setEditErrors(prev => ({ ...prev, contactPhone: false }));
                            }}
                            className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                              editErrors.contactPhone ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500 font-medium'
                            }`}
                          />
                          {editErrors.contactPhone && (
                            <p className="text-[11px] text-rose-500 font-semibold mt-1">
                              {typeof editErrors.contactPhone === 'string' ? editErrors.contactPhone : 'Please enter a valid 10-digit mobile number.'}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Email ID</label>
                          <input
                            type="email"
                            placeholder="e.g. suresh@company.com"
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
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
                          <label className="block font-semibold text-slate-700 mb-1">Customer Type</label>
                          <select
                            value={editCustomerType}
                            onChange={e => setEditCustomerType(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                            <option value="">Select Customer Type</option>
                            <option value="OEM">OEM</option>
                            <option value="Fabricator">Fabricator</option>
                            <option value="EPC">EPC</option>
                            <option value="Manufacturer">Manufacturer</option>
                            <option value="Trader">Trader</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Visit Date</label>
                          <input
                            type="date"
                            value={editVisitDate}
                            onChange={e => setEditVisitDate(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Visit Time</label>
                          <input
                            type="time"
                            value={editVisitTime}
                            onChange={e => setEditVisitTime(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Visit Type</label>
                          <select
                            value={editVisitType}
                            onChange={e => setEditVisitType(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                            <option value="First Visit">First Visit</option>
                            <option value="Follow-up 1">Follow-up 1</option>
                            <option value="Follow-up 2">Follow-up 2</option>
                            <option value="Follow-up 3">Follow-up 3</option>
                            <option value="Regular Visit">Regular Visit</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Visit Outcome</label>
                          <select
                            value={editOutcome}
                            onChange={e => setEditOutcome(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium">
                            <option value="positive">Positive</option>
                            <option value="neutral">Neutral</option>
                            <option value="negative">Negative</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Customer Probability</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Hot', 'Warm', 'Cold'].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setEditCustomerProbability(prev => prev === p ? '' : p)}
                              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                editCustomerProbability === p
                                  ? p === 'Hot'
                                    ? 'bg-rose-50 border-rose-400 text-rose-700 ring-2 ring-rose-200'
                                    : p === 'Warm'
                                    ? 'bg-amber-50 border-amber-400 text-amber-700 ring-2 ring-amber-200'
                                    : 'bg-sky-50 border-sky-400 text-sky-700 ring-2 ring-sky-200'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}>
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Commercials, Requirements, Follow-up & Attachments */}
                    <div className="space-y-3.5">
                      <div className="pb-1 border-b border-slate-100">
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase size={13} /> Commercial Intelligence &amp; Requirements
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Product Details</label>
                          <input
                            type="text"
                            placeholder="e.g. SS 304 Sheets 2mm, Pipe 4 inch"
                            value={editProductDetails}
                            onChange={e => setEditProductDetails(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Monthly Consumption</label>
                          <input
                            type="text"
                            placeholder="e.g. 50 MT/month"
                            value={editMonthlyConsumption}
                            onChange={e => setEditMonthlyConsumption(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Preferred Brand / Make</label>
                          <input
                            type="text"
                            placeholder="e.g. JSW, Jindal, Tata"
                            value={editPreferredMake}
                            onChange={e => setEditPreferredMake(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Payment Terms</label>
                          <input
                            type="text"
                            placeholder="e.g. 30 Days PDC, Advance"
                            value={editPaymentTerms}
                            onChange={e => setEditPaymentTerms(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Delivery Location</label>
                          <input
                            type="text"
                            placeholder="e.g. Plant 2, Bhosari MIDC"
                            value={editDeliveryLocation}
                            onChange={e => setEditDeliveryLocation(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Next Purchase Expected</label>
                          <input
                            type="date"
                            value={editNextPurchaseExpected}
                            onChange={e => setEditNextPurchaseExpected(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Current Requirement Collected</label>
                        <input
                          type="text"
                          placeholder="e.g. Needs 10 MT HR Coil within 4 days"
                          value={editCurrentRequirement}
                          onChange={e => setEditCurrentRequirement(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        />
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
                              +1d
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
                              +7d
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

                      {/* Edit Mode Attachments */}
                      <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="block font-semibold text-slate-700">Attachments</label>
                          <span className="text-[11px] text-slate-400">Optional</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium border border-blue-200 shadow-2xs transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={e => handlePhotoFileChange(e.target.files?.[0] || null, true)}
                            />
                            <Camera size={13} />
                            <span>{capturingGps ? 'Capturing GPS...' : editGpsPhotoUrl ? 'Replace Photo' : 'Visit Photo (GPS)'}</span>
                          </label>

                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-medium border border-slate-200 shadow-2xs transition-colors">
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={e => handleOtherFilesChange(e.target.files, true)}
                            />
                            <Paperclip size={13} />
                            <span>Add Documents</span>
                          </label>
                        </div>

                        {/* GPS Photo Preview */}
                        {editGpsPhotoUrl && (
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <img src={editGpsPhotoUrl} alt="Visit Photo" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 text-[11px] truncate">Customer Visit Photo</p>
                                {editGpsLat && editGpsLng ? (
                                  <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                    <Compass size={10} className="text-blue-600 shrink-0" />
                                    GPS: {editGpsLat.toFixed(4)}, {editGpsLng.toFixed(4)} (±{editGpsAccuracy || 10}m)
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-amber-600 font-medium">GPS location not captured</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setEditGpsPhotoUrl(null);
                                setEditGpsLat(null);
                                setEditGpsLng(null);
                                setEditGpsAccuracy(null);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Remove Photo">
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {/* Other Attachments List */}
                        {editAttachments.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {editAttachments.map((att, idx) => (
                              <div key={idx} className="flex items-center justify-between p-1.5 px-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                                <span className="truncate max-w-[200px] font-medium text-slate-700 flex items-center gap-1.5">
                                  <FileText size={12} className="text-slate-400 shrink-0" />
                                  {att.name || att.file_name || 'Attachment'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditAttachments(prev => prev.filter((_, i) => i !== idx))}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer">
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Mode Footer */}
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
    </div>
  );
}
