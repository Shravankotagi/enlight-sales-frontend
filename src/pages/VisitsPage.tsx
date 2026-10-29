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
  Trash2,
  Calendar,
  MoreVertical,
  Eye,
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
import VisitLocationField from '../components/VisitLocationField';
import VisitBrandField from '../components/VisitBrandField';
import VisitCameraCapture from '../components/VisitCameraCapture';
import VisitCustomerTypeField from '../components/VisitCustomerTypeField';
import {
  VISIT_BRANDS,
  VISIT_CUSTOMER_TYPES,
  VISIT_PAYMENT_TERMS,
  VISIT_WIZARD_STEPS,
  validateNewVisitForm,
  visitCalendarPlusDays,
  visitCalendarToday,
  visitCityLabel,
  visitWizardFieldKeys,
  visitWizardProgress,
  visitWizardStepErrors,
  visitCustomerTypeLabel,
  visitDocumentError,
  type NewVisitFormInput,
} from '../utils/visitForm';
import { createVisitGpsSession } from '../utils/visitGps';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  formatLocalDate,
  formatLocalTime,
  getDaysAgo,
} from '../utils/dateUtils';
import CustomerCombobox, { type CustomerDirectoryItem } from '../components/CustomerCombobox';
import PaginationControl from '../components/PaginationControl';
import { getVisitsSalespersonFilterValue } from '../utils/visitFilters';
import { Select } from '../components/ui/select';

import { type CustomerVisit, type VisitAttachment, getFollowUpStatusInfo } from '../utils/visitUtils';
export type { CustomerVisit, VisitAttachment };
export { getFollowUpStatusInfo };

const INDIAN_STATES = new Set([
  'andhra pradesh',
  'arunachal pradesh',
  'assam',
  'bihar',
  'chhattisgarh',
  'goa',
  'gujarat',
  'haryana',
  'himachal pradesh',
  'jharkhand',
  'karnataka',
  'kerala',
  'madhya pradesh',
  'maharashtra',
  'manipur',
  'meghalaya',
  'mizoram',
  'nagaland',
  'odisha',
  'orissa',
  'punjab',
  'rajasthan',
  'sikkim',
  'tamil nadu',
  'telangana',
  'tripura',
  'uttar pradesh',
  'uttarakhand',
  'uttaranchal',
  'west bengal',
  'delhi',
  'new delhi',
  'nct of delhi',
  'jammu and kashmir',
  'ladakh',
  'puducherry',
  'chandigarh',
  'andaman and nicobar islands',
  'dadra and nagar haveli and daman and diu',
  'lakshadweep',
]);

export function formatCityLocality(rawLocation?: string | null, rawAddress?: string | null): string {
  const str = (rawLocation || rawAddress || '').trim();
  if (!str || str === '-' || str.toLowerCase() === 'null') return '-';
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of str.split(',')) {
    const withoutPin = raw.replace(/\b\d{6}\b/g, '').replace(/\s+/g, ' ').trim();
    if (!withoutPin || /^india$/i.test(withoutPin)) continue;
    const key = withoutPin.toLowerCase();
    if (INDIAN_STATES.has(key) || seen.has(key)) continue;
    seen.add(key);
    parts.push(withoutPin);
  }
  if (!parts.length) return '-';
  return parts.slice(-2).join(', ');
}

