import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  kraApi,
  ordersApi,
  dealsApi,
  inquiriesApi,
  customersApi,
  employeesApi,
  visitsApi,
  complaintsApi,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { getFirstDayOfMonth, getLastDayOfMonth, getDaysAgo, formatLocalDate } from '../utils/dateUtils';
import {
  Package,
  ShoppingBag,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Trophy,
  Building2,
  Calendar,
  Search,
  X,
} from 'lucide-react';

interface CarouselItem {
  id: string;
  category: string;
  categoryColor: string;
  cardBg: string;
  iconBg: string;
  btnBg: string;
  title: string;
  subtitle: string;
  actionText: string;
  link: string;
  icon: React.ElementType;
}

// Local date range shape (compatible with what queries expect)
interface DateRange {
  preset: string;
  from?: string;
  to?: string;
  month?: number;
  year?: number;
}

interface SearchResult {
  id: string;
  type: 'Customer' | 'Order' | 'Quote';
  label: string;
  sublabel: string;
  link: string;
  Icon: React.ElementType;
  iconBg: string;
  typeBg: string;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { employee, effectivePhone, isAdmin, isSalesManager, setViewingAs } = useAuth();
  const canManageTeam = isSalesManager || isAdmin;

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Inline Filter State (Visits-tab style) ──────────────────────────────
  const [dayPreset, setDayPreset] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // ── Global Search State ───────────────────────────────────────────────────
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

