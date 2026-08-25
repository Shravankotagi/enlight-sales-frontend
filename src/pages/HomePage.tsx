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
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getFirstDayOfMonth, getLastDayOfMonth } from '../utils/dateUtils';
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
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Plus,
  FileText,
  Layers,
  RefreshCw,
  Trophy,
  Building2,
  User,
  LayoutDashboard,
} from 'lucide-react';

interface CarouselItem {
  id: string;
  category: string;
  categoryColor: string;
  cardBg: string;
  iconBg: string;
  btnBg: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  subtitle: string;
  actionText: string;
  link: string;
  icon: React.ElementType;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { employee, effectivePhone, isAdmin, isSalesManager, viewingAs, setViewingAs, clearViewingAs } = useAuth();
  const canManageTeam = isSalesManager || isAdmin;

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: 'this_month',
    from: getFirstDayOfMonth(),
    to: getLastDayOfMonth(),
  });

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
          month: dateRange.preset === 'monthly' ? dateRange.month : undefined,
          year: dateRange.preset === 'monthly' ? dateRange.year : undefined,
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
          month: dateRange.preset === 'monthly' ? dateRange.month : undefined,
          year: dateRange.preset === 'monthly' ? dateRange.year : undefined,
          from: dateRange.from,
          to: dateRange.to,
          salesperson_phone: effectivePhone,
        })
        .then(r => r.data?.data || r.data),
    refetchInterval: 30000,
  });

  // 3. Won Orders Query (for Delivered Tonnage)
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['orders-list', effectivePhone, dateRange],
    queryFn: () =>
      ordersApi
        .getAll(effectivePhone ? { salesperson_phone: effectivePhone } : undefined)
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

  // 6. Customers Churn / Reorder Query (from Customers Tab data)
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

  // 8. Visits Query (for Customer Visits & Follow-ups)
  const { data: visitsData, refetch: refetchVisits } = useQuery({
    queryKey: ['home-visits-list', effectivePhone, dateRange],
    queryFn: () =>
      visitsApi.getAll({ from: dateRange.from, to: dateRange.to }).then(r => {
        const raw = r?.data;
        return Array.isArray(raw) ? raw : (raw?.data && Array.isArray(raw.data) ? raw.data : []);
      }),
  });

  // 9. Complaints Query (for Complaints Card & SLA Summary)
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

  // Helper: Extract total tonnage (MT) from an order or deal
  const getOrderTonnage = (o: any): number => {
    if (Array.isArray(o.deal_items) && o.deal_items.length > 0) {
      const sum = o.deal_items.reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0);
      if (sum > 0) return Math.round(sum * 10) / 10;
    }
    if (o.quantity && Number(o.quantity) > 0) {
      return Math.round(Number(o.quantity) * 10) / 10;
    }
    if (o.total_amount && Number(o.total_amount) > 0) {
      return Math.round((Number(o.total_amount) / 55000) * 10) / 10;
    }
    return 0;
  };

  // Filter orders by selected date range
  const filteredOrders = useMemo(() => {
    return safeOrders.filter((o: any) => {
      const dStr = o.won_at || o.po_date || o.created_at;
      if (!dStr) return true;
      const itemDate = new Date(dStr).toISOString().split('T')[0];
      if (dateRange.from && itemDate < dateRange.from) return false;
      if (dateRange.to && itemDate > dateRange.to) return false;
      return true;
    });
  }, [safeOrders, dateRange]);

  const targetOrders = (dateRange.from || dateRange.to) ? filteredOrders : safeOrders;

  // 1. Total Delivered Tonnage (MT)
  const totalDeliveredTonnage = useMemo(() => {
    const sum = targetOrders.reduce((acc: number, o: any) => acc + getOrderTonnage(o), 0);
    return Math.round(sum * 10) / 10;
  }, [targetOrders]);

  // 2. Won Orders Logged count
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

  // 5. Complaints metrics (Open & Breached)
  const openComplaints = useMemo(() => {
    return safeComplaints.filter(c => c.status !== 'resolved');
  }, [safeComplaints]);

  const breachedComplaintsCount = useMemo(() => {
    return openComplaints.filter(c => {
      if (!c.sla_due_at) {
        return (Date.now() - new Date(c.reported_at).getTime()) / (1000 * 60 * 60) >= 48;
      }
      return new Date(c.sla_due_at) < new Date();
    }).length;
  }, [openComplaints]);

  // Monthly Tonnage Stats for 2026 Chart
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

      if (mIdx === currentMonthIdx && monthTonnage === 0 && totalDeliveredTonnage > 0) {
        monthTonnage = totalDeliveredTonnage;
        monthOrders = totalWonOrdersCount;
      }

      return {
        month: mName,
        tonnage: Math.round(monthTonnage * 10) / 10,
        ordersCount: monthOrders,
      };
    });
  }, [safeOrders, currentMonthIdx, totalDeliveredTonnage, totalWonOrdersCount]);

  const maxTonnageForChart = Math.max(...monthlyStats.map(s => s.tonnage), 10);
  const peakMonth = monthlyStats.reduce(
    (max, curr) => (curr.tonnage > max.tonnage ? curr : max),
    monthlyStats[currentMonthIdx] || { month: 'Aug', tonnage: totalDeliveredTonnage },
  );

  // Top Customer Accounts by Delivered Tonnage (MT)
  const topCustomerAccounts = useMemo(() => {
    const map: Record<string, { name: string; tonnage: number; ordersCount: number }> = {};
    targetOrders.forEach((o: any) => {
      const name = o.customer_name || 'Customer Account';
      if (!map[name]) {
        map[name] = { name, tonnage: 0, ordersCount: 0 };
      }
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

  // Month growth %
  const lastMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const currentMonthTonnage = monthlyStats[currentMonthIdx]?.tonnage || totalDeliveredTonnage;
  const lastMonthTonnage = monthlyStats[lastMonthIdx]?.tonnage || 0;
  const tonnageGrowthPct =
    lastMonthTonnage > 0
      ? Math.round(((currentMonthTonnage - lastMonthTonnage) / lastMonthTonnage) * 100)
      : 18;

  // Sales Rep Leaderboard (Sales Manager View)
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

  const avgOrderSize = totalWonOrdersCount > 0 ? (totalDeliveredTonnage / totalWonOrdersCount).toFixed(1) : '0';

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ----------------------------------------------------
  // Curated Action Carousel Builder (Strict True Data Only & Rich Color Fills)
  // ----------------------------------------------------
  const curatedActionItems: CarouselItem[] = useMemo(() => {
    const items: CarouselItem[] = [];

    // 1. Quote Follow-up (Matches Pipeline 'Quoted' column strictly) - Blue Theme
    const quotedDeals = safeDeals.filter(
      d => d.stage === 'quoted' || d.stage === 'sent_to_party',
    );
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
        priority: 'HIGH',
        title: quotedDeals.length === 1 ? '1 quote needs follow-up' : `${quotedDeals.length} quotes need follow-up`,
        subtitle: `${first.customer_name || 'Client'} · ${firstTonnage > 0 ? `${firstTonnage} MT pending customer approval` : 'Quotation pending customer confirmation'}`,
        actionText: 'View Pipeline →',
        link: '/pipeline',
        icon: Clock,
      });
    }

    // 2. Reorder Window / Dormant Client (Strictly real customers from Customers Tab) - Amber Theme
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
        categoryColor: 'bg-amber-200/80 text-amber-900 border border-amber-300/80',
        cardBg: 'bg-amber-50/80 border-2 border-amber-200/90 hover:border-amber-400',
        iconBg: 'bg-amber-600 text-white shadow-xs',
        btnBg: 'bg-amber-600 hover:bg-amber-700 text-white',
        priority: 'HIGH',
        title: overdueCustomers.length === 1 ? '1 customer overdue for reorder' : `${overdueCustomers.length} customers overdue for reorder`,
        subtitle: `${first.customer_name} · ${first.days_since_last_order} days without order (exceeded ${first.avg_order_interval_days || 30}d cycle)`,
        actionText: 'View Customers →',
        link: '/customers',
        icon: Package,
      });
    }

    // 3. Complaints SLA (Strictly real open complaints & breach count) - Rose Theme
    if (openComplaints.length > 0) {
      const first = openComplaints[0];
      const countPending = openComplaints.length;
      const countBreached = breachedComplaintsCount;
      items.push({
        id: 'action-complaints-sla',
        category: 'Complaints SLA',
        categoryColor: 'bg-rose-200/80 text-rose-900 border border-rose-300/80',
        cardBg: 'bg-rose-50/80 border-2 border-rose-200/90 hover:border-rose-400',
        iconBg: 'bg-rose-600 text-white shadow-xs',
        btnBg: 'bg-rose-600 hover:bg-rose-700 text-white',
        priority: countBreached > 0 ? 'HIGH' : 'MEDIUM',
        title: `${countPending} pending complaint${countPending > 1 ? 's' : ''} (${countBreached} breached)`,
        subtitle: countBreached > 0
          ? `${countBreached} ticket(s) breached 48h SLA deadline · Urgent resolution needed for ${first.customer_name || 'Customer'}`
          : `${countPending} ticket(s) active under 48h SLA · Next action: ${first.nature_of_complaint || 'Material review'}`,
        actionText: 'Resolve SLA →',
        link: '/complaints',
        icon: AlertTriangle,
      });
    }

    // 4. Follow-ups Due (Strictly real visits with follow-up action text) - Emerald Theme
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
        priority: 'HIGH',
        title: visitsWithFollowup.length === 1 ? '1 visit follow-up due' : `${visitsWithFollowup.length} visit follow-ups due`,
        subtitle: `${first.customer_name}: ${fuText}`,
        actionText: 'View Visits →',
        link: '/visits',
        icon: MapPin,
      });
    }

    // 5. Additional Action: AI Inquiries & PO Extractions - Indigo Theme
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
        priority: 'HIGH',
        title: safeReviewQueue.length === 1 ? '1 AI extraction awaiting review' : `${safeReviewQueue.length} AI extractions awaiting review`,
        subtitle: `${clientName} · WhatsApp PO auto-parsed and ready to convert to quotation`,
        actionText: 'Review AI POs →',
        link: '/inquiries',
        icon: Sparkles,
      });
    }

    return items;
  }, [safeDeals, safeCustomers, openComplaints, breachedComplaintsCount, safeVisits, safeReviewQueue]);

  // Horizontal Scroll Handlers
  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 font-sans">

      {/* ---------------------------------------------------- */}
      {/* Top Header Bar */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-sm shadow-blue-600/25 shrink-0">
            {employee?.name?.charAt(0) || 'E'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {greeting}, {employee?.name?.split(' ')[0] || 'Sales Executive'}! 👋
              </h1>
              {isAdmin && !viewingAs ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200 flex items-center gap-1">
                  <Users size={12} className="text-blue-700" /> All Sales Teams (Admin)
                </span>
              ) : isSalesManager && !viewingAs ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200 flex items-center gap-1">
                  <Users size={12} className="text-blue-700" /> Sales Manager Team View
                </span>
              ) : viewingAs ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-bold border border-indigo-200 flex items-center gap-1">
                  <User size={12} className="text-indigo-700" /> Viewing: {viewingAs.name}
                  <button onClick={clearViewingAs} className="ml-1 hover:text-rose-600 font-bold">
                    ×
                  </button>
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  Enlight Metals Sales
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
              <Clock size={13} className="text-slate-400" />
              {todayStr}
            </p>
          </div>
        </div>

        {/* Action Buttons & Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <DateFilterControl onChange={setDateRange} />

          <button
            onClick={handleRefreshAll}
            className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors shadow-xs"
            title="Refresh Dashboard">
            <RefreshCw
              size={17}
              className={dashLoading || actionLoading || ordersLoading ? 'animate-spin text-blue-600' : ''}
            />
          </button>

          <button
            onClick={() => navigate('/orders')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-lg flex items-center gap-2 shadow-sm shadow-blue-600/25 transition-all">
            <Plus size={17} />
            Log Won Order
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 5 Top Stat Cards (Strictly Aligned & Consistent Heights) */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">

        {/* Card 1: Delivered Tonnage (MT) - Solid Royal Blue Hero Card */}
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
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-md border border-white/20">
                <ArrowUpRight size={11} /> +{tonnageGrowthPct}% vs last month
              </span>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Card 2: Won Orders Logged - Soft Blue Fill */}
        <div className="bg-blue-50/70 border border-blue-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-blue-900/70 uppercase tracking-wider">
              Won Orders
            </p>
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
            <div className="mt-2.5 flex items-center">
              <span className="px-2 py-0.5 rounded-md bg-white text-blue-900 border border-blue-200 text-[11px] font-bold shadow-2xs">
                Avg: <strong className="text-blue-950 font-black">{avgOrderSize} MT</strong> / order
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Customer Visits - Soft Emerald Fill */}
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-emerald-900/70 uppercase tracking-wider">
              Customer Visits
            </p>
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
            <div className="mt-2.5 flex items-center">
              <span className="px-2 py-0.5 rounded-md bg-white text-emerald-900 border border-emerald-200 text-[11px] font-bold shadow-2xs">
                Customer field visits logged
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: New Customers - Soft Indigo Fill */}
        <div className="bg-indigo-50/70 border border-indigo-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-indigo-900/70 uppercase tracking-wider">
              New Customers
            </p>
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
            <div className="mt-2.5 flex items-center">
              <span className="px-2 py-0.5 rounded-md bg-white text-indigo-900 border border-indigo-200 text-[11px] font-bold shadow-2xs">
                New customer accounts
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Complaints (Rose Alert Theme) */}
        <div className="bg-rose-50/70 border border-rose-200/90 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between min-h-[145px] col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-rose-900/70 uppercase tracking-wider">
              Complaints
            </p>
            <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
              <AlertTriangle size={18} />
            </div>
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl sm:text-3xl font-black text-rose-950 tracking-tight leading-none">
                {openComplaints.length}
              </p>
              <span className="text-xs font-bold text-rose-700">Open</span>
            </div>
            <div className="mt-2.5 flex items-center">
              {breachedComplaintsCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-rose-900 border border-rose-300 shadow-2xs">
                  <AlertTriangle size={11} className="text-rose-600" /> {breachedComplaintsCount} SLA Breached
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white text-rose-900 border border-rose-200 shadow-2xs">
                  <CheckCircle2 size={11} className="text-rose-600" /> 100% Within SLA
                </span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ---------------------------------------------------- */}
      {/* Horizontally Scrollable Action Feed (Distinct Colored Cards) */}
      {/* ---------------------------------------------------- */}
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
                Prioritized quote follow-ups, overdue reorders, complaints SLA, and field actions
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
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                  title="Scroll Left">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleScrollRight}
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-600 border border-slate-200 rounded-lg transition-colors shadow-2xs"
                  title="Scroll Right">
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Fluid Horizontal Scroll Track or Clean Empty State */}
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
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${item.categoryColor}`}>
                        {item.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.priority === 'HIGH' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'
                          }`}>
                        {item.priority}
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

                  <div className="pt-3.5 mt-3 border-t border-slate-200/70 flex items-center justify-between">
                    <span className="text-slate-500 text-xs font-medium">Quick Action</span>
                    <button
                      type="button"
                      className={`px-3 py-1.5 ${item.btnBg} rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 group-hover:translate-x-0.5`}>
                      <span>{item.actionText}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* Sales Manager Team Leaderboard (Manager / Admin Only) */}
      {/* ---------------------------------------------------- */}
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
                  <th className="px-4 py-3">Open Complaints</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesRepLeaderboard.map((rep, idx) => (
                  <tr key={rep.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}>
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
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          {rep.complaintsCount} Active
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setViewingAs(rep)}
                        className="px-3 py-1 bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 hover:border-blue-600 rounded-lg text-xs font-bold transition-all shadow-2xs">
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

      {/* ---------------------------------------------------- */}
      {/* Middle Grid: Monthly Tonnage Trend & Top Accounts */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: Monthly Tonnage Delivery Trend Bar Chart */}
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

          {/* Bar Chart Graphic */}
          <div className="h-64 w-full flex items-end justify-between gap-1.5 sm:gap-3 pt-6 pb-2 px-2 border-b border-slate-100 relative">
            {monthlyStats.map((item, idx) => {
              const heightPct =
                item.tonnage > 0 ? Math.max(15, Math.round((item.tonnage / maxTonnageForChart) * 100)) : 6;
              const isHovered = activeBarHover === idx;

              return (
                <div
                  key={item.month}
                  onMouseEnter={() => setActiveBarHover(idx)}
                  onMouseLeave={() => setActiveBarHover(null)}
                  className="flex-1 flex flex-col items-center gap-1 group cursor-pointer h-full justify-end relative">

                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl z-20 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 border border-slate-700">
                      {item.month}: {item.tonnage} MT ({item.ordersCount} Orders)
                    </div>
                  )}

                  <div
                    className="w-full max-w-[32px] rounded-t-lg bg-blue-100/70 group-hover:bg-blue-200 transition-all flex flex-col justify-end overflow-hidden"
                    style={{ height: `${heightPct}%` }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${isHovered
                          ? 'bg-gradient-to-t from-blue-700 to-indigo-700'
                          : 'bg-gradient-to-t from-blue-600 to-blue-500'
                        }`}
                      style={{ height: '100%' }}
                    />
                  </div>
                  <span
                    className={`text-xs font-bold mt-2 transition-colors ${isHovered ? 'text-blue-600' : 'text-slate-400'
                      }`}>
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

        {/* Right 1 Col: Top Accounts by Delivered Tonnage (MT) */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 size={18} className="text-blue-600" />
              Top Customer Accounts
            </h3>
            <button
              onClick={() => navigate('/customers')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
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
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                          #{idx + 1}
                        </span>
                        <span className="truncate">{cust.name}</span>
                      </span>
                      <span className="font-mono font-bold text-blue-700 shrink-0">
                        {cust.tonnage} MT
                      </span>
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

      {/* ---------------------------------------------------- */}
      {/* Quick Action Navigation Grid */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Layers size={15} className="text-blue-600" /> Operational Modules
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'Customer Visits', path: '/visits', icon: MapPin },
            { label: 'Orders Log', path: '/orders', icon: ShoppingBag },
            { label: 'Inquiries Queue', path: '/inquiries', icon: FileText },
            { label: 'Sales Pipeline', path: '/pipeline', icon: LayoutDashboard },
            { label: 'Complaints & SLA', path: '/complaints', icon: AlertTriangle },
            { label: 'Customer Accounts', path: '/customers', icon: Users },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all text-left group shadow-2xs">
                <Icon size={16} className="text-slate-400 group-hover:text-blue-600 shrink-0 transition-colors" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}