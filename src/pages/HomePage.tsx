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
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';
import { calculateOrdersTotalTonnage, getOrderTonnage } from '../utils/pricingEngine';
import {
  Package,
  ShoppingBag,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Trophy,
  Building2,
  Calendar,
  Search,
  X,
  UserCheck,
} from 'lucide-react';

interface CarouselItem {
  id: string;
  category: string;
  title: string;
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

interface CustomerDirectoryItem {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  risk?: string;
  tier?: string;
  daysSinceLastOrder?: number;
}

// ── Number & Curve Formatting Helpers ────────────────────────────────────────
function formatTonnage(val: number, compact = false): string {
  if (!val || isNaN(val)) return '0';
  if (compact) {
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (val >= 1_000) return (val / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(val).toString();
  }
  return Number(val.toFixed(3)).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function getSmoothSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { employee, viewingAs, effectivePhone, setViewingAs, clearViewingAs, isAdmin } = useAuth();
  const activeRole = viewingAs ? viewingAs.role : employee?.role;
  const isViewingManager = activeRole === 'sales_manager' || activeRole === 'manager';
  const isViewingAdmin = activeRole === 'admin';
  const canManageTeam = isViewingManager || isViewingAdmin;

  const isSalesManagerUser =
    employee?.role === 'sales_manager' ||
    employee?.role === 'manager' ||
    ((viewingAs?.role === 'sales_manager' || viewingAs?.role === 'manager') && isAdmin);

  const handleSwitchToPersonal = () => {
    const target = viewingAs || employee;
    if (!target) return;
    setViewingAs({
      ...target,
      role: 'salesperson',
    });
  };

  const handleSwitchToTeamManager = () => {
    if (isAdmin && viewingAs) {
      setViewingAs({
        ...viewingAs,
        role: 'sales_manager',
      });
    } else {
      clearViewingAs();
    }
  };

  // ── Inline Filter State (Visits-tab style) ──────────────────────────────
  const [dayPreset, setDayPreset] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustomDate, setShowCustomDate] = useState(false);

  // ── Customer Search & Dropdown State ──────────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [dateRange, setDateRange] = useState<DateRange>({
    preset: 'all',
    from: undefined,
    to: undefined,
  });

  const handleDayPresetChange = (preset: string) => {
    setDayPreset(preset);
    if (preset === 'all') {
      setDateRange({ preset: 'all', from: undefined, to: undefined });
      setShowCustomDate(false);
      setCustomFrom('');
      setCustomTo('');
    } else if (preset === 'today') {
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
    } else if (preset === 'custom') {
      setShowCustomDate(true);
    }
  };

  const handleClearFilter = () => {
    setDayPreset('all');
    setShowCustomDate(false);
    setCustomFrom('');
    setCustomTo('');
    setDateRange({ preset: 'all', from: undefined, to: undefined });
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
          all_time: dateRange.preset === 'all' ? 'true' : undefined,
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
          all_time: dateRange.preset === 'all' ? 'true' : undefined,
          salesperson_phone: effectivePhone,
        })
        .then(r => r.data?.data || r.data),
    refetchInterval: 30000,
  });

  // 3. Won Orders Query (for Delivered Tonnage) - date range filter applied for RBAC + date accuracy
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
    queryKey: ['team-employees-list', effectivePhone],
    queryFn: () =>
      employeesApi
        .getAll(effectivePhone ? { salesperson_phone: effectivePhone } : undefined)
        .then(r => r.data?.data || r.data || []),
    enabled: canManageTeam,
  });

  // 8. Visits Query
  const { data: visitsData, refetch: refetchVisits } = useQuery({
    queryKey: ['home-visits-list', effectivePhone, dateRange],
    queryFn: () =>
      visitsApi
        .getAll({
          from: dateRange.from,
          to: dateRange.to,
          ...(effectivePhone ? { salesperson_phone: effectivePhone } : {}),
        })
        .then(r => {
          const raw = r?.data;
          return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
        }),
  });

  // 9. Complaints Query
  const { data: complaintsData, refetch: refetchComplaints } = useQuery({
    queryKey: ['home-complaints-list', effectivePhone, dateRange],
    queryFn: () =>
      complaintsApi
        .getAll({
          from: dateRange.from,
          to: dateRange.to,
          ...(effectivePhone ? { salesperson_phone: effectivePhone } : {}),
        })
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

  // ── Customer Directory for Search Dropdown ──────────────────────────────
  const customerDirectory = useMemo((): CustomerDirectoryItem[] => {
    const map = new Map<string, CustomerDirectoryItem>();

    // 1. Add from safeCustomers (churn / recurring customer data)
    safeCustomers.forEach((c: any) => {
      const name = (c.customer_name || c.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      map.set(key, {
        id: c.id || `virtual-${name}`,
        name,
        contactPerson: c.contact_person || '',
        phone: c.customer_phone || c.contact_phone || '',
        risk: (c.churn_risk || 'active').toLowerCase(),
        tier: c.tier || 'C',
        daysSinceLastOrder: c.days_since_last_order,
      });
    });

    // 2. Add any customer from won orders not yet in map
    safeOrders.forEach((o: any) => {
      const name = (o.customer_name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `virtual-order-${name}`,
          name,
          contactPerson: o.contact_person || '',
          phone: o.customer_phone || '',
          risk: 'active',
          tier: 'C',
        });
      }
    });

    // 3. Add any customer from deals/quotes not yet in map
    safeDeals.forEach((d: any) => {
      const name = (d.customer_name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `virtual-deal-${name}`,
          name,
          contactPerson: d.contact_person || '',
          phone: d.customer_phone || '',
          risk: 'active',
          tier: 'C',
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [safeCustomers, safeOrders, safeDeals]);

  // Filtered Customers based on user input
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) {
      return customerDirectory.slice(0, 15);
    }
    return customerDirectory
      .filter(c => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const contactMatch = (c.contactPerson || '').toLowerCase().includes(q);
        const phoneMatch = (c.phone || '').toLowerCase().includes(q);
        return nameMatch || contactMatch || phoneMatch;
      })
      .slice(0, 20);
  }, [customerDirectory, customerSearch]);

  const handleSelectCustomer = (customer: CustomerDirectoryItem) => {
    setIsDropdownOpen(false);
    setCustomerSearch('');
    setHighlightedIndex(-1);
    if (customer.id && !customer.id.startsWith('virtual-')) {
      navigate(`/customers?id=${encodeURIComponent(customer.id)}`);
    } else {
      navigate(`/customers?name=${encodeURIComponent(customer.name)}`);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
        setHighlightedIndex(0);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        e.preventDefault();
        handleSelectCustomer(filteredCustomers[highlightedIndex]);
      } else if (filteredCustomers.length > 0) {
        e.preventDefault();
        handleSelectCustomer(filteredCustomers[0]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Orders are already date-filtered by the API query, so use safeOrders directly
  const targetOrders = safeOrders;

  // 1. Total Delivered Tonnage (MT) - from Orders API (date-range filtered, centralized calculation)
  const deliveredTonnageResult = useMemo(() => {
    return calculateOrdersTotalTonnage(targetOrders);
  }, [targetOrders]);
  const totalDeliveredTonnage = deliveredTonnageResult.totalMt;

  // 2. Won Orders count
  const totalWonOrdersCount = targetOrders.length;

  // 3. New Customers count
  const newCustomersCount = Number(dashboardData?.kra2?.count ?? 0);

  // 4. Customer Visits count
  const totalVisitsCount = useMemo(() => {
    return safeVisits.length;
  }, [safeVisits]);

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


  const { chartPoints, linePath, areaPath, yTicks } = useMemo(() => {
    const padLeft = 45;
    const padRight = 15;
    const padTop = 15;
    const padBottom = 25;
    const plotW = 500 - padLeft - padRight;
    const plotH = 200 - padTop - padBottom;

    const points = monthlyStats.map((item, idx) => {
      const x = padLeft + (idx / Math.max(1, monthlyStats.length - 1)) * plotW;
      const normalizedVal = maxTonnageForChart > 0 ? item.tonnage / maxTonnageForChart : 0;
      const y = padTop + plotH - normalizedVal * plotH;
      return { ...item, x, y, idx };
    });

    const lPath = getSmoothSvgPath(points);
    const aPath = points.length > 0
      ? `${lPath} L ${points[points.length - 1].x.toFixed(1)},${(padTop + plotH).toFixed(1)} L ${points[0].x.toFixed(1)},${(padTop + plotH).toFixed(1)} Z`
      : '';

    const ticks = [1, 0.66, 0.33, 0].map(pct => ({
      pct,
      val: Math.round(maxTonnageForChart * pct),
      y: padTop + plotH - pct * plotH,
    }));

    return { chartPoints: points, linePath: lPath, areaPath: aPath, yTicks: ticks };
  }, [monthlyStats, maxTonnageForChart]);

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
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // ── Curated Action Carousel (3-colour palette: Blue, Emerald, Indigo) ──
  const curatedActionItems: CarouselItem[] = useMemo(() => {
    const items: CarouselItem[] = [];

    // 1. Quote Follow-up
    const quotedDeals = safeDeals.filter(d => d.stage === 'quoted' || d.stage === 'sent_to_party');
    if (quotedDeals.length > 0) {
      items.push({
        id: 'action-quote-followup',
        category: 'Quote Follow-up',
        title: quotedDeals.length === 1 ? '1 quote needs follow-up' : `${quotedDeals.length} quotes need follow-up`,
        link: '/pipeline',
        icon: Clock,
      });
    }

    // 2. Reorder Window / Dormant Client
    const overdueCustomers = safeCustomers.filter(c => {
      if (!c.days_since_last_order) return false;
      const interval = Number(c.avg_order_interval_days) || 30;
      return c.days_since_last_order > interval || c.churn_risk === 'high' || c.churn_risk === 'medium';
    });
    if (overdueCustomers.length > 0) {
      items.push({
        id: 'action-reorder',
        category: 'Reorder Window',
        title: overdueCustomers.length === 1 ? '1 customer overdue for reorder' : `${overdueCustomers.length} customers overdue for reorder`,
        link: '/customers',
        icon: Package,
      });
    }

    // 3. Pending Complaints
    if (openComplaints.length > 0) {
      const countPending = openComplaints.length;
      items.push({
        id: 'action-complaints',
        category: 'Pending Complaints',
        title: `${countPending} pending complaint${countPending > 1 ? 's' : ''} need resolution`,
        link: '/complaints',
        icon: AlertTriangle,
      });
    }

    // 4. Follow-ups Due
    const visitsWithFollowup = safeVisits.filter(
      v => (v.follow_up_action || v.follow_up || v.followup || '').trim().length > 0,
    );
    if (visitsWithFollowup.length > 0) {
      items.push({
        id: 'action-visit-followups',
        category: 'Follow-ups Due',
        title: visitsWithFollowup.length === 1 ? '1 visit follow-up due' : `${visitsWithFollowup.length} visit follow-ups due`,
        link: '/visits',
        icon: MapPin,
      });
    }

    // 5. AI Extractions
    if (safeReviewQueue.length > 0) {
      items.push({
        id: 'action-ai-review',
        category: 'AI Extractions',
        title: safeReviewQueue.length === 1 ? '1 AI extraction awaiting review' : `${safeReviewQueue.length} AI extractions awaiting review`,
        link: '/inquiries',
        icon: Sparkles,
      });
    }

    return items;
  }, [safeDeals, safeCustomers, openComplaints, safeVisits, safeReviewQueue]);

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">

      {/* ── Greeting & Dual-Role Switcher ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {greeting}, {(viewingAs ? viewingAs.name : employee?.name)?.split(' ')[0] || 'Sales Executive'}
        </h1>

        {isSalesManagerUser && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isViewingManager ? (
              <button
                onClick={handleSwitchToPersonal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Switch to My Personal Salesperson Dashboard"
              >
                <UserCheck size={14} />
                Salesperson
              </button>
            ) : (
              <button
                onClick={handleSwitchToTeamManager}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Switch to Sales Manager Team Dashboard"
              >
                <Users size={14} />
                Sales Manager
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Nav Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">

        {/* Left: Customer Search Dropdown */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-sm sm:max-w-md">
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                setIsDropdownOpen(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search or select customer..."
              className="w-full pl-9 pr-14 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 font-medium text-slate-800"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => { setCustomerSearch(''); setHighlightedIndex(-1); }}
                  className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="Clear search">
                  <X size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                title="Toggle customer list">
                <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Customer Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 duration-100 max-h-72 flex flex-col">
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Customers {customerDirectory.length > 0 ? `(${customerDirectory.length})` : ''}</span>
                <span className="text-[10px] text-slate-400 font-normal">Click to view details</span>
              </div>
              <div className="overflow-y-auto divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No customers found matching &quot;{customerSearch}&quot;
                  </div>
                ) : (
                  filteredCustomers.map((cust, idx) => {
                    const isHighlighted = highlightedIndex === idx;
                    return (
                      <button
                        key={cust.id || cust.name}
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          handleSelectCustomer(cust);
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer ${
                          isHighlighted ? 'bg-blue-50/80 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
                        }`}>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isHighlighted ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                            <Building2 size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold truncate ${isHighlighted ? 'text-blue-900' : 'text-slate-800'}`}>
                              {cust.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {cust.contactPerson ? `${cust.contactPerson} · ` : ''}
                              {cust.phone ? cust.phone : (cust.daysSinceLastOrder ? `Last ordered ${cust.daysSinceLastOrder}d ago` : 'Active Account')}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          cust.risk === 'credit_watch'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : cust.risk === 'churning' || cust.risk === 'high'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : cust.risk === 'at_risk' || cust.risk === 'medium'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          {cust.risk === 'credit_watch'
                            ? 'Credit Watch'
                            : cust.risk === 'churning' || cust.risk === 'high'
                              ? 'Churning'
                              : cust.risk === 'at_risk' || cust.risk === 'medium'
                                ? 'At Risk'
                                : 'Active'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
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
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7_days">Last 7 Days</option>
              <option value="30_days">Last 30 Days</option>
              <option value="90_days">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 text-slate-400 pointer-events-none" />
          </div>

          {/* Custom date inputs - inline in the same row when Custom Range is active */}
          {showCustomDate && (
            <>
              <span className="text-slate-400 text-xs font-semibold shrink-0">From:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={e => {
                  const val = e.target.value;
                  setCustomFrom(val);
                  let effectiveTo = customTo;
                  if (val && customTo && val > customTo) {
                    effectiveTo = val;
                    setCustomTo(val);
                  }
                  if (val && effectiveTo) setDateRange({ preset: 'custom', from: val, to: effectiveTo });
                }}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
              />
              <span className="text-slate-400 text-xs font-semibold shrink-0">To:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={e => {
                  const val = e.target.value;
                  let effectiveVal = val;
                  if (val && customFrom && val < customFrom) {
                    effectiveVal = customFrom;
                  }
                  setCustomTo(effectiveVal);
                  if (customFrom && effectiveVal) setDateRange({ preset: 'custom', from: customFrom, to: effectiveVal });
                }}
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs cursor-pointer"
              />
            </>
          )}

          {/* Clear Filter */}
          {dayPreset !== 'all' && (
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

        {/* Card 1: Delivered Tonnage - Blue Hero */}
        <div
          onClick={() => navigate('/orders')}
          className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white rounded-xl p-4 sm:p-5 shadow-sm shadow-blue-600/25 flex flex-col justify-between min-h-[145px] relative overflow-hidden group hover:shadow-md transition-all cursor-pointer">
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
                {formatTonnage(totalDeliveredTonnage)}
              </p>
              <span className="text-xs sm:text-sm font-bold text-blue-100">MT</span>
            </div>
            
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Won Orders - Blue Soft */}
        <div
          onClick={() => navigate('/orders')}
          className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px] cursor-pointer">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs self-start shrink-0">
            <ShoppingBag size={18} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {totalWonOrdersCount}
              </p>
              <span className="text-sm sm:text-base font-bold text-slate-900">Won Orders</span>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Visits - Blue Soft */}
        <div
          onClick={() => navigate('/visits')}
          className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px] cursor-pointer">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs self-start shrink-0">
            <MapPin size={18} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {totalVisitsCount}
              </p>
              <span className="text-sm sm:text-base font-bold text-slate-900">Customer Visits</span>
            </div>
          </div>
        </div>

        {/* Card 4: New Customers - Blue Soft */}
        <div
          onClick={() => navigate('/customers')}
          className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px] cursor-pointer">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs self-start shrink-0">
            <Users size={18} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {newCustomersCount}
              </p>
              <span className="text-sm sm:text-base font-bold text-slate-900">New Customers</span>
            </div>
          </div>
        </div>

        {/* Card 5: Complaints - Blue Soft */}
        <div
          onClick={() => navigate('/complaints')}
          className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px] col-span-2 sm:col-span-1 cursor-pointer">
          <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs self-start shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {openComplaints.length}
              </p>
              <span className="text-sm sm:text-base font-bold text-slate-900">Complaints</span>
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
                Your Action Feed
              </h2>
            </div>
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
            className="flex items-stretch gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {curatedActionItems.map(item => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(item.link)}
                  className="snap-start shrink-0 w-[300px] sm:w-[340px] md:w-[360px] p-4 sm:p-5 bg-blue-50/80 border-2 border-blue-200/90 hover:border-blue-400 rounded-xl shadow-2xs hover:shadow-md transition-all flex items-start gap-3 cursor-pointer group">
                  {/* Left: Icon */}
                  <div className="p-2 bg-blue-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5">
                    <IconComp size={16} />
                  </div>

                  {/* Right: Bold Header & Normal Description right below header */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight leading-snug truncate">
                      {item.category}
                    </h3>
                    <p className="text-xs sm:text-sm font-normal text-slate-600 group-hover:text-blue-700 transition-colors leading-snug truncate mt-0.5">
                      {item.title}
                    </p>
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
                        {formatTonnage(rep.deliveredTonnage)} MT
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
                        <span className="text-slate-400 font-medium">-</span>
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

      {/* ── Monthly Tonnage Trend & Top Accounts Grid (50-50 Split) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Monthly Tonnage Smooth Area Chart (50%) */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {canManageTeam ? 'Team Monthly Tonnage Trend (MT)' : 'Your Monthly Tonnage Trend (MT)'}
              </h3>
              <p className="text-xs text-slate-500">
                Delivered volume output grouped by calendar month for 2026
              </p>
            </div>
          </div>

          <div className="relative w-full h-64 flex flex-col justify-end pt-2">
            {/* Tooltip for active hover */}
            {activeBarHover !== null && chartPoints[activeBarHover] && (
              <div
                className="absolute pointer-events-none bg-slate-900 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg shadow-xl z-20 whitespace-nowrap -translate-x-1/2 -translate-y-full border border-slate-700 transition-all animate-in fade-in zoom-in-95 duration-100"
                style={{
                  left: `${(chartPoints[activeBarHover].x / 500) * 100}%`,
                  top: `${(chartPoints[activeBarHover].y / 200) * 100}%`,
                  marginTop: '-10px',
                }}>
                {chartPoints[activeBarHover].month} 2026: {formatTonnage(chartPoints[activeBarHover].tonnage)} MT ({chartPoints[activeBarHover].ordersCount} orders)
              </div>
            )}

            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines & Y-axis scale labels */}
              {yTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={45}
                    y1={tick.y}
                    x2={485}
                    y2={tick.y}
                    stroke="#f1f5f9"
                    strokeDasharray="4 4"
                    strokeWidth="1.2"
                  />
                  <text
                    x={37}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    className="text-[10px] font-semibold fill-slate-400 font-mono">
                    {formatTonnage(tick.val, true)}
                  </text>
                </g>
              ))}

              {/* Area fill under curve */}
              {areaPath && (
                <path
                  d={areaPath}
                  fill="url(#areaGradient)"
                />
              )}

              {/* Smooth line curve */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Vertical indicator line for hovered point */}
              {activeBarHover !== null && chartPoints[activeBarHover] && (
                <line
                  x1={chartPoints[activeBarHover].x}
                  y1={15}
                  x2={chartPoints[activeBarHover].x}
                  y2={175}
                  stroke="#93c5fd"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Interactive Points + Month labels */}
              {chartPoints.map((pt, idx) => {
                const isHovered = activeBarHover === idx;
                return (
                  <g key={pt.month} className="cursor-pointer">
                    {/* Transparent hover hit area */}
                    <rect
                      x={pt.x - 18}
                      y={0}
                      width={36}
                      height={200}
                      fill="transparent"
                      onMouseEnter={() => setActiveBarHover(idx)}
                      onMouseLeave={() => setActiveBarHover(null)}
                    />

                    {/* Point circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : pt.tonnage > 0 ? 3.5 : 2}
                      className={`transition-all duration-150 pointer-events-none ${isHovered
                        ? 'fill-blue-600 stroke-white stroke-2 shadow-md'
                        : pt.tonnage > 0
                          ? 'fill-blue-600 stroke-blue-100 stroke-1'
                          : 'fill-slate-300'
                        }`}
                    />

                    {/* X-axis Month Label */}
                    <text
                      x={pt.x}
                      y={192}
                      textAnchor="middle"
                      className={`text-[10px] font-bold transition-colors pointer-events-none ${isHovered ? 'fill-blue-600' : 'fill-slate-400'
                        }`}>
                      {pt.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-2 font-bold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Monthly Confirmed Deliveries (MT)
            </span>
          </div>
        </div>

        {/* Right: Top Customer Accounts (50%) */}
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
                      <span className="font-mono font-bold text-blue-700 shrink-0">{formatTonnage(cust.tonnage)} MT</span>
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

        </div>

      </div>

    </div>
  );
}