function visitMapHref(visit: CustomerVisit): string | null {
  const lat = visit.visit_latitude ?? visit.gps_latitude;
  const lng = visit.visit_longitude ?? visit.gps_longitude;
  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /data:([^;,]+)/.exec(header)?.[1] || 'application/octet-stream';
  const binary = /;base64/i.test(header) ? atob(data) : decodeURIComponent(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function attachmentName(att: VisitAttachment): string {
  return att.name || att.file_name || 'Attachment';
}

function attachmentUrl(att: VisitAttachment): string {
  return att.url || att.file_url || '';
}

function isImageAttachment(att: VisitAttachment): boolean {
  const type = String(att.type || att.file_type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  return attachmentUrl(att).startsWith('data:image/');
}

function isPdfAttachment(att: VisitAttachment): boolean {
  const type = String(att.type || att.file_type || '').toLowerCase();
  if (type === 'application/pdf') return true;
  const url = attachmentUrl(att);
  if (url.startsWith('data:application/pdf')) return true;
  return attachmentName(att).toLowerCase().endsWith('.pdf');
}

export default function VisitsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetVisitId = searchParams.get('visitId') || searchParams.get('id');
  const returnTo = searchParams.get('returnTo');
  const autoOpenedVisitRef = useRef<string | null>(null);
  const [modalReturnTo, setModalReturnTo] = useState<string | null>(() => searchParams.get('returnTo'));

  const { isSalesManager, isAdmin, effectivePhone, activeRole, activeMode, viewingAs, can, guardAction } = useAuth();
  const viewingAsName = viewingAs?.name;
  const viewingAsPhone = viewingAs?.phone;
  const canViewSalesperson = isSalesManager || isAdmin;
  const canEditVisit = can('visits.update');
  const canDeleteVisit = can('visits.delete');

  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('all');
  const [filterFollowup, setFilterFollowup] = useState(() => searchParams.get('followup') || 'all');
  const [filterSalesperson, setFilterSalesperson] = useState<string>(() => getVisitsSalespersonFilterValue({ name: viewingAsName }));
  const [filterCustomerType, setFilterCustomerType] = useState<string>('all');
  const [filterProbability, setFilterProbability] = useState<string>('all');
  const [filterVisitType, setFilterVisitType] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [visitPendingDelete, setVisitPendingDelete] = useState<CustomerVisit | null>(null);
  const [deletingVisit, setDeletingVisit] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const fuParam = searchParams.get('followup');
    if (fuParam) {
      setFilterFollowup(fuParam);
    }
  }, [searchParams]);

  useEffect(() => {
    setFilterSalesperson(getVisitsSalespersonFilterValue({ name: viewingAsName }));
  }, [viewingAsName, viewingAsPhone]);

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
    if (cust.location && !formLocation && locationSource !== 'gps') {
      setFormLocation(cust.location);
      if (formErrors.location) setFormErrors(prev => ({ ...prev, location: false }));
    }
    if (cust.email && !formEmail) setFormEmail(cust.email);
    if (cust.designation && !formDesignation) setFormDesignation(cust.designation);
    if (cust.customer_type && !formCustomerType) setFormCustomerType(cust.customer_type);
    if (cust.delivery_location && !formDeliveryLocation) setFormDeliveryLocation(cust.delivery_location);
    if (cust.preferred_make && formBrands.length === 0) {
      const brands = String(cust.preferred_make)
        .split(',')
        .map(brand => brand.trim())
        .filter(brand => VISIT_BRANDS.includes(brand as (typeof VISIT_BRANDS)[number]));
      if (brands.length > 0) setFormBrands(brands);
    }
    if (
      cust.payment_terms &&
      !formPaymentTerms &&
      VISIT_PAYMENT_TERMS.includes(cust.payment_terms as (typeof VISIT_PAYMENT_TERMS)[number])
    ) {
      setFormPaymentTerms(cust.payment_terms);
    }
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
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; kind?: 'image' | 'pdf' } | null>(null);
  const previewBlobRef = useRef<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const closeVisitPreview = () => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setPreviewImage(null);
  };

  const openVisitPreview = (url: string, title: string, kind: 'image' | 'pdf' = 'image') => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    if (kind === 'pdf') {
      const blobUrl = URL.createObjectURL(dataUrlToBlob(url));
      previewBlobRef.current = blobUrl;
      setPreviewImage({ url: blobUrl, title, kind: 'pdf' });
      return;
    }
    setPreviewImage({ url, title, kind: 'image' });
  };

  useEffect(() => () => {
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
  }, []);

  useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeVisitPreview();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

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
  const [createStep, setCreateStep] = useState(0);

  // Extended Fields for Create Form
  const [formEmail, setFormEmail] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formCustomerType, setFormCustomerType] = useState('');
  const [formCustomerTypeOther, setFormCustomerTypeOther] = useState('');
  const [formVisitType, setFormVisitType] = useState('First Visit');
  const [formCustomerProbability, setFormCustomerProbability] = useState('');
  const [formProductDetails, setFormProductDetails] = useState('');
  const [formMonthlyConsumption, setFormMonthlyConsumption] = useState('');
  const [formCurrentRequirement, setFormCurrentRequirement] = useState('');
  const [formNextPurchaseExpected, setFormNextPurchaseExpected] = useState('');
  const [formDeliveryLocation, setFormDeliveryLocation] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formGpsPhotoUrl, setFormGpsPhotoUrl] = useState<string | null>(null);
  const [formGpsLat, setFormGpsLat] = useState<number | null>(null);
  const [formGpsLng, setFormGpsLng] = useState<number | null>(null);
  const [formGpsAccuracy, setFormGpsAccuracy] = useState<number | null>(null);
  const [formAttachments, setFormAttachments] = useState<VisitAttachment[]>([]);
  const [formBrands, setFormBrands] = useState<string[]>([]);
  const [formBrandOther, setFormBrandOther] = useState('');
  const [locationSource, setLocationSource] = useState<'' | 'gps' | 'manual'>('');
  const [visitLat, setVisitLat] = useState<number | null>(null);
  const [visitLng, setVisitLng] = useState<number | null>(null);
  const [visitAccuracy, setVisitAccuracy] = useState<number | null>(null);
  const [locationNotice, setLocationNotice] = useState('');
  const [locationLocked, setLocationLocked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [capturingGps, setCapturingGps] = useState(false);
  const gpsSessionRef = useRef<ReturnType<typeof createVisitGpsSession> | null>(null);
  const visitGps = () => {
    if (!gpsSessionRef.current) gpsSessionRef.current = createVisitGpsSession();
    return gpsSessionRef.current;
  };

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
  const watchVisitGps = () => visitGps().watchForAddress();
  const readPhotoGps = () => visitGps().readForPhoto();

  const refreshVisitLocation = async () => {
    setLocating(true);
    setLocationNotice('');
    try {
      const coords = await watchVisitGps();
      if (!coords) {
        setLocationSource('manual');
        setLocationLocked(false);
        setVisitLat(null);
        setVisitLng(null);
        setVisitAccuracy(null);
        setLocationNotice('Location permission was denied or GPS is unavailable. Enter the city, or retry.');
        return;
      }
      let city = '';
      try {
        const res = await visitsApi.reverseGeocode(coords.latitude, coords.longitude);
        const body = res?.data?.data || res?.data;
        city = visitCityLabel(body?.address) || visitCityLabel(body?.city);
      } catch {
        city = '';
      }
      setVisitLat(coords.latitude);
      setVisitLng(coords.longitude);
      setVisitAccuracy(coords.accuracy);
      setLocationSource('gps');
      setLocationLocked(Boolean(city));
      setFormLocation(city);
      if (coords.accuracy > 50) {
        setLocationNotice(
          `The device could only locate within ${coords.accuracy} meters. Retry outdoors.${city ? '' : ' Or type the location.'}`,
        );
      } else if (!city) {
        setLocationNotice('Type the city.');
      }
      setFormErrors(prev => ({ ...prev, location: false }));
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const newVisitInput = (): NewVisitFormInput => ({
    customerName: formCustomerName,
    personMet: formPersonMet,
    designation: formDesignation,
    contactPhone: formContactPhone,
    email: formEmail,
    location: formLocation,
    locationSource,
    customerType: formCustomerType,
    customerTypeOther: formCustomerTypeOther,
    visitDate: formVisitDate,
    visitTime: formVisitTime,
    visitType: formVisitType,
    outcome: formOutcome,
    probability: formCustomerProbability,
    productDetails: formProductDetails,
    monthlyConsumption: formMonthlyConsumption,
    brands: formBrands,
    brandOther: formBrandOther,
    paymentTerms: formPaymentTerms,
    deliveryLocation: formDeliveryLocation,
    nextPurchase: formNextPurchaseExpected,
    currentRequirement: formCurrentRequirement,
    followup: formFollowup,
    followupDate: formFollowupDate,
    remarks: formRemarks,
    photoUrl: formGpsPhotoUrl,
    photoLatitude: formGpsLat,
    photoLongitude: formGpsLng,
    otpVerified,
  });

  const handlePhotoFileChange = async (file: File | null, isEdit = false) => {
    if (!file) return;
    setCapturingGps(true);
    try {
      const coords = await readPhotoGps();
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
          setFormErrors((prev) => ({ ...prev, attachments: false }));
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
          setFormErrors((prev) => ({ ...prev, attachments: false }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Reset form and open Add New Visit modal cleanly
  const handleOpenAddModal = () => {
    if (!guardAction('visits.log')) return;
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
    setFormCustomerTypeOther('');
    setFormVisitType('First Visit');
    setFormCustomerProbability('');
    setFormProductDetails('');
    setFormMonthlyConsumption('');
    setFormCurrentRequirement('');
    setFormNextPurchaseExpected('');
    setFormDeliveryLocation('');
    setFormPaymentTerms('');
    setFormBrands([]);
    setFormBrandOther('');
    setLocationSource('');
    setLocationLocked(false);
    setVisitLat(null);
    setVisitLng(null);
    setLocationNotice('');
    setOtpCode('');
    setOtpVerified(false);
    setVerificationToken('');
    setOtpNotice('');
    setResendSeconds(0);
    setFormGpsPhotoUrl(null);
    setFormGpsLat(null);
    setFormGpsLng(null);
    setFormGpsAccuracy(null);
    setFormAttachments([]);
    setCreateStep(0);

    setShowModal(true);
    void refreshVisitLocation();
  };

  const closeCreateModal = () => {
    setShowModal(false);
    setCreateStep(0);
  };

  const openCreateStep = (index: number) => {
    if (index === createStep) return;
    if (index < createStep) {
      setFormErrors({});
      setCreateStep(index);
      return;
    }
    const input = newVisitInput();
    for (let step = createStep; step < index; step += 1) {
      const stepErrors = visitWizardStepErrors(input, step);
      if (Object.keys(stepErrors).length > 0) {
        setFormErrors(stepErrors);
        setCreateStep(step);
        return;
      }
    }
    setFormErrors({});
    setCreateStep(index);
  };

  const goToNextCreateStep = () => {
    const stepErrors = visitWizardStepErrors(newVisitInput(), createStep);
    if (Object.keys(stepErrors).length > 0) {
      setFormErrors(stepErrors);
      return;
    }
    setFormErrors({});
    setCreateStep((step) => Math.min(step + 1, VISIT_WIZARD_STEPS.length - 1));
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
  const [editCustomerTypeOther, setEditCustomerTypeOther] = useState('');
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

  const confirmDeleteVisit = async () => {
    if (!visitPendingDelete) return;
    setDeletingVisit(true);
    try {
      await visitsApi.delete(visitPendingDelete.id);
      toast.success('Visit deleted');
      if (selectedVisit?.id === visitPendingDelete.id) setSelectedVisit(null);
      setVisitPendingDelete(null);
      await fetchVisits(true);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Could not delete this visit';
      toast.error(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg);
    } finally {
      setDeletingVisit(false);
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

  const sendVisitCode = async () => {
    const errors = validateNewVisitForm(newVisitInput(), { requireOtp: false });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setOtpNotice('Complete the form before sending the code.');
      return;
    }
    try {
      setOtpSending(true);
      setOtpNotice('');
      const res = await visitsApi.requestVisitOtp(formContactPhone);
      const body = res?.data?.data || res?.data;
      setResendSeconds(Number(body?.resend_after_seconds) || 60);
      setOtpNotice(
        body?.test_otp
          ? `Temporary test code: ${body.test_otp}. WhatsApp was not used.`
          : body?.message || 'Code sent to the customer WhatsApp number.',
      );
      setOtpVerified(false);
      setVerificationToken('');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'The visit code could not be sent.';
      setOtpNotice(Array.isArray(message) ? message.join(' ') : String(message));
    } finally {
      setOtpSending(false);
    }
  };

  const confirmVisitCode = async () => {
    if (!otpCode.trim()) {
      setOtpNotice('Enter the code from WhatsApp.');
      return;
    }
    try {
      setOtpSending(true);
      const res = await visitsApi.verifyVisitOtp(formContactPhone, otpCode.trim());
      const body = res?.data?.data || res?.data;
      if (!body?.verification_token) {
        setOtpNotice('That code is incorrect.');
        setOtpVerified(false);
        return;
      }
      setVerificationToken(body.verification_token);
      setOtpVerified(true);
      setOtpNotice('Phone verified.');
      setFormErrors(prev => ({ ...prev, otp: false }));
    } catch (err: any) {
      const message = err?.response?.data?.message || 'That code is incorrect.';
      setOtpVerified(false);
      setVerificationToken('');
      setOtpNotice(Array.isArray(message) ? message.join(' ') : String(message));
    } finally {
      setOtpSending(false);
    }
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardAction('visits.log')) return;

    const input = newVisitInput();
    const errors = validateNewVisitForm(input);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstInvalid = VISIT_WIZARD_STEPS.findIndex((_, step) =>
        visitWizardFieldKeys(step, input).some((field) => errors[field]),
      );
      if (firstInvalid >= 0) setCreateStep(firstInvalid);
      return;
    }

    try {
      setSubmitting(true);
      const [vYear, vMonth, vDay] = formVisitDate.split('-').map(Number);
      const [vHour, vMinute] = (formVisitTime || formatLocalTime()).split(':').map(Number);
      const visitedAtDate = new Date(vYear, vMonth - 1, vDay, vHour, vMinute, 0);
      const cleanContactPhone = formContactPhone.replace(/\D/g, '');

      await visitsApi.create({
        customer_name: formCustomerName.trim(),
        person_met: formPersonMet.trim(),
        contact_phone: cleanContactPhone,
        location: formLocation.trim(),
        location_source: locationSource,
        visit_latitude: visitLat,
        visit_longitude: visitLng,
        outcome: formOutcome,
        remarks: formRemarks.trim(),
        follow_up_action: formFollowup.trim(),
        follow_up_date: formFollowupDate,
        visited_at: visitedAtDate.toISOString(),
        email: formEmail.trim(),
        designation: formDesignation.trim(),
        customer_type: formCustomerType,
        customer_type_other: formCustomerType === 'Other' ? formCustomerTypeOther.trim() : null,
        visit_type: formVisitType,
        customer_probability: formCustomerProbability,
        product_details: formProductDetails.trim(),
        monthly_consumption: formMonthlyConsumption.trim(),
        current_requirement: formCurrentRequirement.trim(),
        next_purchase_expected: formNextPurchaseExpected,
        delivery_location: formDeliveryLocation.trim(),
        preferred_make: formBrands,
        preferred_make_other: formBrandOther.trim(),
        payment_terms: formPaymentTerms,
        gps_photo_url: formGpsPhotoUrl,
        gps_latitude: formGpsLat,
        gps_longitude: formGpsLng,
        gps_accuracy: formGpsAccuracy,
        attachments: formAttachments,
        verification_token: verificationToken,
      });

      queryClient.invalidateQueries({ queryKey: ['customers-churn'] });
      queryClient.invalidateQueries({ queryKey: ['customers-directory'] });

      setIsSavedSuccess(true);
      toast.success('Visit log saved successfully!');

      setTimeout(() => {
        setIsSavedSuccess(false);
        setShowModal(false);
        setCreateStep(0);
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
        setFormCustomerTypeOther('');
        setFormVisitType('First Visit');
        setFormCustomerProbability('');
        setFormProductDetails('');
        setFormMonthlyConsumption('');
        setFormCurrentRequirement('');
        setFormNextPurchaseExpected('');
        setFormDeliveryLocation('');
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
    setIsEditing(canEditVisit ? editMode : false);
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
    setEditCustomerTypeOther(v.customer_type_other || '');
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
    if (!guardAction('visits.update')) return;
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
    if (editCustomerType === 'Other' && !editCustomerTypeOther.trim()) {
      errors.customerTypeOther = 'Enter the other customer type.';
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
        customer_type_other: editCustomerType === 'Other' ? editCustomerTypeOther.trim() : null,
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

  const createProgress = visitWizardProgress(newVisitInput(), createStep);

  return (
    <div className="flex flex-col min-w-0 overflow-x-hidden lg:h-[calc(100dvh-3rem)] space-y-4 animate-fade-in font-sans">
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
            {can('visits.log') && (
              <button
                onClick={handleOpenAddModal}
                className="h-9 flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0">
                <Plus size={15} />
                Log Customer Visit
              </button>
            )}
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
            <Select
              value={filterSalesperson}
              onChange={e => setFilterSalesperson(e.target.value)}
              prefixIcon={<Users size={14} className="text-blue-600" />}
              wrapperClassName="w-full sm:w-auto inline-flex"
              className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
              menuClassName="w-56"
            >
              <option value="all">All Salespersons ({salespeopleList.length})</option>
              {salespeopleList.map((sp: any) => (
                <option key={sp.phone || sp.name} value={sp.name}>
                  {sp.name}
                </option>
              ))}
            </Select>
          )}

          {/* 3. Date Preset Dropdown with 'Last 30 Days' default */}
          <Select
            value={dayPreset}
            onChange={e => handleDayPresetChange(e.target.value)}
            prefixIcon={<Calendar size={14} className="text-blue-600" />}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-44"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7_days">Last 7 Days</option>
            <option value="30_days">Last 30 Days</option>
            <option value="90_days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </Select>

          {/* 4. Outcome Dropdown */}
          <Select
            value={filterOutcome}
            onChange={e => setFilterOutcome(e.target.value)}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-48"
          >
            <option value="all">All Outcomes ({baseScopedVisits.length})</option>
            <option value="positive">Positive ({positiveVisits})</option>
            <option value="neutral">Neutral ({neutralVisits})</option>
            <option value="negative">Negative ({negativeVisits})</option>
          </Select>

          {/* 5. Follow-up Dropdown */}
          <Select
            value={filterFollowup}
            onChange={e => setFilterFollowup(e.target.value)}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-52"
          >
            <option value="all">All Follow-ups ({baseScopedVisits.length})</option>
            <option value="due">Due / Overdue ({dueFollowupsCount})</option>
            <option value="overdue">Overdue ({overdueFollowupsCount})</option>
            <option value="due_today">Due Today ({dueTodayFollowupsCount})</option>
            <option value="pending">All Pending ({pendingFollowupsCount})</option>
            <option value="completed">Completed ({completedFollowupsCount})</option>
            <option value="none">No Follow-up</option>
          </Select>

          {/* 6. Customer Type Dropdown */}
          <Select
            value={filterCustomerType}
            onChange={e => setFilterCustomerType(e.target.value)}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-48"
          >
            <option value="all">All Customer Types</option>
            {VISIT_CUSTOMER_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </Select>

          {/* 7. Customer Probability Dropdown */}
          <Select
            value={filterProbability}
            onChange={e => setFilterProbability(e.target.value)}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-48"
          >
            <option value="all">All Probabilities</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </Select>

          {/* 8. Visit Type Dropdown */}
          <Select
            value={filterVisitType}
            onChange={e => setFilterVisitType(e.target.value)}
            wrapperClassName="w-full sm:w-auto inline-flex"
            className="w-full sm:w-auto px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 shadow-2xs cursor-pointer gap-2"
            menuClassName="w-48"
          >
            <option value="all">All Visit Types</option>
            <option value="First Visit">First Visit</option>
            <option value="Follow-up 1">Follow-up 1</option>
            <option value="Follow-up 2">Follow-up 2</option>
            <option value="Follow-up 3">Follow-up 3</option>
            <option value="Regular Visit">Regular Visit</option>
          </Select>

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
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200 text-xs animate-in fade-in duration-150">
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
        <div className={`flex-1 min-h-0 overflow-auto ${!loading && filtered.length === 0 ? 'flex flex-col' : ''}`}>
          <div className="lg:hidden divide-y divide-slate-200">
            {loading ? (
              <div className="px-4 py-12 text-center text-slate-400">
                <RefreshCw size={20} className="animate-spin inline mr-2 text-blue-600" />
                Loading visit logs...
              </div>
            ) : (
              paginatedVisits.map((v) => {
                const outcomeLower = getNormalizedOutcome(v);
                const phone = v.contact_phone || (v as any).phone || (v as any).customer_phone || (v as any).contact_no || '';
                const fullAddress = (v.location || (v as any).customer_address || '').trim();
                const shortLocation = formatCityLocality(v.location, (v as any).customer_address);
                const mapHref = visitMapHref(v);
                const followUp = getFollowUpStatusInfo(v);
                const outcomeClass =
                  outcomeLower === 'positive'
                    ? 'bg-emerald-100 text-emerald-800'
                    : outcomeLower === 'neutral'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800';
                const outcomeLabel =
                  outcomeLower === 'positive' ? 'Positive' : outcomeLower === 'neutral' ? 'Neutral' : 'Negative';
                return (
                  <article key={v.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{v.customer_name || 'Customer'}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {v.visited_at ? new Date(v.visited_at).toLocaleString('en-IN') : '-'}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full ${outcomeClass}`}>
                        {outcomeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      <span className="text-slate-400">Contact </span>
                      {v.person_met && v.person_met !== 'null' ? v.person_met : '-'}
                      {phone ? ` · ${phone}` : ''}
                    </p>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2" title={fullAddress || undefined}>
                      {shortLocation}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">
                        {followUp.hasFollowUp ? followUp.relativeText : 'No follow-up'}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {mapHref && (
                          <a
                            href={mapHref}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open in Google Maps"
                            title="Open in Google Maps"
                            className="text-blue-600">
                            <MapIcon size={14} />
                          </a>
                        )}
                        {v.phone_verified && (
                          <CheckCircle2 size={14} className="text-emerald-600" aria-label="Phone verified" />
                        )}
                        <button
                          type="button"
                          onClick={() => openVisitDetails(v, false)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg">
                          View
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          <table className="hidden lg:table w-full table-fixed text-left text-sm text-slate-700">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[11%]" />
              <col className="w-[16%]" />
              <col className="w-[7%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider shadow-2xs">
              <tr>
                <th className="px-3 py-3.5 text-center whitespace-nowrap">Sr. No.</th>
                <th className="px-5 py-3.5 text-left">Customer</th>
                <th className="px-4 py-3.5 text-left">Contact Person</th>
                <th className="px-4 py-3.5 text-left">Location</th>
                <th className="px-4 py-3.5 text-center">Outcome</th>
                <th className="px-4 py-3.5 text-left">Follow-up</th>
                <th className="pl-4 pr-6 sm:pr-8 py-3.5 text-center">Actions</th>
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
              ) : filtered.length === 0 ? null : (
                paginatedVisits.map((v, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const outcomeLower = getNormalizedOutcome(v);
                  const customerTypeLabel = visitCustomerTypeLabel(v.customer_type, v.customer_type_other);
                  const phone = v.contact_phone || (v as any).phone || (v as any).customer_phone || (v as any).contact_no || '-';
                  const salespersonName = getSalespersonDisplayName(v);

                  return (
                    <tr
                      key={v.id || idx}
                      className="hover:bg-slate-50/70 transition-colors group align-top">
                      {/* 0. Serial Number */}
                      <td data-label="Sr. No." className="px-3 py-3.5 font-medium text-slate-500 text-center">
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
                          {customerTypeLabel && (
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {customerTypeLabel}
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
                              title="Visit photo attached"
                              className="p-1 rounded-md text-slate-600 bg-slate-100 border border-slate-200 inline-flex items-center">
                              <Paperclip size={10} />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Contact Person */}
                      <td className="px-4 py-3.5 text-xs overflow-hidden">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 min-w-0">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{v.person_met && v.person_met !== 'null' ? v.person_met : '-'}</span>
                        </div>
                        {v.designation && (
                          <div className="text-[11px] text-slate-500 font-medium pl-5 mt-0.5 truncate">
                            {v.designation}
                          </div>
                        )}
                        {phone && phone !== '-' && (
                          <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5 min-w-0">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{phone}</span>
                          </div>
                        )}
                        {v.email && (
                          <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5 min-w-0">
                            <Mail size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{v.email}</span>
                          </div>
                        )}
                      </td>

                      {/* 3. Location */}
                      <td className="px-4 py-3.5 text-xs align-top overflow-hidden">
                        {(() => {
                          const fullAddress = (v.location || (v as any).customer_address || '').trim();
                          const mapHref = visitMapHref(v);
                          return (
                            <div className="flex items-center gap-1.5 min-w-0">
                              {mapHref ? (
                                <a
                                  href={mapHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label="Open in Google Maps"
                                  title="Open in Google Maps"
                                  className="text-blue-600 shrink-0">
                                  <MapIcon size={12} />
                                </a>
                              ) : (
                                <MapIcon size={12} className="text-slate-400 shrink-0" />
                              )}
                              <span
                                className="min-w-0 truncate font-semibold text-slate-800"
                                title={fullAddress || undefined}>
                                {formatCityLocality(v.location, (v as any).customer_address)}
                              </span>
                              {v.phone_verified && (
                                <CheckCircle2
                                  size={12}
                                  className="shrink-0 text-emerald-600"
                                  aria-label="Phone verified"
                                />
                              )}
                            </div>
                          );
                        })()}
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
                            <div className="space-y-1.5">
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
                      <td data-label="Actions" className="pl-4 pr-6 sm:pr-8 py-3.5 text-center relative">
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
                              {canEditVisit && (
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
                              )}
                              {canDeleteVisit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setVisitPendingDelete(v);
                                  }}
                                  className="w-full px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer">
                                  <Trash2 size={14} className="text-rose-500" />
                                  Delete
                                </button>
                              )}
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
          {!loading && filtered.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 text-center text-slate-400">
              <MapPin size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-600 font-medium">No visit logs found.</p>
              <p className="text-xs text-slate-400 mt-1">Try changing date range or filters, or log a new visit.</p>
            </div>
          )}
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
        <div className="mobile-sheet-overlay fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div
            role="dialog"
            aria-labelledby="log-visit-title"
            className="visit-wizard mobile-sheet bg-white rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="sheet-header pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <h2 id="log-visit-title" className="text-base sm:text-lg font-bold text-slate-900">
                  Log customer field visit
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-sm font-bold text-slate-800">
                    {createProgress.filled}/{createProgress.total}
                  </p>
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    aria-label="Close"
                    className="wizard-tap text-slate-400 hover:text-slate-600 p-2 rounded-lg transition-colors cursor-pointer">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${createProgress.total ? (createProgress.filled / createProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <nav aria-label="Visit form steps" className="mt-3 flex gap-1 overflow-x-auto pb-1 shrink-0">
              {VISIT_WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  onClick={() => openCreateStep(index)}
                  aria-label={`Step ${index + 1} ${step.title}`}
                  aria-current={createStep === index ? 'step' : undefined}
                  className={`wizard-tap shrink-0 rounded-lg px-3 py-2 text-left ${
                    createStep === index
                      ? 'border-b-2 border-blue-600 text-blue-700'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide">Step {index + 1}</span>
                  <span className="block text-xs font-bold whitespace-nowrap">{step.title}</span>
                </button>
              ))}
            </nav>

            <form onSubmit={handleCreateVisit} className="flex flex-col flex-1 overflow-hidden mt-3">
              <div className="overflow-y-auto flex-1 px-1 py-2.5 text-xs">
                {isSavedSuccess && (
                  <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 animate-fadeIn">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Visit log saved successfully! Redirecting...
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-3.5">
                    {createStep === 0 && (
                    <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">1</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Company &amp; contact</p>
                        <p className="text-[11px] text-slate-500">Who you met</p>
                      </div>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                          Designation <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Purchase Head"
                          value={formDesignation}
                          onChange={e => {
                            setFormDesignation(e.target.value);
                            if (formErrors.designation) setFormErrors(prev => ({ ...prev, designation: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                            formErrors.designation ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                        {formErrors.designation && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.designation)}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                            setOtpVerified(false);
                            setVerificationToken('');
                            setOtpCode('');
                            setOtpNotice('');
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
                        <label className="block font-semibold text-slate-700 mb-1">
                          Email ID <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="e.g. suresh@company.com"
                          value={formEmail}
                          onChange={e => {
                            setFormEmail(e.target.value);
                            if (formErrors.email) setFormErrors(prev => ({ ...prev, email: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none transition-all ${
                            formErrors.email ? 'border-rose-500 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                          }`}
                        />
                        {formErrors.email && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.email)}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                      <VisitLocationField
                        value={formLocation}
                        source={locationSource}
                        cityLocked={locationLocked}
                        latitude={visitLat}
                        longitude={visitLng}
                        accuracy={visitAccuracy}
                        notice={locationNotice}
                        locating={locating}
                        error={formErrors.location}
                        onRetry={() => { void refreshVisitLocation(); }}
                        onManualChange={value => {
                          setFormLocation(value);
                          if (formErrors.location) setFormErrors(prev => ({ ...prev, location: false }));
                        }}
                      />
                      </div>

                      <div>
                        <VisitCustomerTypeField
                          required
                          value={formCustomerType}
                          other={formCustomerTypeOther}
                          error={formErrors.customerType}
                          otherError={formErrors.customerTypeOther}
                          onChange={(value) => {
                            setFormCustomerType(value);
                            if (value !== 'Other') setFormCustomerTypeOther('');
                            if (formErrors.customerType || formErrors.customerTypeOther) {
                              setFormErrors((prev) => ({ ...prev, customerType: false, customerTypeOther: false }));
                            }
                          }}
                          onOtherChange={(value) => {
                            setFormCustomerTypeOther(value);
                            if (formErrors.customerTypeOther) {
                              setFormErrors((prev) => ({ ...prev, customerTypeOther: false }));
                            }
                          }}
                        />
                      </div>
                    </div>
                    </div>
                    )}

                    {createStep === 1 && (
                    <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">2</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Visit details</p>
                        <p className="text-[11px] text-slate-500">When and how it went</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <label className="block font-semibold text-slate-700 mb-1">
                          Visit Time <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          value={formVisitTime}
                          onChange={e => {
                            setFormVisitTime(e.target.value);
                            if (formErrors.visitTime) setFormErrors(prev => ({ ...prev, visitTime: false }));
                          }}
                          className={`w-full px-2.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium ${
                            formErrors.visitTime ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.visitTime && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.visitTime)}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Visit type <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['First Visit', 'Follow-up 1', 'Follow-up 2', 'Follow-up 3', 'Regular Visit'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setFormVisitType(type);
                              if (formErrors.visitType) setFormErrors(prev => ({ ...prev, visitType: false }));
                            }}
                            className={`wizard-choice rounded-xl border px-3 py-2 text-xs font-bold ${
                              formVisitType === type
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}>
                            {type}
                          </button>
                        ))}
                      </div>
                      {formErrors.visitType && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.visitType)}</p>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Outcome <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          ['positive', 'Positive'],
                          ['neutral', 'Neutral'],
                          ['negative', 'Negative'],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setFormOutcome(value);
                              if (formErrors.outcome) setFormErrors(prev => ({ ...prev, outcome: false }));
                            }}
                            className={`wizard-choice rounded-xl border px-3 py-2 text-xs font-bold ${
                              formOutcome === value
                                ? 'border-blue-600 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Customer Probability <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {['Hot', 'Warm', 'Cold'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setFormCustomerProbability(p);
                              if (formErrors.probability) setFormErrors(prev => ({ ...prev, probability: false }));
                            }}
                            className={`wizard-choice rounded-xl text-xs font-bold border transition-all cursor-pointer ${
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
                      {formErrors.probability && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.probability)}</p>
                      )}
                    </div>
                    </div>
                    )}
                  </div>

                  <div className="space-y-3.5">
                    {createStep === 2 && (
                    <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">3</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Commercial intelligence</p>
                        <p className="text-[11px] text-slate-500">What they need and buy</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Product Details <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SS 304 Sheets 2mm, Pipe 4 inch"
                          value={formProductDetails}
                          onChange={e => {
                            setFormProductDetails(e.target.value);
                            if (formErrors.productDetails) setFormErrors(prev => ({ ...prev, productDetails: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                            formErrors.productDetails ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.productDetails && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.productDetails)}</p>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Monthly Consumption <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 50 MT/month"
                          value={formMonthlyConsumption}
                          onChange={e => {
                            setFormMonthlyConsumption(e.target.value);
                            if (formErrors.monthlyConsumption) setFormErrors(prev => ({ ...prev, monthlyConsumption: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                            formErrors.monthlyConsumption ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.monthlyConsumption && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.monthlyConsumption)}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <VisitBrandField
                          selected={formBrands}
                          other={formBrandOther}
                          error={formErrors.brands}
                          otherError={formErrors.brandOther}
                          onToggle={brand => {
                            setFormBrands(current => current.includes(brand)
                              ? current.filter(item => item !== brand)
                              : [...current, brand]);
                            if (formErrors.brands || formErrors.brandOther) {
                              setFormErrors(prev => ({ ...prev, brands: false, brandOther: false }));
                            }
                          }}
                          onOtherChange={value => {
                            setFormBrandOther(value);
                            if (formErrors.brandOther) setFormErrors(prev => ({ ...prev, brandOther: false }));
                          }}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Payment Terms <span className="text-rose-500">*</span>
                        </label>
                        <select
                          aria-label="Payment Terms"
                          value={formPaymentTerms}
                          onChange={e => {
                            setFormPaymentTerms(e.target.value);
                            if (formErrors.paymentTerms) setFormErrors(prev => ({ ...prev, paymentTerms: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium ${
                            formErrors.paymentTerms ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                          }`}>
                          <option value="" disabled hidden>Select Payment Terms</option>
                          {VISIT_PAYMENT_TERMS.map(term => (
                            <option key={term} value={term}>{term}</option>
                          ))}
                        </select>
                        {formErrors.paymentTerms && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.paymentTerms)}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Delivery Location <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Plant 2, Bhosari MIDC"
                          value={formDeliveryLocation}
                          onChange={e => {
                            setFormDeliveryLocation(e.target.value);
                            if (formErrors.deliveryLocation) setFormErrors(prev => ({ ...prev, deliveryLocation: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                            formErrors.deliveryLocation ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.deliveryLocation && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.deliveryLocation)}</p>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Next Purchase Expected <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          aria-label="Next Purchase Expected"
                          min={visitCalendarToday()}
                          value={formNextPurchaseExpected}
                          onChange={e => {
                            setFormNextPurchaseExpected(e.target.value);
                            if (formErrors.nextPurchase) setFormErrors(prev => ({ ...prev, nextPurchase: false }));
                          }}
                          className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer ${
                            formErrors.nextPurchase ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                          }`}
                        />
                        {formErrors.nextPurchase && (
                          <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.nextPurchase)}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Current Requirement Collected <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Needs 10 MT HR Coil within 4 days"
                        value={formCurrentRequirement}
                        onChange={e => {
                          setFormCurrentRequirement(e.target.value);
                          if (formErrors.currentRequirement) setFormErrors(prev => ({ ...prev, currentRequirement: false }));
                        }}
                        className={`w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium ${
                          formErrors.currentRequirement ? 'border-rose-500 bg-rose-50/30' : 'border-slate-300'
                        }`}
                      />
                      {formErrors.currentRequirement && (
                        <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.currentRequirement)}</p>
                      )}
                    </div>
                    </div>
                    )}

                    {createStep === 3 && (
                    <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">4</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Follow-up</p>
                        <p className="text-[11px] text-slate-500">What happens next</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="block font-semibold text-slate-700">
                          Follow-up Action &amp; Due Date <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400 font-medium">Quick Due:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormFollowupDate(visitCalendarPlusDays(1));
                              setFormErrors(prev => ({ ...prev, followupDate: false }));
                            }}
                            className="wizard-choice px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium cursor-pointer shadow-2xs">
                            +1d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormFollowupDate(visitCalendarPlusDays(3));
                              setFormErrors(prev => ({ ...prev, followupDate: false }));
                            }}
                            className="wizard-choice px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium cursor-pointer shadow-2xs">
                            +3d
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormFollowupDate(visitCalendarPlusDays(7));
                              setFormErrors(prev => ({ ...prev, followupDate: false }));
                            }}
                            className="wizard-choice px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium cursor-pointer shadow-2xs">
                            +7d
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="e.g. Send rate quotation next week"
                            value={formFollowup}
                            onChange={e => {
                              const val = e.target.value;
                              setFormFollowup(val);
                              if (formErrors.followup) setFormErrors(prev => ({ ...prev, followup: false }));
                              if (val.trim() && !formFollowupDate) {
                                const nextWeek = new Date();
                                nextWeek.setDate(nextWeek.getDate() + 7);
                                setFormFollowupDate(formatLocalDate(nextWeek));
                                setFormErrors(prev => ({ ...prev, followupDate: false }));
                              }
                            }}
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white ${
                              formErrors.followup ? 'border-rose-500' : 'border-slate-300'
                            }`}
                          />
                          {formErrors.followup && (
                            <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.followup)}</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="date"
                            aria-label="Follow-up Date"
                            min={visitCalendarToday()}
                            value={formFollowupDate}
                            onChange={e => {
                              setFormFollowupDate(e.target.value);
                              if (formErrors.followupDate) setFormErrors(prev => ({ ...prev, followupDate: false }));
                            }}
                            className={`w-full px-2 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer bg-white ${
                              formErrors.followupDate ? 'border-rose-500' : 'border-slate-300'
                            }`}
                          />
                          {formErrors.followupDate && (
                            <p className="text-[11px] text-rose-500 font-semibold mt-1">{String(formErrors.followupDate)}</p>
                          )}
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
                    </div>
                    )}

                    {createStep === 4 && (
                    <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">5</span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Proof &amp; verify</p>
                        <p className="text-[11px] text-slate-500">Photo from site and customer confirmation</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="block font-semibold text-slate-700">
                          Visit photo <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400">Add Document is optional</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <VisitCameraCapture
                          readGps={readPhotoGps}
                          onCapture={(photoUrl, coords) => {
                            setFormGpsPhotoUrl(photoUrl);
                            setFormGpsLat(coords.latitude);
                            setFormGpsLng(coords.longitude);
                            setFormGpsAccuracy(coords.accuracy);
                            if (formErrors.photo) setFormErrors(prev => ({ ...prev, photo: false }));
                          }}
                        />

                        <label className="wizard-tap cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-medium border border-slate-200 shadow-2xs transition-colors">
                          <input
                            type="file"
                            multiple
                            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e => {
                              const files = e.target.files;
                              if (!files) return;
                              const accepted: File[] = [];
                              for (const file of Array.from(files)) {
                                const message = visitDocumentError(file);
                                if (message) {
                                  toast.error(message);
                                  continue;
                                }
                                accepted.push(file);
                              }
                              if (accepted.length > 0) {
                                const list = new DataTransfer();
                                accepted.forEach(file => list.items.add(file));
                                handleOtherFilesChange(list.files, false);
                              }
                              e.target.value = '';
                            }}
                          />
                          <Paperclip size={13} />
                          <span>Add Documents</span>
                        </label>
                      </div>
                      {formErrors.photo && (
                        <p className="text-[11px] text-rose-500 font-semibold">{String(formErrors.photo)}</p>
                      )}

                      {/* GPS Photo Preview Card */}
                      {formGpsPhotoUrl && (
                        <div className="flex items-start justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                          <div className="min-w-0 space-y-1">
                            <button
                              type="button"
                              onClick={() => openVisitPreview(formGpsPhotoUrl, 'Customer Visit Photo')}
                              className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label="Preview visit photo">
                              <img
                                src={formGpsPhotoUrl}
                                alt="Visit Photo"
                                className="h-40 max-w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                              />
                            </button>
                            <p className="font-semibold text-slate-800 text-[11px] truncate">Customer Visit Photo</p>
                            {formGpsLat && formGpsLng ? (
                              <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Compass size={10} className="text-blue-600 shrink-0" />
                                GPS: {formGpsLat.toFixed(4)}, {formGpsLng.toFixed(4)} (±{formGpsAccuracy || 10}m)
                              </p>
                            ) : (
                              <p className="text-[10px] text-amber-600 font-medium">GPS location not captured</p>
                            )}
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
                          {formAttachments.map((att, idx) => {
                            const name = attachmentName(att);
                            const url = attachmentUrl(att);
                            const image = isImageAttachment(att);
                            const pdf = !image && isPdfAttachment(att);
                            return (
                              <div key={idx} className="flex items-center justify-between gap-2 p-1.5 px-2 bg-white rounded-lg border border-slate-200 text-[11px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  {image && url ? (
                                    <img src={url} alt="" className="h-16 w-16 rounded-md border border-slate-200 object-cover shrink-0" />
                                  ) : (
                                    <FileText size={12} className="text-slate-400 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[200px] font-medium text-slate-700">{name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {url && (image || pdf) && (
                                    <button
                                      type="button"
                                      onClick={() => openVisitPreview(url, name, pdf ? 'pdf' : 'image')}
                                      className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 rounded-md cursor-pointer"
                                      aria-label={`Preview ${name}`}>
                                      Preview
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setFormAttachments(prev => prev.filter((_, i) => i !== idx))}
                                    className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer">
                                    <X size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                      <label className="block font-semibold text-slate-700">
                        WhatsApp verification <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        After the form is complete, send a code to the customer from Enlight Metals – Customer Visits.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { void sendVisitCode(); }}
                          disabled={otpSending || resendSeconds > 0}
                          className="wizard-tap px-3 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-60"
                        >
                          {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : otpVerified ? 'Resend code' : 'Send code'}
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          aria-label="Visit verification code"
                          placeholder="Enter code"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-28 px-3 py-1.5 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => { void confirmVisitCode(); }}
                          disabled={otpSending || otpCode.length !== 6}
                          className="wizard-tap px-3 py-2 bg-slate-100 text-slate-800 rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-60"
                        >
                          Verify
                        </button>
                      </div>
                      {otpNotice && (
                        <p className={`text-[11px] font-semibold ${otpVerified ? 'text-emerald-700' : 'text-slate-600'}`}>{otpNotice}</p>
                      )}
                      {formErrors.otp && (
                        <p className="text-[11px] text-rose-500 font-semibold">{String(formErrors.otp)}</p>
                      )}
                    </div>
                    </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons with Pill-Shaped "Save" Button */}
              <div className="sheet-actions pt-3 border-t border-slate-100 flex justify-end gap-2.5 shrink-0 mt-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="wizard-tap px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all shadow-2xs cursor-pointer">
                  Cancel
                </button>
                {createStep > 0 && (
                  <button
                    type="button"
                    onClick={() => openCreateStep(createStep - 1)}
                    className="wizard-tap px-4 py-2 text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-full transition-all shadow-2xs cursor-pointer">
                    Back
                  </button>
                )}
                {createStep < VISIT_WIZARD_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goToNextCreateStep}
                    className="wizard-tap px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer">
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting || isSavedSuccess}
                    className="wizard-tap flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50">
                    <Save size={16} />
                    {submitting ? 'Saving...' : isSavedSuccess ? 'Saved!' : 'Save'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {visitPendingDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete this visit?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Do you want to delete the visit for{' '}
              <span className="font-semibold text-slate-900">{visitPendingDelete.customer_name || 'this customer'}</span>?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingVisit}
                onClick={() => setVisitPendingDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingVisit}
                onClick={confirmDeleteVisit}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl cursor-pointer">
                {deletingVisit ? 'Deleting...' : 'Delete visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Visit Details & Edit Modal */}
      {selectedVisit && (
        <div
          className="mobile-sheet-overlay fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4 z-50 animate-fadeIn overflow-hidden"
          onClick={handleCloseVisitModal}>
          <div
            className="mobile-sheet bg-white sm:rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sheet-header flex justify-between items-start pb-3 border-b border-slate-100 shrink-0 flex-wrap gap-2">
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
                    {visitCustomerTypeLabel(selectedVisit.customer_type, selectedVisit.customer_type_other) && (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {visitCustomerTypeLabel(selectedVisit.customer_type, selectedVisit.customer_type_other)}
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
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1.5 py-3 text-xs">
                  {/* 2-Column Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Card: Stakeholder & Contact Details */}
                    <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5">
                      <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={13} /> Stakeholder &amp; Contact Info
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                          {typeof selectedVisit.phone_verified === 'boolean' && (
                            <p className={`text-[11px] font-bold mt-1 ${selectedVisit.phone_verified ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {selectedVisit.phone_verified ? 'Phone verified' : 'Phone not verified'}
                            </p>
                          )}
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
                          {selectedVisit.location_source && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {selectedVisit.location_source === 'manual' ? 'Typed location' : 'GPS location'}
                              {selectedVisit.visit_latitude != null && selectedVisit.visit_longitude != null
                                ? ` · ${Number(selectedVisit.visit_latitude).toFixed(5)}, ${Number(selectedVisit.visit_longitude).toFixed(5)}`
                                : ''}
                            </p>
                          )}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                            {[selectedVisit.preferred_make, selectedVisit.preferred_make_other].filter(Boolean).join(' · ') || '-'}
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
                            <button
                              type="button"
                              onClick={() => openVisitPreview(selectedVisit.gps_photo_url!, 'Customer Visit Photo')}
                              className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label="View customer visit photo">
                              <img
                                src={selectedVisit.gps_photo_url}
                                alt="Visit Verification"
                                className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-2xs"
                              />
                            </button>
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

                        {Array.isArray(selectedVisit.attachments) && selectedVisit.attachments.map((att, idx) => {
                          const name = attachmentName(att);
                          const url = attachmentUrl(att);
                          const image = isImageAttachment(att);
                          const pdf = !image && isPdfAttachment(att);
                          return (
                            <div key={`${name}-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                              {image && url ? (
                                <button
                                  type="button"
                                  onClick={() => openVisitPreview(url, name)}
                                  className="shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  aria-label={`View ${name}`}>
                                  <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                </button>
                              ) : (
                                <FileText size={18} className="text-slate-400 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 text-xs truncate">{name}</p>
                                {url && (image || pdf) ? (
                                  <button
                                    type="button"
                                    onClick={() => openVisitPreview(url, name, pdf ? 'pdf' : 'image')}
                                    className="mt-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800">
                                    View
                                  </button>
                                ) : url ? (
                                  <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[11px] font-semibold text-blue-700">
                                    Open
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}

                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs italic">No photo or document attachments recorded for this visit.</p>
                    )}
                  </div>
                </div>

                {/* View Mode Footer */}
                <div className="sheet-actions pt-3 border-t border-slate-100 flex justify-end items-center gap-2 shrink-0">
                  {canEditVisit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer">
                      <Edit2 size={13} />
                      Edit Visit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Edit Mode Form */
              <form onSubmit={handleUpdateVisit} className="flex flex-col flex-1 min-h-0 overflow-hidden mt-3 text-xs">
                <div className="overflow-y-auto flex-1 min-h-0 px-3.5 py-2.5">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
                          <input
                            type="text"
                            value={editLocation}
                            onChange={e => setEditLocation(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          />
                        </div>

                        <VisitCustomerTypeField
                          value={editCustomerType}
                          other={editCustomerTypeOther}
                          otherError={editErrors.customerTypeOther}
                          onChange={(value) => {
                            setEditCustomerType(value);
                            if (value !== 'Other') setEditCustomerTypeOther('');
                            if (editErrors.customerTypeOther) {
                              setEditErrors((prev) => ({ ...prev, customerTypeOther: false }));
                            }
                          }}
                          onOtherChange={(value) => {
                            setEditCustomerTypeOther(value);
                            if (editErrors.customerTypeOther) {
                              setEditErrors((prev) => ({ ...prev, customerTypeOther: false }));
                            }
                          }}
                        />
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
                          <Select
                            value={editVisitType}
                            onChange={e => setEditVisitType(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white cursor-pointer font-medium hover:border-blue-400"
                          >
                            <option value="First Visit">First Visit</option>
                            <option value="Follow-up 1">Follow-up 1</option>
                            <option value="Follow-up 2">Follow-up 2</option>
                            <option value="Follow-up 3">Follow-up 3</option>
                            <option value="Regular Visit">Regular Visit</option>
                          </Select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Visit Outcome</label>
                          <Select
                            value={editOutcome}
                            onChange={e => setEditOutcome(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs bg-white cursor-pointer font-medium hover:border-blue-400"
                          >
                            <option value="positive">Positive</option>
                            <option value="neutral">Neutral</option>
                            <option value="negative">Negative</option>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Customer Probability</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <Select
                              value={editFollowupStatus}
                              onChange={e => setEditFollowupStatus(e.target.value as 'pending' | 'completed')}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white cursor-pointer font-medium hover:border-blue-400"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                            </Select>
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
                <div className="sheet-actions pt-3 border-t border-slate-100 flex justify-end gap-2.5 shrink-0 mt-3">
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
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={previewImage.title}
          onClick={closeVisitPreview}>
          <div className="relative max-w-6xl max-h-[90vh]" onClick={event => event.stopPropagation()}>
            {previewImage.kind === 'pdf' ? (
              <iframe
                title={previewImage.title}
                src={previewImage.url}
                className="h-[85vh] w-[min(90vw,64rem)] rounded-lg bg-white shadow-2xl"
              />
            ) : (
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
            <button
              type="button"
              onClick={closeVisitPreview}
              className="absolute -top-3 -right-3 p-2 bg-white text-slate-700 rounded-full shadow-lg hover:bg-slate-100"
              aria-label="Close image preview">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
