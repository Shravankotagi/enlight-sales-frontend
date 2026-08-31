import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, employeesApi } from '../lib/api';
import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Building2,
  MapPin,
  Calendar,
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Award,
  TrendingUp,
  Sparkles,
  Layers,
  MessageSquare,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Edit2,
  UserCheck,
  X,
  ArrowUpRight,
  Scale,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { calculateOrdersTotalTonnage, getOrderTonnage } from '../utils/pricingEngine';

function safeFormatDate(dateVal?: string | Date | null): string {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function HealthBadge({ risk }: { risk?: string }) {
  const r = (risk || '').toLowerCase();
  if (r === 'churning' || r === 'high') {
    return (
      <span className="px-3 py-1 text-xs font-bold rounded-full bg-rose-50 text-rose-700 inline-flex items-center gap-1.5 border border-rose-200 shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
        Churning (&gt;45d)
      </span>
    );
  }
  if (r === 'at_risk' || r === 'medium' || r === 'at risk') {
    return (
      <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-50 text-amber-700 inline-flex items-center gap-1.5 border border-amber-200 shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
        At Risk (35-45d)
      </span>
    );
  }
  return (
    <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center gap-1.5 border border-emerald-200 shadow-2xs">
      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
      Active
    </span>
  );
}

function SegmentBadge({ segment }: { segment?: string }) {
  const s = (segment || 'new').toLowerCase();
  if (s === 'key_account' || s === 'key account') {
    return (
      <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 inline-flex items-center gap-1.5 shadow-2xs">
        <Award size={13} className="text-indigo-600 shrink-0" />
        Key Account
      </span>
    );
  }
  if (s === 'growth') {
    return (
      <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
        <TrendingUp size={13} className="text-emerald-600 shrink-0" />
        Growth
      </span>
    );
  }
  return (
    <span className="px-3 py-1 text-xs font-bold rounded-full bg-sky-50 text-sky-800 border border-sky-200 inline-flex items-center gap-1.5 shadow-2xs">
      <Sparkles size={13} className="text-sky-600 shrink-0" />
      New
    </span>
  );
}

function formatCurrency(val?: number) {
  const amount = Number(val || 0);
  return '₹' + amount.toLocaleString('en-IN');
}

function formatTonnage(val?: number) {
  const amount = Number(val || 0);
  if (isNaN(amount) || amount === 0) return '0 MT';
  const rounded = Math.round(amount * 1000) / 1000;
  return `${rounded.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} MT`;
}

interface ParsedVisitRemarks {
  cleanNotes: string;
  outcome?: string;
  followUp?: string;
  requirement?: string;
  interests?: string;
  location?: string;
}

function parseVisitRemarks(raw?: string): ParsedVisitRemarks {
  if (!raw || !raw.trim()) {
    return { cleanNotes: 'No notes recorded for this visit.' };
  }

  const tags: Record<string, string> = {};
  const tagRegex = /\[([a-zA-Z0-9_\s]+):\s*([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(raw)) !== null) {
    const key = match[1].trim().toLowerCase();
    const val = match[2].trim();
    tags[key] = val;
  }

  const cleanNotes = raw.replace(tagRegex, '').trim();

  return {
    cleanNotes: cleanNotes || 'Meeting conducted.',
    outcome: tags.outcome,
    followUp: tags.followup || tags['follow up'] || tags['follow-up'],
    requirement: tags.requirement || tags.requirements,
    interests: tags.interests || tags.interest,
    location: tags.location,
  };
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSalesManager, isAdmin } = useAuth();
  const canViewSalesperson = isSalesManager || isAdmin;

  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'inquiries' | 'complaints' | 'visits'>('overview');
  const [copiedGst, setCopiedGst] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // Fetch employees for rep mapping
  const { data: rawEmployees = [] } = useQuery<any[]>({
    queryKey: ['employees-list-customers'],
    queryFn: async () => {
      const res = await employeesApi.getAll().catch(() => null);
      const raw = res?.data;
      return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    },
  });

  const safeEmployees = Array.isArray(rawEmployees) ? rawEmployees : [];

  const employeeMap = useMemo(() => {
    const map = new Map<string, string>();
    safeEmployees.forEach(emp => {
      if (emp && emp.phone && emp.name) {
        const clean = String(emp.phone).replace(/\D/g, '').slice(-10);
        map.set(clean, emp.name);
      }
    });
    return map;
  }, [safeEmployees]);

  const formatName = (str?: string) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const getSalespersonName = (phoneStr?: string, assignedName?: string) => {
    if (assignedName && assignedName.trim()) {
      return formatName(assignedName);
    }
    if (!phoneStr) return 'Unassigned';
    const clean = String(phoneStr).replace(/\D/g, '').slice(-10);
    const found = employeeMap.get(clean);
    if (found) return formatName(found);
    return 'Unassigned';
  };

  // Fetch single customer profile
  const {
    data: customer,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['customer-detail', id],
    queryFn: async () => {
      if (!id) throw new Error('No customer ID provided');
      const res = await customersApi.getOne(id);
      return res?.data?.data || res?.data;
    },
    enabled: Boolean(id),
    retry: 1,
  });

  // Edit customer mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => customersApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['customers-churn'] });
      setIsEditing(false);
      refetch();
    },
  });

  const handleCopyGst = (gst?: string) => {
    if (!gst) return;
    navigator.clipboard.writeText(gst);
    setCopiedGst(true);
    setTimeout(() => setCopiedGst(false), 2000);
  };

  const handleOpenEdit = () => {
    if (!customer) return;
    setEditForm({
      customer_name: customer.customer_name || '',
      contact_person: customer.contact_person || '',
      customer_phone: customer.customer_phone || '',
      customer_gst: customer.customer_gst || '',
      customer_address: customer.customer_address || '',
      assigned_salesperson_phone: customer.assigned_salesperson_phone || '',
      avg_order_frequency_days: customer.avg_order_frequency_days || 30,
      segment: customer.segment || 'new',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(editForm);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto font-sans space-y-6">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
          <div className="h-8 bg-slate-200 rounded-xl w-64"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl border border-slate-200"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-100 rounded-2xl border border-slate-200 animate-pulse"></div>
      </div>
    );
  }

  if (isError || !customer) {
    const isForbidden =
      (error as any)?.response?.status === 403 ||
      String((error as any)?.message || '').toLowerCase().includes('denied') ||
      String((error as any)?.message || '').toLowerCase().includes('permission');

    return (
      <div className="p-8 max-w-4xl mx-auto font-sans text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
          {isForbidden ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {isForbidden ? 'Access Denied' : 'Customer Profile Not Found'}
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {isForbidden
            ? 'You do not have permission to view this customer. Salespersons can only view their own customers, and Sales Managers can only view customers belonging to their assigned team.'
            : error instanceof Error
              ? error.message
              : 'The requested customer profile could not be loaded or does not exist.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {!isForbidden && (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
              <RefreshCw size={14} /> Retry
            </button>
          )}
          <button
            onClick={() => navigate('/customers')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer">
            <ChevronLeft size={16} /> Back to Customer Health
          </button>
        </div>
      </div>
    );
  }

  const deals = Array.isArray(customer.deals) ? customer.deals : [];
  const wonDeals = deals.filter(
    (d: any) =>
      d &&
      (d.stage === 'won' ||
        d.stage === 'order' ||
        Boolean(d.po_number) ||
        d.inquiry_type === 'purchase_order')
  );
  const visits = Array.isArray(customer.visits) ? customer.visits : [];
  const complaints = Array.isArray(customer.complaints) ? customer.complaints : [];
  const inquiries = Array.isArray(customer.inquiries) ? customer.inquiries : [];
  const healthSignals = customer.health_signals || {};

  const lastOrderDateStr = customer.last_order_date
    ? safeFormatDate(customer.last_order_date)
    : 'No Orders Yet';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer">
            <ChevronLeft size={16} />
            Back to Customer Health
          </button>

          <div className="flex items-center gap-2">
            {!String(customer.id || '').startsWith('virtual-') && (
              <button
                onClick={handleOpenEdit}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300 transition-colors cursor-pointer shadow-2xs">
                <Edit2 size={13} className="text-slate-500" />
                Edit Profile
              </button>
            )}
            <button
              onClick={() => navigate('/orders')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs">
              <ShoppingBag size={13} />
              View Orders
            </button>
          </div>
        </div>

        {/* Company Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-start sm:items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-xl shadow-md shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {customer.customer_name || 'Customer Profile'}
                </h1>
                <HealthBadge risk={customer.churn_risk} />
                <SegmentBadge segment={customer.segment} />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                {canViewSalesperson && (
                  <span className="font-semibold text-slate-600 inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                    <UserCheck size={12} className="text-slate-500" />
                    Rep: {getSalespersonName(customer.assigned_salesperson_phone, customer.assigned_salesperson_name)}
                  </span>
                )}
                {customer.customer_address && (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-500">
                    <MapPin size={12} className="text-slate-400" />
                    {customer.customer_address}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tonnage */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tonnage</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {calculateOrdersTotalTonnage(wonDeals).formattedText || formatTonnage(customer.total_tonnage)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Scale size={22} />
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {customer.total_orders || 0}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag size={22} />
          </div>
        </div>

        {/* Last Order */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Order</p>
            <p className="text-lg font-black text-slate-900 mt-1 truncate">
              {lastOrderDateStr}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Calendar size={22} />
          </div>
        </div>

        {/* Frequency Cadence */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {customer.avg_order_frequency_days || 30}d
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <RefreshCw size={22} />
          </div>
        </div>
      </div>

      {/* Internal Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white p-1.5 rounded-2xl shadow-2xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'overview'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}>
          <Layers size={14} />
          Overview
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'orders'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}>
          <ShoppingBag size={14} />
          Orders
          <span
            className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
            {wonDeals.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'inquiries'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}>
          <MessageSquare size={14} />
          Inquiries
          <span
            className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${activeTab === 'inquiries' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
            {inquiries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('complaints')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'complaints'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}>
          <ShieldAlert size={14} />
          Complaints
          <span
            className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${activeTab === 'complaints' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
            {complaints.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('visits')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'visits'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}>
          <MapPin size={14} />
          Visits
          <span
            className={`px-1.5 py-0.2 rounded-full text-2xs font-bold ${activeTab === 'visits' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
            {visits.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Health Signals & AI Insights */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">AI Account Insights</h2>
                </div>
                {healthSignals.sentiment === 'critical' ? (
                  <span className="px-2.5 py-1 text-2xs font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                    <AlertTriangle size={12} /> Attention Required
                  </span>
                ) : healthSignals.sentiment === 'warning' ? (
                  <span className="px-2.5 py-1 text-2xs font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                    <Clock size={12} /> Re-order Approaching
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-2xs font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Healthy & Engaged
                  </span>
                )}
              </div>

              {/* Enhanced AI Insights Narrative */}
              <div className="p-4 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {healthSignals.executive_summary || `${customer.customer_name || 'This account'} has a steady ordering history with on-track procurement velocity.`}
                </p>
              </div>
            </div>

            {/* Recent Orders Preview */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">Recent Confirmed Orders</h2>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer">
                  View All ({wonDeals.length}) <ArrowUpRight size={14} />
                </button>
              </div>

              {wonDeals.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
                  No confirmed purchase orders recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                        <th className="py-2.5 px-3">PO / Deal</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Items</th>
                        <th className="py-2.5 px-3 text-right">Order Tonnage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {wonDeals.slice(0, 5).map((d: any) => {
                        const items = d.deal_items || [];
                        return (
                          <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-900">{d.po_number || d.customer_name || 'Confirmed Order'}</p>
                              {d.delivery_location && (
                                <p className="text-2xs text-slate-500 truncate max-w-xs">{d.delivery_location}</p>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {safeFormatDate(d.won_at || d.created_at)}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {items.length > 0 ? (
                                <p className="truncate max-w-xs">{items.map((i: any) => i.sku_text || 'Item').join(', ')}</p>
                              ) : (
                                <span className="text-slate-400">Standard Spec</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                              {formatTonnage(getOrderTonnage(d))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (1/3 width) */}
          <div className="space-y-6">
            {/* Contact & Company Details Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Building2 size={16} className="text-slate-400" />
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company & Contact Info</h3>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Contact Person</p>
                  <p className="font-bold text-black text-sm mt-0.5">
                    {customer.contact_person || 'Not specified'}
                  </p>
                </div>

                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                  {customer.customer_phone ? (
                    <p className="mt-0.5">
                      <a
                        href={`tel:${customer.customer_phone}`}
                        className="font-bold text-black text-sm hover:text-blue-600 transition-colors">
                        {customer.customer_phone}
                      </a>
                    </p>
                  ) : (
                    <p className="font-bold text-black text-sm mt-0.5">Not provided</p>
                  )}
                </div>

                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">GSTIN Number</p>
                  {customer.customer_gst ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-black text-sm">
                        {customer.customer_gst}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyGst(customer.customer_gst)}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer">
                        {copiedGst ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  ) : (
                    <p className="font-bold text-black text-sm mt-0.5">Not registered</p>
                  )}
                </div>

                <div>
                  <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Registered Address</p>
                  <p className="font-bold text-black text-sm mt-0.5 leading-relaxed">
                    {customer.customer_address || 'No address registered'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sales Ownership Card (Sales Manager and Admins only) */}
            {canViewSalesperson && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <UserCheck size={16} className="text-slate-400" />
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Ownership</h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Assigned Salesperson</p>
                    <p className="font-bold text-black text-sm mt-0.5">
                      {getSalespersonName(customer.assigned_salesperson_phone, customer.assigned_salesperson_name)}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Average Order Value (AOV)</p>
                    <p className="font-bold text-black text-sm mt-0.5">
                      {formatCurrency(customer.avg_order_value)}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Trailing 12-Month Revenue</p>
                    <p className="font-bold text-black text-sm mt-0.5">
                      {formatCurrency(customer.t12m_revenue)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag size={18} className="text-blue-600" />
              Order History & Confirmed Transactions ({wonDeals.length})
            </h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Open Orders Module <ExternalLink size={13} />
            </button>
          </div>

          {wonDeals.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
              No confirmed purchase orders recorded for this customer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">PO Number / Deal</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Line Items</th>
                    <th className="py-3 px-3">Payment Terms</th>
                    <th className="py-3 px-3 text-right">Order Tonnage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wonDeals.map((deal: any, idx: number) => {
                    const items = deal.deal_items || [];
                    return (
                      <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{deal.po_number || deal.customer_name || 'Confirmed Order'}</p>
                          {deal.delivery_location && (
                            <p className="text-2xs text-slate-500">{deal.delivery_location}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {safeFormatDate(deal.won_at || deal.created_at)}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {items.length > 0 ? (
                            <div className="space-y-1">
                              {items.map((it: any, iIdx: number) => (
                                <p key={iIdx} className="text-2xs font-medium">
                                  <span className="font-bold text-slate-900">{it.sku_text || 'Item'}</span>
                                  {it.quantity && ` — ${it.quantity} ${it.unit || 'MT'}`}
                                  {it.rate && ` @ ₹${Number(it.rate).toLocaleString('en-IN')}`}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">Standard Spec</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {deal.payment_terms || 'Standard'}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                          {formatTonnage(getOrderTonnage(deal))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Inquiries Tab */}
      {activeTab === 'inquiries' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-600" />
              Incoming Inquiries & RFQs ({inquiries.length})
            </h2>
            <button
              onClick={() => navigate('/inquiries')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Open Inquiries Module <ExternalLink size={13} />
            </button>
          </div>

          {inquiries.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
              No inquiries recorded for this customer.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Source Channel</th>
                    <th className="py-3 px-3">Raw / Extracted Requirement</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inquiries.map((inq: any, idx: number) => (
                    <tr key={inq.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {safeFormatDate(inq.created_at)}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-semibold uppercase text-2xs">
                        {inq.source_channel || 'WhatsApp'}
                      </td>
                      <td className="py-3 px-3 text-slate-800 max-w-md">
                        <p className="line-clamp-2">{inq.raw_text || inq.sender_name || 'Material Requirement'}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 capitalize">
                          {inq.status || 'Received'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Complaints Tab */}
      {activeTab === 'complaints' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert size={18} className="text-blue-600" />
              Customer Complaints & Resolution SLA ({complaints.length})
            </h2>
            <button
              onClick={() => navigate('/complaints')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Open Complaints Module <ExternalLink size={13} />
            </button>
          </div>

          {complaints.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
              Zero complaints reported. Account has a clean quality track record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Reported Date</th>
                    <th className="py-3 px-3">Issue Description</th>
                    <th className="py-3 px-3">Resolution Notes</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.map((c: any, idx: number) => {
                    const st = (c.status || '').toLowerCase();
                    const isOpen = st !== 'resolved' && st !== 'closed';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-3 font-bold text-slate-900 capitalize">
                          {c.complaint_type || 'Quality'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {safeFormatDate(c.reported_at)}
                        </td>
                        <td className="py-3 px-3 text-slate-800 max-w-sm">
                          <p className="line-clamp-2">{c.description || 'Quality inspection ticket'}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs">
                          <p className="line-clamp-2">{c.resolution_notes || 'Pending resolution'}</p>
                        </td>
                        <td className="py-3 px-3">
                          {isOpen ? (
                            <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Open Issue
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Resolved
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Visits Tab */}
      {activeTab === 'visits' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin size={18} className="text-blue-600" />
              On-Site Field Visits ({visits.length})
            </h2>
            <button
              onClick={() => navigate('/visits')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer">
              Open Visits Module <ExternalLink size={13} />
            </button>
          </div>

          {visits.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
              No field visits logged for this customer yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/50">
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Visited Date</th>
                    <th className="py-3 px-3">Salesperson</th>
                    <th className="py-3 px-3">Person Met</th>
                    <th className="py-3 px-3 min-w-[280px]">Discussion Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visits.map((v: any, idx: number) => (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {safeFormatDate(v.visited_at)}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {getSalespersonName(v.salesperson_phone)}
                      </td>
                      <td className="py-3 px-3 text-slate-800">
                        <p className="font-semibold">{v.person_met || 'Site Representative'}</p>
                        {v.contact_no && <p className="text-2xs text-slate-500">{v.contact_no}</p>}
                      </td>
                      <td className="py-3.5 px-3 text-slate-900 max-w-lg min-w-[280px]">
                        {(() => {
                          const parsed = parseVisitRemarks(v.remarks);
                          return (
                            <div className="space-y-1 text-xs text-slate-900">
                              <p className="leading-relaxed font-normal text-slate-900">
                                {parsed.cleanNotes}
                              </p>
                              {(parsed.outcome || parsed.requirement || parsed.interests || parsed.followUp) && (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-900 border-t border-slate-100">
                                  {parsed.outcome && (
                                    <span>
                                      <strong className="font-bold text-slate-900">Outcome:</strong> {parsed.outcome}
                                    </span>
                                  )}
                                  {parsed.requirement && (
                                    <span>
                                      <strong className="font-bold text-slate-900">Requirement:</strong> {parsed.requirement}
                                    </span>
                                  )}
                                  {parsed.interests && (
                                    <span>
                                      <strong className="font-bold text-slate-900">Interests:</strong> {parsed.interests}
                                    </span>
                                  )}
                                  {parsed.followUp && (
                                    <span>
                                      <strong className="font-bold text-slate-900">Follow-up:</strong> {parsed.followUp}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 size={16} className="text-blue-600" />
                Edit Profile — {customer.customer_name}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 py-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Company / Customer Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.customer_name}
                  onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editForm.contact_person}
                    onChange={e => setEditForm({ ...editForm, contact_person: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editForm.customer_phone}
                    onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={editForm.customer_gst}
                    onChange={e => setEditForm({ ...editForm, customer_gst: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Order Frequency (Days)</label>
                  <input
                    type="number"
                    value={editForm.avg_order_frequency_days}
                    onChange={e => setEditForm({ ...editForm, avg_order_frequency_days: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Registered Address</label>
                <input
                  type="text"
                  value={editForm.customer_address}
                  onChange={e => setEditForm({ ...editForm, customer_address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Assigned Salesperson</label>
                  <select
                    value={editForm.assigned_salesperson_phone}
                    onChange={e => setEditForm({ ...editForm, assigned_salesperson_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Unassigned</option>
                    {safeEmployees.map(emp => (
                      <option key={emp.id} value={emp.phone}>
                        {emp.name} ({emp.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Customer Segment</label>
                  <select
                    value={editForm.segment}
                    onChange={e => setEditForm({ ...editForm, segment: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="key_account">Key Account</option>
                    <option value="growth">Growth</option>
                    <option value="new">New</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1">
                  {updateMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