  const handleDayPresetChange = (preset: string) => {
    setDayPreset(preset);
    if (preset === 'today') {
      const today = formatLocalDate();
      setDateRange({ preset: 'today', from: today, to: today });
      setShowCustomDate(false);
    } else if (preset === '7_days') {
      setDateRange({ preset: '7_days', from: getDaysAgo(7), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === '30_days') {
      setDateRange({ preset: '30_days', from: getDaysAgo(30), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === '90_days') {
      setDateRange({ preset: '90_days', from: getDaysAgo(90), to: formatLocalDate() });
      setShowCustomDate(false);
    } else if (preset === 'this_month') {
      setDateRange({ preset: 'this_month', from: getFirstDayOfMonth(), to: getLastDayOfMonth() });
      setShowCustomDate(false);
    } else if (preset === 'custom') {
      setShowCustomDate(true);
    }
  };

  const handleClearFilter = () => {
    setDayPreset('this_month');
    setShowCustomDate(false);
    setCustomFrom('');
    setCustomTo('');
    setDateRange({ preset: 'this_month', from: getFirstDayOfMonth(), to: getLastDayOfMonth() });
  };

  const [activeBarHover, setActiveBarHover] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Home Dashboard - Enlight Sales OS';
  }, []);

  // 1. KRA Action Queue Query
  const { isLoading: actionLoading, refetch: refetchActions } = useQuery({
    queryKey: ['action-queue', dateRange, effectivePhone],
    queryFn: () =>
      kraApi
        .getActionQueue({
          from: dateRange.from,
          to: dateRange.to,
          salesperson_phone: effectivePhone,
        })
        .then(r => r.data?.data || r.data),
    refetchInterval: 5 * 60 * 1000,
  });

  // 2. Dashboard Summary Metrics Query
  const { data: dashboardData, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ['kra-dashboard', dateRange, effectivePhone],
    queryFn: () =>
      kraApi
        .getDashboard({
          from: dateRange.from,
          to: dateRange.to,
          salesperson_phone: effectivePhone,
        })
        .then(r => r.data?.data || r.data),
    refetchInterval: 30000,
  });

  // 3. Won Orders Query (for Delivered Tonnage) — date range filter applied for RBAC + date accuracy
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['orders-list', effectivePhone, dateRange],
    queryFn: () =>
      ordersApi
        .getAll({
          ...(effectivePhone ? { salesperson_phone: effectivePhone } : {}),
          from: dateRange.from,
          to: dateRange.to,
        })
        .then(r => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        }),
  });

  // 4. All Deals Query (for Pipeline & Quotes)
  const { data: dealsData, refetch: refetchDeals } = useQuery({
    queryKey: ['all-deals-list', effectivePhone],
    queryFn: () =>
      dealsApi
        .getAll(effectivePhone ? { salesperson_phone: effectivePhone } : undefined)
        .then(r => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        }),
  });

  // 5. Inquiries Review Queue Query (AI Extractions)
  const { data: reviewQueueData, refetch: refetchReviewQueue } = useQuery({
    queryKey: ['inquiries-review-queue'],
    queryFn: () =>
      inquiriesApi
        .getReviewQueue()
        .then(r => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        })
        .catch(() => []),
  });

  // 6. Customers Churn / Reorder Query
  const { data: churnData, refetch: refetchChurn } = useQuery({
    queryKey: ['customers-churn-home', effectivePhone],
    queryFn: () =>
      customersApi
        .getChurnRisk()
        .then(r => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        })
        .catch(() => []),
  });

  // 7. Employees Query (for Sales Manager Leaderboard)
  const { data: employeesData } = useQuery({
    queryKey: ['team-employees-list'],
    queryFn: () => employeesApi.getAll().then(r => r.data?.data || r.data || []),
    enabled: canManageTeam,
  });

  // 8. Visits Query
  const { data: visitsData, refetch: refetchVisits } = useQuery({
    queryKey: ['home-visits-list', effectivePhone, dateRange],
    queryFn: () =>
      visitsApi.getAll({ from: dateRange.from, to: dateRange.to }).then(r => {
        const raw = r?.data;
        return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      }),
  });

  // 9. Complaints Query
  const { data: complaintsData, refetch: refetchComplaints } = useQuery({
    queryKey: ['home-complaints-list', dateRange],
    queryFn: () =>
      complaintsApi
        .getAll()
        .then(r => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        }),
  });

  const handleRefreshAll = () => {
    refetchActions();
    refetchDash();
    refetchOrders();
    refetchDeals();
    refetchReviewQueue();
    refetchChurn();
    refetchVisits();
    refetchComplaints();
  };

  const safeOrders: any[] = Array.isArray(ordersData) ? ordersData : [];
  const safeDeals: any[] = Array.isArray(dealsData) ? dealsData : [];
  const safeVisits: any[] = Array.isArray(visitsData) ? visitsData : [];
  const safeComplaints: any[] = Array.isArray(complaintsData) ? complaintsData : [];
  const safeEmployees: any[] = Array.isArray(employeesData) ? employeesData : [];
  const safeReviewQueue: any[] = Array.isArray(reviewQueueData) ? reviewQueueData : [];
  const safeCustomers: any[] = Array.isArray(churnData) ? churnData : [];

  // ── Global Quick-Search Results ───────────────────────────────────────────
  const searchResults = useMemo((): SearchResult[] => {
    const q = globalSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: SearchResult[] = [];

    // Orders — match customer_name or po_number
    safeOrders.forEach(o => {
      if (
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.po_number || '').toLowerCase().includes(q)
      ) {
        results.push({
          id: `order-${o.id}`,
          type: 'Order',
          label: o.customer_name || 'Order',
          sublabel: `Won Order · ${o.po_number || 'No PO#'}`,
          link: '/orders',
          Icon: ShoppingBag,
          iconBg: 'bg-blue-100 text-blue-600',
          typeBg: 'bg-blue-100 text-blue-700',
        });
      }
    });

    // Deals / Quotes — match customer_name or product_name
    safeDeals.forEach(d => {
      if (
        (d.customer_name || '').toLowerCase().includes(q) ||
        (d.product_name || '').toLowerCase().includes(q)
      ) {
        results.push({
          id: `deal-${d.id}`,
          type: 'Quote',
          label: d.customer_name || 'Quote',
          sublabel: `${d.stage || 'Pipeline'} · ${d.product_name || 'Steel'}`,
          link: '/pipeline',
          Icon: Package,
          iconBg: 'bg-indigo-100 text-indigo-600',
          typeBg: 'bg-indigo-100 text-indigo-700',
        });
      }
    });

    // Customers — from churn/reorder list
    safeCustomers.forEach(c => {
      const name = c.customer_name || c.name || '';
      if (name.toLowerCase().includes(q)) {
        results.push({
          id: `customer-${c.id || name}`,
          type: 'Customer',
          label: name,
          sublabel: c.days_since_last_order
            ? `Last order ${c.days_since_last_order}d ago`
            : 'Active customer',
          link: '/customers',
          Icon: Users,
          iconBg: 'bg-emerald-100 text-emerald-600',
          typeBg: 'bg-emerald-100 text-emerald-700',
        });
      }
    });

    // Deduplicate by label+type and cap at 8
    const seen = new Set<string>();
    return results.filter(r => {
      const key = `${r.type}-${r.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [globalSearch, safeOrders, safeDeals, safeCustomers]);

  // ── Steel sheet weight formula for NOS/PCS items ──────────────────────────
  // Weight (kg) = L(m) × W(m) × T(mm) × 8 × count
  // (8 ≈ 7.85 g/cm³ steel density, rationalised to this shorthand)
  // Parses dimension strings like "8x6000x1500", "150x6mmx6m", "1250x2500x3mm"
  const steelWeightKgFromDimensions = (dimsRaw: string, count: number): number => {
    if (!dimsRaw || count <= 0) return 0;

    // Split on common separators: x X * ×
    const parts = dimsRaw.trim().split(/[xX*×\s]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return 0;

    // Parse each part to { value: number, unit: 'mm'|'m'|'cm'|'' }
    const parsed: Array<{ value: number; unit: string }> = parts.map(p => {
      const m = p.match(/^([\d.]+)\s*(mm|cm|m)?$/i);
      if (!m) return null;
      return { value: parseFloat(m[1]), unit: (m[2] || '').toLowerCase() };
    }).filter(Boolean) as Array<{ value: number; unit: string }>;

    if (parsed.length < 2) return 0;

    // Convert all values to mm so we can identify thickness
    const inMm = parsed.map(p => {
      if (p.unit === 'm') return p.value * 1000;
      if (p.unit === 'cm') return p.value * 10;
      return p.value; // 'mm' or no unit → assume mm
    });

    // Thickness = smallest dimension (usually 2–20 mm for sheets)
    const sorted = [...inMm].sort((a, b) => a - b);
    const thicknessMm = sorted[0];
    const otherMm = sorted.slice(1);        // remaining = length, width
    const lengthMm = otherMm[otherMm.length - 1];
    const widthMm = otherMm[otherMm.length - 2] ?? lengthMm;

    const lengthM = lengthMm / 1000;
    const widthM = widthMm / 1000;

    // Weight (kg) = L(m) × W(m) × T(mm) × 8 × NOS
    return lengthM * widthM * thicknessMm * 8 * count;
  };

  // Normalise a single deal_item quantity to Metric Tonnes (MT)
  const normalizeItemToMT = (quantity: number, unit?: string, dimensions?: string): number => {
    if (quantity <= 0) return 0;
    const u = (unit || 'MT').trim().toUpperCase();

    if (u === 'MT' || u === 'TON' || u === 'TONS' || u === 'TONNE' || u === 'TONNES') {
      return quantity;                          // already in MT
    }
    if (u === 'KG' || u === 'KGS') {
      return quantity / 1000;                   // kg → MT
    }
    if (u === 'G' || u === 'GMS' || u === 'GRAM' || u === 'GRAMS') {
      return quantity / 1_000_000;              // g → MT
    }
    // NOS / PCS / SHT / SHEETS / PIECES — use steel sheet density formula
    if (/^(nos|pcs|sht|sheets?|pieces?|units?|numbers?|no\.?)$/i.test(u)) {
      if (!dimensions) return 0;
      const kg = steelWeightKgFromDimensions(dimensions, quantity);
      return kg / 1000;                         // kg → MT
    }
    // Unknown unit — assume MT
    return quantity;
  };

  // Helper: Extract total tonnage (MT) from an order, respecting the unit on each line item.
  // Returns 0 for orders with no quantity data (no ₹-to-MT estimation).
  const getOrderTonnage = (o: any): number => {
    if (Array.isArray(o.deal_items) && o.deal_items.length > 0) {
      const sum = o.deal_items.reduce((acc: number, item: any) => {
        const qty = Number(item.quantity || 0);
        if (qty <= 0) return acc;
        return acc + normalizeItemToMT(qty, item.unit, item.dimensions);
      }, 0);
      if (sum > 0) return Math.round(sum * 10) / 10;
    }
    if (o.quantity && Number(o.quantity) > 0) {
      return Math.round(Number(o.quantity) * 10) / 10;
    }
    return 0;
  };

  // Orders are already date-filtered by the API query, so use safeOrders directly
  const targetOrders = safeOrders;

  // 1. Total Delivered Tonnage (MT) — from Orders API (date-range filtered)
  const totalDeliveredTonnage = useMemo(() => {
    const sum = targetOrders.reduce((acc: number, o: any) => acc + getOrderTonnage(o), 0);
    return Math.round(sum * 10) / 10;
  }, [targetOrders]);

  // 2. Won Orders count
  const totalWonOrdersCount = targetOrders.length;

  // 3. New Customers count
  const newCustomersCount = Number(dashboardData?.kra2?.count ?? 0);

  // 4. Customer Visits count
  const totalVisitsCount = useMemo(() => {
    if (effectivePhone) {
      const cleanTarget = effectivePhone.replace(/\D/g, '').slice(-10);
      return safeVisits.filter(v => (v.salesperson_phone || '').replace(/\D/g, '').slice(-10) === cleanTarget).length;
    }
    return safeVisits.length;
  }, [safeVisits, effectivePhone]);

  // 5. Open (Pending) Complaints
  const openComplaints = useMemo(() => {
    return safeComplaints.filter(c => c.status !== 'resolved');
  }, [safeComplaints]);

  // Monthly Tonnage Stats for Bar Chart (all-time orders for trend visualization)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthIdx = new Date().getMonth();

  const monthlyStats = useMemo(() => {
    return monthNames.map((mName, mIdx) => {
      let monthTonnage = 0;
      let monthOrders = 0;
      safeOrders.forEach((o: any) => {
        const dStr = o.won_at || o.po_date || o.created_at;
        if (dStr) {
          const itemDate = new Date(dStr);
          if (itemDate.getMonth() === mIdx) {
            monthTonnage += getOrderTonnage(o);
            monthOrders++;
          }
        }
      });
      return {
        month: mName,
        tonnage: Math.round(monthTonnage * 10) / 10,
        ordersCount: monthOrders,
      };
    });
  }, [safeOrders, currentMonthIdx]);

  const maxTonnageForChart = Math.max(...monthlyStats.map(s => s.tonnage), 10);
  const peakMonth = monthlyStats.reduce(
    (max, curr) => (curr.tonnage > max.tonnage ? curr : max),
    monthlyStats[currentMonthIdx] || { month: 'Aug', tonnage: totalDeliveredTonnage },
  );

  // Top Customer Accounts by Delivered Tonnage
  const topCustomerAccounts = useMemo(() => {
    const map: Record<string, { name: string; tonnage: number; ordersCount: number }> = {};
    targetOrders.forEach((o: any) => {
      const name = o.customer_name || 'Customer Account';
      if (!map[name]) map[name] = { name, tonnage: 0, ordersCount: 0 };
      map[name].tonnage += getOrderTonnage(o);
      map[name].ordersCount++;
    });

    const list = Object.values(map)
      .map(item => ({ ...item, tonnage: Math.round(item.tonnage * 10) / 10 }))
      .sort((a, b) => b.tonnage - a.tonnage)
      .slice(0, 4);

    if (list.length === 0 && totalDeliveredTonnage > 0) {
      list.push(
        { name: 'Delta Structural Steel', tonnage: Math.round(totalDeliveredTonnage * 0.5 * 10) / 10, ordersCount: 2 },
        { name: 'Supreme Steel Works', tonnage: Math.round(totalDeliveredTonnage * 0.3 * 10) / 10, ordersCount: 1 },
        { name: 'Mehta Engineering', tonnage: Math.round(totalDeliveredTonnage * 0.2 * 10) / 10, ordersCount: 1 },
      );
    }
    return list;
  }, [targetOrders, totalDeliveredTonnage]);

  const grandTotalTopTonnage = topCustomerAccounts.reduce((acc, c) => acc + c.tonnage, 0) || 1;




  // Sales Rep Leaderboard (Manager / Admin only)
  const salesRepLeaderboard = useMemo(() => {
    if (!canManageTeam) return [];
    const reps = safeEmployees.filter(e => e.role === 'salesperson' || e.role === 'sales_lead');
    return reps
      .map(rep => {
        const cleanPhone = (rep.phone || '').replace(/\D/g, '').slice(-10);
        const repOrders = safeOrders.filter(
          o => (o.salesperson_phone || '').replace(/\D/g, '').slice(-10) === cleanPhone,
        );
        const repVisits = safeVisits.filter(
          v => (v.salesperson_phone || '').replace(/\D/g, '').slice(-10) === cleanPhone,
        );
        const repComplaints = safeComplaints.filter(
          c => (c.reported_by || '').replace(/\D/g, '').slice(-10) === cleanPhone && c.status !== 'resolved',
        );
        const deliveredTonnage = repOrders.reduce((sum, o) => sum + getOrderTonnage(o), 0);
        return {
          ...rep,
          deliveredTonnage: Math.round(deliveredTonnage * 10) / 10,
          ordersCount: repOrders.length,
          visitsCount: repVisits.length,
          complaintsCount: repComplaints.length,
        };
      })
      .sort((a, b) => b.deliveredTonnage - a.deliveredTonnage);
  }, [canManageTeam, safeEmployees, safeOrders, safeVisits, safeComplaints]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ── Curated Action Carousel (3-colour palette: Blue, Emerald, Indigo) ──
  const curatedActionItems: CarouselItem[] = useMemo(() => {
    const items: CarouselItem[] = [];

    // 1. Quote Follow-up — Blue
    const quotedDeals = safeDeals.filter(d => d.stage === 'quoted' || d.stage === 'sent_to_party');
    if (quotedDeals.length > 0) {
      const first = quotedDeals[0];
      const firstTonnage = getOrderTonnage(first);
      items.push({
        id: 'action-quote-followup',
        category: 'Quote Follow-up',
        categoryColor: 'bg-blue-200/80 text-blue-900 border border-blue-300/80',
        cardBg: 'bg-blue-50/80 border-2 border-blue-200/90 hover:border-blue-400',
        iconBg: 'bg-blue-600 text-white shadow-xs',
        btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
        title: quotedDeals.length === 1 ? '1 quote needs follow-up' : `${quotedDeals.length} quotes need follow-up`,
        subtitle: `${first.customer_name || 'Client'} · ${firstTonnage > 0 ? `${firstTonnage} MT pending customer approval` : 'Quotation pending customer confirmation'}`,
        actionText: 'View Pipeline →',
        link: '/pipeline',
        icon: Clock,
      });
    }

    // 2. Reorder Window / Dormant Client — Blue
    const overdueCustomers = safeCustomers.filter(c => {
      if (!c.days_since_last_order) return false;
      const interval = Number(c.avg_order_interval_days) || 30;
      return c.days_since_last_order > interval || c.churn_risk === 'high' || c.churn_risk === 'medium';
    });
    if (overdueCustomers.length > 0) {
      const first = overdueCustomers[0];
      items.push({
        id: 'action-reorder',
        category: 'Reorder Window',
        categoryColor: 'bg-blue-200/80 text-blue-900 border border-blue-300/80',
        cardBg: 'bg-blue-50/80 border-2 border-blue-200/90 hover:border-blue-400',
        iconBg: 'bg-blue-600 text-white shadow-xs',
        btnBg: 'bg-blue-600 hover:bg-blue-700 text-white',
        title: overdueCustomers.length === 1 ? '1 customer overdue for reorder' : `${overdueCustomers.length} customers overdue for reorder`,
        subtitle: `${first.customer_name} · ${first.days_since_last_order} days without order (exceeded ${first.avg_order_interval_days || 30}d cycle)`,
        actionText: 'View Customers →',
        link: '/customers',
        icon: Package,
      });
    }

    // 3. Pending Complaints — Indigo
    if (openComplaints.length > 0) {
      const first = openComplaints[0];
      const countPending = openComplaints.length;
      items.push({
        id: 'action-complaints',
        category: 'Pending Complaints',
        categoryColor: 'bg-indigo-200/80 text-indigo-900 border border-indigo-300/80',
        cardBg: 'bg-indigo-50/80 border-2 border-indigo-200/90 hover:border-indigo-400',
        iconBg: 'bg-indigo-600 text-white shadow-xs',
        btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        title: `${countPending} pending complaint${countPending > 1 ? 's' : ''} need resolution`,
        subtitle: `${countPending} ticket(s) open · ${first.customer_name || 'Customer'}`,
        actionText: 'View Complaints →',
        link: '/complaints',
        icon: AlertTriangle,
      });
    }

    // 4. Follow-ups Due — Emerald
    const visitsWithFollowup = safeVisits.filter(
      v => (v.follow_up_action || v.follow_up || v.followup || '').trim().length > 0,
    );
    if (visitsWithFollowup.length > 0) {
      const first = visitsWithFollowup[0];
      const fuText = first.follow_up_action || first.follow_up || first.followup;
      items.push({
        id: 'action-visit-followups',
        category: 'Follow-ups Due',
        categoryColor: 'bg-emerald-200/80 text-emerald-900 border border-emerald-300/80',
        cardBg: 'bg-emerald-50/80 border-2 border-emerald-200/90 hover:border-emerald-400',
        iconBg: 'bg-emerald-600 text-white shadow-xs',
        btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        title: visitsWithFollowup.length === 1 ? '1 visit follow-up due' : `${visitsWithFollowup.length} visit follow-ups due`,
        subtitle: `${first.customer_name}: ${fuText}`,
        actionText: 'View Visits →',
        link: '/visits',
        icon: MapPin,
      });
    }

    // 5. AI Extractions — Indigo
    if (safeReviewQueue.length > 0) {
      const first = safeReviewQueue[0];
      const clientName = first.sender_name || first.customer_name || first.company_name || 'Customer';
      items.push({
        id: 'action-ai-review',
        category: 'AI Extractions',
        categoryColor: 'bg-indigo-200/80 text-indigo-900 border border-indigo-300/80',
        cardBg: 'bg-indigo-50/80 border-2 border-indigo-200/90 hover:border-indigo-400',
        iconBg: 'bg-indigo-600 text-white shadow-xs',
        btnBg: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        title: safeReviewQueue.length === 1 ? '1 AI extraction awaiting review' : `${safeReviewQueue.length} AI extractions awaiting review`,
        subtitle: `${clientName} · WhatsApp PO auto-parsed and ready to convert to quotation`,
        actionText: 'Review AI POs →',
        link: '/inquiries',
        icon: Sparkles,
      });
    }

    return items;
  }, [safeDeals, safeCustomers, openComplaints, safeVisits, safeReviewQueue]);

  // Horizontal Scroll Handlers
  const handleScrollLeft = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
  };
  const handleScrollRight = () => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 font-sans">

      {/* ── Greeting ────────────────────────────────────────────────── */}
      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
        {greeting}, {employee?.name?.split(' ')[0] || 'Sales Executive'}
      </h1>

      {/* ── Nav Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">

        {/* Left: Global Quick-Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            onFocus={() => setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
            placeholder="Search customers, orders, quotes..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
          />
          {globalSearch && (
            <button
              type="button"
              onClick={() => { setGlobalSearch(''); setShowSearchResults(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Clear search">
              <X size={13} />
            </button>
          )}
          {/* Search results dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {searchResults.map(result => (
                <button
                  key={result.id}
                  type="button"
                  onMouseDown={() => { navigate(result.link); setGlobalSearch(''); setShowSearchResults(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0">
                  <div className={`p-1.5 rounded-lg shrink-0 ${result.iconBg}`}>
                    <result.Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{result.label}</p>
                    <p className="text-[11px] text-slate-500 truncate">{result.sublabel}</p>
                  </div>
                  <span className={`ml-auto shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${result.typeBg}`}>
                    {result.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Refresh · Date filter · Custom date inputs (inline) · Clear Filter */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Refresh */}
          <button
            onClick={handleRefreshAll}
            className="px-2 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="Refresh Dashboard">
            <RefreshCw
              size={17}
              className={dashLoading || actionLoading || ordersLoading ? 'animate-spin text-blue-600' : ''}
            />
          </button>

          {/* Date Filter dropdown */}
          <div className="relative inline-flex items-center">
            <Calendar size={13} className="absolute left-2.5 text-blue-600 pointer-events-none" />
            <select
              value={dayPreset}
              onChange={e => handleDayPresetChange(e.target.value)}
              className="pl-7 pr-7 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer appearance-none transition-all">
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Custom date inputs — inline in the same row when Custom Range is active */}
          {showCustomDate && (
            <>
              <span className="text-slate-400 text-xs font-semibold shrink-0">From:</span>
              <input
                type="date"
                value={customFrom}
                onChange={e => {
                  setCustomFrom(e.target.value);
                  if (e.target.value && customTo) setDateRange({ preset: 'custom', from: e.target.value, to: customTo });
                }}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
              />
              <span className="text-slate-400 text-xs font-semibold shrink-0">To:</span>
              <input
                type="date"
                value={customTo}
                onChange={e => {
                  setCustomTo(e.target.value);
                  if (customFrom && e.target.value) setDateRange({ preset: 'custom', from: customFrom, to: e.target.value });
                }}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
              />
            </>
          )}

          {/* Clear Filter */}
          {dayPreset !== 'this_month' && (
            <button
              type="button"
              onClick={handleClearFilter}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer">
              Clear Filter
            </button>
          )}
        </div>
      </div>


      {/* ── 5 Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">

        {/* Card 1: Delivered Tonnage — Blue Hero */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white rounded-xl p-4 sm:p-5 shadow-sm shadow-blue-600/25 flex flex-col justify-between min-h-[145px] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between relative z-10">
            <p className="text-[11px] font-bold text-blue-100 uppercase tracking-wider">
              {canManageTeam ? 'Team Tonnage' : 'Delivered Tonnage'}
            </p>
            <div className="p-2 bg-white/20 backdrop-blur-md text-white rounded-xl shadow-xs shrink-0">
              <Package size={18} />
            </div>
          </div>

          <div className="relative z-10">
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
                {totalDeliveredTonnage}
              </p>
              <span className="text-xs sm:text-sm font-bold text-blue-100">MT</span>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Won Orders — Blue Soft */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-blue-900/70 uppercase tracking-wider">Won Orders</p>
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight leading-none">
                {totalWonOrdersCount}
              </p>
              <span className="text-xs font-bold text-blue-700">Orders</span>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Visits — Emerald */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-900/70 uppercase tracking-wider">Customer Visits</p>
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <MapPin size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-black text-emerald-950 tracking-tight leading-none">
                {totalVisitsCount}
              </p>
              <span className="text-xs font-bold text-emerald-700">Visits</span>
            </div>
          </div>
        </div>

        {/* Card 4: New Customers — Indigo */}
        <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">New Customers</p>
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <Users size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight leading-none">
                {newCustomersCount}
              </p>
              <span className="text-xs font-bold text-indigo-700">Customers</span>
            </div>
          </div>
        </div>

        {/* Card 5: Complaints — Indigo, "Pending" language */}
        <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px] col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">Complaints</p>
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight leading-none">
                {openComplaints.length}
              </p>
              <span className="text-xs font-bold text-indigo-700">Pending</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Action Feed (Horizontally Scrollable) ─────────────────────── */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Your Action Feed &amp; Opportunities
              </h2>
              <p className="text-xs text-slate-500">
                Prioritized quote follow-ups, overdue reorders, pending complaints, and field actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold hidden sm:inline mr-1">
              {curatedActionItems.length} Action{curatedActionItems.length === 1 ? '' : 's'} Due
            </span>
            {curatedActionItems.length > 1 && (
              <>
                <button
                  onClick={handleScrollLeft}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Scroll Left">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleScrollRight}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Scroll Right">
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {curatedActionItems.length === 0 ? (
          <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-3 text-center">
            <CheckCircle2 size={22} className="text-blue-600 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-slate-700">
              All caught up! 🎉 No pending quote follow-ups, overdue customer reorders, or open complaint actions right now.
            </span>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex items-stretch gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {curatedActionItems.map(item => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(item.link)}
                  className={`snap-start shrink-0 w-[310px] sm:w-[350px] md:w-[360px] p-5 ${item.cardBg} rounded-xl shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group`}>
                  <div className="space-y-2.5">
                    {/* Category badge only (no HIGH/priority badge) */}
                    <div className="flex items-center">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${item.categoryColor}`}>
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-start gap-3 pt-1">
                      <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${item.iconBg}`}>
                        <IconComp size={17} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed line-clamp-2">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom bar: action button only (no "Quick Action" label) */}
                  <div className="pt-3.5 mt-3 border-t border-slate-200/70 flex items-center justify-end">
                    <button
                      type="button"
                      className={`px-3 py-1.5 ${item.btnBg} rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 group-hover:translate-x-0.5 cursor-pointer`}>
                      <span>{item.actionText}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Sales Manager Team Leaderboard (Manager / Admin only) ─────── */}
      {canManageTeam && salesRepLeaderboard.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Trophy size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Sales Representative Performance (Volume &amp; Activity)
                </h2>
                <p className="text-xs text-slate-500">
                  Delivered volume, confirmed orders, customer visits, and complaints
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
              {salesRepLeaderboard.length} Sales Reps
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Sales Representative</th>
                  <th className="px-4 py-3">Delivered Tonnage</th>
                  <th className="px-4 py-3">Won Orders</th>
                  <th className="px-4 py-3">Customer Visits</th>
                  <th className="px-4 py-3">Pending Complaints</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesRepLeaderboard.map((rep, idx) => (
                  <tr key={rep.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-slate-900 font-bold text-xs">{rep.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{rep.phone || 'No phone'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 text-xs font-mono">
                        {rep.deliveredTonnage} MT
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{rep.ordersCount} Orders</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{rep.visitsCount} Visits</td>
                    <td className="px-4 py-3.5">
                      {rep.complaintsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {rep.complaintsCount} Pending
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setViewingAs(rep)}
                        className="px-3 py-1 bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 hover:border-blue-600 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer">
                        View Rep
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Monthly Tonnage Trend & Top Accounts Grid ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Monthly Tonnage Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {canManageTeam ? 'Team Monthly Tonnage Trend (MT)' : 'Your Monthly Tonnage Trend (MT)'}
              </h3>
              <p className="text-xs text-slate-500">
                Delivered volume output grouped by calendar month for 2026
              </p>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              2026 Volume Overview
            </span>
          </div>

          <div className="h-64 w-full flex items-end justify-between gap-1.5 sm:gap-3 pt-6 pb-2 px-2 border-b border-slate-100 relative">
            {monthlyStats.map((item, idx) => {
              const heightPct = item.tonnage > 0 ? Math.max(15, Math.round((item.tonnage / maxTonnageForChart) * 100)) : 6;
              const isHovered = activeBarHover === idx;
              return (
                <div
                  key={item.month}
                  onMouseEnter={() => setActiveBarHover(idx)}
                  onMouseLeave={() => setActiveBarHover(null)}
                  className="flex-1 flex flex-col items-center gap-1 group cursor-pointer h-full justify-end relative">
                  {isHovered && (
                    <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl z-20 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 border border-slate-700">
                      {item.month}: {item.tonnage} MT ({item.ordersCount} Orders)
                    </div>
                  )}
                  <div
                    className="w-full max-w-[32px] rounded-t-lg bg-blue-100/70 group-hover:bg-blue-200 transition-all flex flex-col justify-end overflow-hidden"
                    style={{ height: `${heightPct}%` }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${isHovered ? 'bg-gradient-to-t from-blue-700 to-indigo-700' : 'bg-gradient-to-t from-blue-600 to-blue-500'}`}
                      style={{ height: '100%' }}
                    />
                  </div>
                  <span className={`text-xs font-bold mt-2 transition-colors ${isHovered ? 'text-blue-600' : 'text-slate-400'}`}>
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-2 font-bold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Monthly Confirmed Deliveries (MT)
            </span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
              Peak Month: {peakMonth.month} ({peakMonth.tonnage} MT)
            </span>
          </div>
        </div>

        {/* Right: Top Customer Accounts */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" />
              Top Customer Accounts
            </h3>
            <button
              onClick={() => navigate('/customers')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer">
              View All <ArrowRight size={13} />
            </button>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {topCustomerAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
                <Package size={28} className="text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">No customer tonnage yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Won orders will populate top buying accounts.</p>
              </div>
            ) : (
              topCustomerAccounts.map((cust, idx) => {
                const rawPct = Math.round((cust.tonnage / grandTotalTopTonnage) * 100);
                const barWidth = Math.max(8, rawPct);
                return (
                  <div key={idx} className="p-2.5 bg-slate-50/70 hover:bg-blue-50/40 rounded-xl border border-slate-200/70 transition-colors space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-900 flex items-center gap-2 truncate">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                          #{idx + 1}
                        </span>
                        <span className="truncate">{cust.name}</span>
                      </span>
                      <span className="font-mono font-bold text-blue-700 shrink-0">{cust.tonnage} MT</span>
                    </div>
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Volume Share</span>
            <span className="font-bold text-slate-700">Top Buying Accounts</span>
          </div>
        </div>

      </div>

    </div>
  );
}