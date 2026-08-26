import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '../lib/api';
import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, IndianRupee, Trash2, RefreshCw, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import DealDetailDrawer from '../components/DealDetailDrawer';
import DateFilterControl, { type DateFilterRange } from '../components/DateFilterControl';
import { getDaysAgo, formatLocalDate } from '../utils/dateUtils';

const DEFAULT_STAGES = [
  { key: 'new_inquiry', label: 'New Deals', color: 'bg-amber-50 border-amber-200' },
  { key: 'qualified', label: 'Qualified', color: 'bg-emerald-50 border-emerald-200' },
  { key: 'quoted', label: 'Quoted', color: 'bg-blue-50 border-blue-200' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-orange-50 border-orange-200' },
];

const LOST_REASONS = [
  'Price', 'Credit terms', 'Delivery timeline',
  'Material unavailable', 'Spec mismatch',
  'Competitor relationship', 'Customer silent', 'Cancelled by customer',
];

function DealCard({ deal, onStageChange, onSelect, onDelete }: {
  deal: any;
  onStageChange: (id: string, stage: string, reason?: string) => void;
  onSelect: (id: string) => void;
  onDelete: (deal: any) => void;
}) {
  return (
    <div
      onClick={() => onSelect(deal.id)}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group"
    >
      <div className="flex items-start justify-between mb-2 gap-1">
        <h4 className="text-sm font-semibold text-gray-800 leading-tight pr-2">
          {deal.customer_name || 'Unknown Customer'}
        </h4>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
            ${deal.stage === 'won' || deal.inquiry_type === 'purchase_order'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'}`}>
            {deal.stage === 'won' ? 'WON' : deal.inquiry_type === 'purchase_order' ? 'PO' : 'Inquiry'}
          </span>
          <button
            type="button"
            title="Delete this deal and all records"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(deal);
            }}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {deal.po_number && (
        <p className="text-xs text-gray-500 mb-1">PO: {deal.po_number}</p>
      )}

      {deal.deal_items && deal.deal_items.length > 0 && (
        <div className="mb-2">
          {deal.deal_items.slice(0, 2).map((item: any, i: number) => (
            <p key={i} className="text-xs text-gray-600">
              • {item.sku_text} - {item.quantity} {item.unit}
            </p>
          ))}
          {deal.deal_items.length > 2 && (
            <p className="text-xs text-gray-400">+{deal.deal_items.length - 2} more</p>
          )}
        </div>
      )}

      {(() => {
        let computedTotal = Number(deal.total_amount) || 0;
        if (
          computedTotal <= 0 &&
          Array.isArray(deal.deal_items) &&
          deal.deal_items.length > 0
        ) {
          const subtotal = deal.deal_items.reduce((sum: number, item: any) => {
            const amt =
              Number(item.amount) ||
              (Number(item.quantity) || 0) *
                (Number(item.rate || item.quoted_price || item.price_per_mt) || 0);
            return sum + amt;
          }, 0);
          if (subtotal > 0) {
            computedTotal = subtotal + Math.round(subtotal * 0.18);
          }
        }

        if (computedTotal > 0) {
          return (
            <div className="flex items-center gap-1 text-sm font-bold text-gray-900 my-1.5">
              <IndianRupee size={13} className="text-gray-700" />
              <span>{Number(computedTotal).toLocaleString('en-IN')}</span>
            </div>
          );
        }
        return null;
      })()}

      <div className="mt-3 flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
        {['qualified', 'quoted', 'negotiation', 'won', 'lost']
          .filter(stage => {
            const currentStage = (deal.stage || 'new_inquiry').toLowerCase().trim();
            if ((currentStage === 'new_inquiry' || currentStage === 'review') && (stage === 'won' || stage === 'lost')) {
              return false;
            }
            return true;
          })
          .map(stage => (
            <button key={stage}
              onClick={() => onStageChange(deal.id, stage)}
              className={`text-xs px-2 py-1 rounded border transition-colors
                ${stage === 'won'
                  ? 'border-green-300 text-green-700 hover:bg-green-50'
                  : stage === 'lost'
                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
              → {stage.charAt(0).toUpperCase() + stage.slice(1)}
            </button>
          ))}
      </div>

      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <span className="text-gray-400 font-medium">
          {new Date(deal.created_at).toLocaleDateString('en-IN')}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded tracking-wide uppercase">
            #{deal.deal_number || (deal.id ? `DEAL-${deal.id.substring(0, 6).toUpperCase()}` : 'DEAL')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const { effectivePhone } = useAuth();
  const [lostModal, setLostModal] = useState<{ dealId: string; reason: string } | null>(null);
  const [confirmDeleteDeal, setConfirmDeleteDeal] = useState<any | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateFilterRange>({
    preset: '30_days',
    from: getDaysAgo(30),
    to: formatLocalDate(),
  });

  const fromDate = dateRange.from ? (dateRange.from.includes('T') ? dateRange.from : `${dateRange.from}T00:00:00.000Z`) : undefined;
  const toDate = dateRange.to ? (dateRange.to.includes('T') ? dateRange.to : `${dateRange.to}T23:59:59.999Z`) : undefined;

  useEffect(() => {
    document.title = 'Pipeline - Enlight Sales OS';
  }, []);

  const { data: rawDeals = [], isLoading, isFetching, error, refetch: fetchDeals } = useQuery({
    queryKey: ['deals', effectivePhone, dateRange],
    queryFn: () => {
      const params: any = {};
      if (effectivePhone) params.salesperson_phone = effectivePhone;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      return dealsApi.getAll(params).then(r => r.data?.data ?? r.data ?? []);
    },
    refetchInterval: 15000,
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage, reason }: { id: string; stage: string; reason?: string }) =>
      dealsApi.updateStage(id, stage, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      toast.success('Deal stage updated');
      setLostModal(null);
    },
    onError: () => toast.error('Failed to update deal'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dealsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['kra-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      toast.success('Deal and all associated records deleted successfully');
      setConfirmDeleteDeal(null);
      setSelectedDealId(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete deal');
    },
  });

  const handleStageChange = (id: string, stage: string) => {
    if (stage === 'lost') {
      setLostModal({ dealId: id, reason: '' });
    } else {
      stageMutation.mutate({ id, stage });
    }
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setDateRange({
      preset: '30_days',
      from: getDaysAgo(30),
      to: formatLocalDate(),
    });
  };

  const filteredDeals = useMemo(() => {
    return (rawDeals || []).filter((d: any) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase().trim();
      const cName = (d.customer_name || '').toLowerCase();
      const poNum = (d.po_number || '').toLowerCase();
      const dealNum = (d.deal_number || (d.id ? `deal-${d.id.substring(0, 6)}` : '')).toLowerCase();
      const phone = (d.customer_phone || '').toLowerCase();
      const items = (d.deal_items || [])
        .map((i: any) => `${i.sku_text || ''} ${i.dimensions || ''}`)
        .join(' ')
        .toLowerCase();
      const dateFormatted = d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN').toLowerCase() : '';
      return (
        cName.includes(s) ||
        poNum.includes(s) ||
        dealNum.includes(s) ||
        phone.includes(s) ||
        items.includes(s) ||
        dateFormatted.includes(s)
      );
    });
  }, [rawDeals, searchTerm]);

  const stageCounts = useMemo(() => {
    const counts = {
      new_inquiry: 0,
      qualified: 0,
      quoted: 0,
      negotiation: 0,
      won: 0,
      lost: 0,
    };
    filteredDeals.forEach((d: any) => {
      const st = (d.stage || 'new_inquiry').toLowerCase().trim();
      if (st === 'new_inquiry' || st === 'review' || !st) counts.new_inquiry++;
      else if (st === 'qualified') counts.qualified++;
      else if (st === 'quoted') counts.quoted++;
      else if (st === 'negotiation') counts.negotiation++;
      else if (st === 'won') counts.won++;
      else if (st === 'lost') counts.lost++;
    });
    return counts;
  }, [filteredDeals]);

  const board = useMemo(() => {
    const stages = ['new_inquiry', 'qualified', 'quoted', 'negotiation'];
    return stages.reduce((acc, st) => {
      acc[st] = filteredDeals.filter((d: any) => {
        const dealStage = (d.stage || 'new_inquiry').toLowerCase().trim();
        if (st === 'new_inquiry') {
          return dealStage === 'new_inquiry' || dealStage === 'review' || !dealStage;
        }
        return dealStage === st;
      });
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredDeals]);

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {DEFAULT_STAGES.map(s => (
        <div key={s.key} className={`rounded-xl border-2 ${s.color} p-3`}>
          <div className="animate-pulse mb-3">
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-red-600 p-4">
      <AlertCircle size={20} />
      <span>Failed to load pipeline</span>
    </div>
  );

  return (
    <div>
      {/* Header with Dynamic Stage Counters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-center">
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{stageCounts.new_inquiry}</p>
            <p className="text-[10px] text-gray-500 capitalize">New Inquiry</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{stageCounts.qualified}</p>
            <p className="text-[10px] text-gray-500 capitalize">Qualified</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{stageCounts.quoted}</p>
            <p className="text-[10px] text-gray-500 capitalize">Quoted</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{stageCounts.negotiation}</p>
            <p className="text-[10px] text-gray-500 capitalize">Negotiation</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{stageCounts.won}</p>
            <p className="text-[10px] text-gray-500 capitalize">Won</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{stageCounts.lost}</p>
            <p className="text-[10px] text-gray-500 capitalize">Lost</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* 1. Search Bar with Clear (X) Icon */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search Customer, Items, Date..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title="Clear Search">
                <X size={14} />
              </button>
            )}
          </div>

          {/* 2. Unified Date Range Filter */}
          <DateFilterControl onChange={setDateRange} value={dateRange} initialPreset="30_days" />

          {/* 3. Clear Filter Button */}
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold transition-colors shadow-2xs">
            Clear Filter
          </button>
        </div>

        {/* 4. Refresh Button */}
        <button
          type="button"
          onClick={() => {
            fetchDeals();
            toast.success('Pipeline refreshed');
          }}
          title="Refresh Pipeline"
          className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-2xs flex items-center justify-center cursor-pointer">
          <RefreshCw size={15} className={isFetching ? 'animate-spin text-blue-600' : ''} />
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEFAULT_STAGES.map(({ key, label, color }) => (
          <div key={key} className={`rounded-xl border-2 ${color} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 text-sm">{label}</h3>
              <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full border">
                {board[key]?.length || 0}
              </span>
            </div>
            <div className="space-y-2">
              {(board[key] || []).map((deal: any) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onStageChange={handleStageChange}
                  onSelect={setSelectedDealId}
                  onDelete={setConfirmDeleteDeal}
                />
              ))}
              {(!board[key] || board[key].length === 0) && (
                <div className="text-center py-6 text-gray-400 text-sm">No deals</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Loss Modal */}
      {lostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Mark as Lost</h3>
            <p className="text-sm text-gray-500 mb-4">Please select a reason (required)</p>
            <div className="space-y-2 mb-4">
              {LOST_REASONS.map(reason => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="reason" value={reason}
                    checked={lostModal.reason === reason}
                    onChange={() => setLostModal(prev => prev ? { ...prev, reason } : null)}
                    className="text-blue-600" />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setLostModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                disabled={!lostModal.reason}
                onClick={() => stageMutation.mutate({ id: lostModal.dealId, stage: 'lost', reason: lostModal.reason })}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Deal Confirmation Modal */}
      {confirmDeleteDeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Deal Permanently?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 mb-5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900">{confirmDeleteDeal.customer_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Deal Ref:</span>
                <span className="font-mono font-bold text-indigo-600">
                  #{confirmDeleteDeal.deal_number || (confirmDeleteDeal.id ? `DEAL-${confirmDeleteDeal.id.substring(0, 6).toUpperCase()}` : 'DEAL')}
                </span>
              </div>
              {confirmDeleteDeal.total_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Deal Amount:</span>
                  <span className="font-bold text-emerald-600">₹{Number(confirmDeleteDeal.total_amount).toLocaleString('en-IN')}</span>
                </div>
              )}
              <p className="text-[11px] text-red-600 pt-2 border-t border-slate-200">
                 All line items, payment tracking records, and KRA logs tied to this deal will be permanently removed from the database and dashboard.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteDeal(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDeleteDeal.id)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete Deal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal Detail Drawer */}
      <DealDetailDrawer
        dealId={selectedDealId}
        onClose={() => setSelectedDealId(null)}
      />
    </div>
  );
}
