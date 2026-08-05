import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi, pricingApi } from '../lib/api';
import { useEffect, useState } from 'react';
import {
  X, FileText,
  Package, IndianRupee, Clock,
  ChevronRight, AlertCircle, Printer
} from 'lucide-react';


import toast from 'react-hot-toast';

interface DealDetailDrawerProps {
  dealId: string | null;
  onClose: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  new_inquiry: 'bg-blue-100 text-blue-700',
  qualified: 'bg-purple-100 text-purple-700',
  quoted: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

const LOST_REASONS = [
  'Price', 'Credit terms', 'Delivery timeline',
  'Material unavailable', 'Spec mismatch',
  'Competitor relationship', 'Customer silent', 'Cancelled by customer',
];

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

export default function DealDetailDrawer({ dealId, onClose }: DealDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [lostReason, setLostReason] = useState('');
  const [showLostModal, setShowLostModal] = useState(false);
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [quotedPrices, setQuotedPrices] = useState<Record<string, number>>({});
  const [marginChecks, setMarginChecks] = useState<Record<string, any>>({});

  const { data: dealData, isLoading } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsApi.getOne(dealId!).then(r => r.data.data),
    enabled: !!dealId,
  });

  const deal = dealData;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const stageMutation = useMutation({
    mutationFn: ({ stage, reason }: { stage: string; reason?: string }) =>
      dealsApi.updateStage(dealId!, stage, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      toast.success('Deal stage updated');
      setShowLostModal(false);
      onClose();
    },
    onError: () => toast.error('Failed to update stage'),
  });

  const handleStageChange = (stage: string) => {
    if (stage === 'lost') {
      setShowLostModal(true);
    } else {
      stageMutation.mutate({ stage });
    }
  };

  const handleCheckMargin = async (itemId: string, skuText: string, quotedPrice: number) => {
    if (!quotedPrice) return;
    try {
      const res = await pricingApi.checkMargin(skuText, quotedPrice, quotedPrice * 0.95);
      setMarginChecks(prev => ({ ...prev, [itemId]: res.data }));
    } catch {
      // silent
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!dealId) return null;

  const totalAmount = deal?.deal_items?.reduce(
    (sum: number, item: any) => sum + ((item.quoted_price || item.price_per_mt || item.rate || 0) * (item.quantity || 0)),
    0
  ) || deal?.total_amount || 0;

  const gst = totalAmount * 0.18;
  const grandTotal = totalAmount + gst;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-32" />
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 truncate">
                  {deal?.customer_name || 'Unknown Customer'}
                </h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STAGE_COLORS[deal?.stage] || 'bg-gray-100 text-gray-600'}`}>
                    {deal?.stage?.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
                    {deal?.inquiry_type === 'purchase_order' ? 'PO' : 'Inquiry'}
                  </span>
                  {deal?.po_number && (
                    <span className="text-xs text-gray-500">PO: {deal.po_number}</span>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-1" />
                  <div className="h-4 bg-gray-200 rounded w-48" />
                </div>
              ))}
            </div>
          ) : deal ? (
            <div className="p-6 space-y-6">
              {/* Deal Info Grid */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Deal Information
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
                  <InfoRow label="Phone" value={deal.customer_phone} />
                  <InfoRow label="GST" value={deal.customer_gst} />
                  <InfoRow label="Delivery Location" value={deal.delivery_location} />
                  <InfoRow label="Delivery Date" value={deal.delivery_date
                    ? new Date(deal.delivery_date).toLocaleDateString('en-IN') : null} />
                  <InfoRow label="Payment Terms" value={deal.payment_terms} />
                  <InfoRow label="PO Date" value={deal.po_date
                    ? new Date(deal.po_date).toLocaleDateString('en-IN') : null} />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package size={14} /> Line Items
                </h3>
                {deal.deal_items && deal.deal_items.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          {['SKU', 'Grade', 'Qty', 'Unit', 'Rate', 'Amount'].map(h => (
                            <th key={h} className="text-left text-xs font-semibold text-gray-500 px-3 py-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deal.deal_items.map((item: any, i: number) => {
                          const rate = item.quoted_price || item.price_per_mt || item.rate || 0;
                          const amount = item.amount ? Number(item.amount) : rate * (item.quantity || 0);
                          return (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-800 text-xs font-medium max-w-[100px] truncate">
                                {item.sku_text}
                              </td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{item.grade || '-'}</td>
                              <td className="px-3 py-2 text-gray-800 text-xs font-semibold">{item.quantity}</td>
                              <td className="px-3 py-2 text-gray-600 text-xs">{item.unit}</td>
                              <td className="px-3 py-2 text-gray-800 text-xs">
                                {rate > 0 ? `₹${Number(rate).toLocaleString('en-IN')}` : '-'}
                              </td>
                              <td className="px-3 py-2 text-gray-800 text-xs font-semibold">
                                {amount > 0 ? `₹${Number(amount).toLocaleString('en-IN')}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-700 text-right">
                            Total
                          </td>
                          <td className="px-3 py-2 text-sm font-bold text-gray-900">
                            ₹{Number(totalAmount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="border rounded-xl p-4 text-center text-gray-400 text-sm">
                    No items extracted
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <IndianRupee size={14} /> Financial Summary
                </h3>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">₹{Number(totalAmount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (18%)</span>
                    <span className="font-medium">₹{Number(gst).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-2">
                    <span className="text-gray-800">Grand Total</span>
                    <span className="text-blue-700">₹{Number(grandTotal).toLocaleString('en-IN')}</span>
                  </div>
                  {deal.overall_confidence != null && (
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-gray-500">AI Confidence</span>
                      <span className={`font-semibold px-2 py-0.5 rounded-full text-xs
                        ${deal.overall_confidence >= 0.85
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'}`}>
                        {Math.round(deal.overall_confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock size={14} /> Activity Timeline
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Deal Created</p>
                      <p className="text-xs text-gray-400">
                        {new Date(deal.created_at).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                      ${deal.stage === 'won' ? 'bg-green-400'
                        : deal.stage === 'lost' ? 'bg-red-400'
                        : 'bg-purple-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-800 capitalize">
                        Stage: {deal.stage?.replace('_', ' ')}
                      </p>
                      {deal.stage === 'lost' && deal.lost_reason && (
                        <p className="text-xs text-red-500 mt-0.5">
                          Reason: {deal.lost_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quote Builder Toggle */}
              {deal.deal_items && deal.deal_items.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowQuoteBuilder(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText size={16} /> Quote Builder
                    </span>
                    <ChevronRight size={16} className={`transition-transform ${showQuoteBuilder ? 'rotate-90' : ''}`} />
                  </button>

                  {showQuoteBuilder && (
                    <div className="mt-3 border rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-700">Quoted Prices</h4>
                        <button
                          onClick={handlePrint}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          <Printer size={14} /> Print Quote
                        </button>
                      </div>

                      {/* Print-only letterhead */}
                      <div className="hidden print:block p-6">
                        <h1 className="text-2xl font-bold text-gray-900">Enlight Metals Private Limited</h1>
                        <p className="text-sm text-gray-500">Quote for {deal.customer_name}</p>
                        <p className="text-sm text-gray-500">Date: {new Date().toLocaleDateString('en-IN')}</p>
                        <hr className="my-4" />
                      </div>

                      <div className="p-3 space-y-3">
                        {deal.deal_items.map((item: any, i: number) => {
                          const itemKey = item.id || `item-${i}`;
                          const margin = marginChecks[itemKey];
                          return (
                            <div key={itemKey} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{item.sku_text}</p>
                                <p className="text-xs text-gray-500">{item.quantity} {item.unit}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                  <input
                                    type="number"
                                    placeholder="Rate"
                                    value={quotedPrices[itemKey] || ''}
                                    onChange={e => {
                                      const val = parseFloat(e.target.value);
                                      setQuotedPrices(prev => ({ ...prev, [itemKey]: val }));
                                      if (val) handleCheckMargin(itemKey, item.sku_text, val);
                                    }}
                                    className="w-28 pl-5 pr-2 py-1.5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  />
                                </div>
                                {margin && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                                    ${margin.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {margin.margin_pct?.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Quote totals */}
                        <div className="border-t pt-3 space-y-1">
                          {(() => {
                            const qTotal = deal.deal_items.reduce((sum: number, item: any, i: number) => {
                              const key = item.id || `item-${i}`;
                              return sum + ((quotedPrices[key] || 0) * (item.quantity || 0));
                            }, 0);
                            const qGst = qTotal * 0.18;
                            return (
                              <>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Subtotal</span>
                                  <span>₹{Number(qTotal).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">GST 18%</span>
                                  <span>₹{Number(qGst).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold">
                                  <span>Grand Total</span>
                                  <span className="text-blue-700">₹{Number(qTotal + qGst).toLocaleString('en-IN')}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <AlertCircle size={32} className="mb-2" />
              <p>Deal not found</p>
            </div>
          )}
        </div>

        {/* Quick Actions Footer */}
        {deal && deal.stage !== 'won' && deal.stage !== 'lost' && (
          <div className="border-t px-6 py-4 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              {deal.stage === 'new_inquiry' && (
                <button
                  onClick={() => handleStageChange('qualified')}
                  className="px-3 py-1.5 text-xs font-medium border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  → Qualified
                </button>
              )}
              {deal.stage === 'qualified' && (
                <button
                  onClick={() => handleStageChange('quoted')}
                  className="px-3 py-1.5 text-xs font-medium border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 transition-colors"
                >
                  → Quoted
                </button>
              )}
              {deal.stage === 'quoted' && (
                <button
                  onClick={() => handleStageChange('negotiation')}
                  className="px-3 py-1.5 text-xs font-medium border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  → Negotiation
                </button>
              )}
              <button
                onClick={() => handleStageChange('won')}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                ✓ Won
              </button>
              <button
                onClick={() => setShowLostModal(true)}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ✗ Lost
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loss Modal */}
      {showLostModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Mark as Lost</h3>
            <p className="text-sm text-gray-500 mb-4">Please select a reason (required)</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {LOST_REASONS.map(reason => (
                <label key={reason} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                  <input
                    type="radio"
                    name="lost_reason"
                    value={reason}
                    checked={lostReason === reason}
                    onChange={() => setLostReason(reason)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowLostModal(false); setLostReason(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!lostReason || stageMutation.isPending}
                onClick={() => stageMutation.mutate({ stage: 'lost', reason: lostReason })}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
