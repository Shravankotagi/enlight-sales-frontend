import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Hash, Package, FileText, Check } from 'lucide-react';

export interface DealItem {
  sku_text?: string;
  dimensions?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  amount?: number;
}

export interface DealOption {
  id: string;
  deal_number?: string;
  po_number?: string | null;
  stage?: string;
  customer_name?: string;
  total_amount?: number;
  deal_items?: DealItem[];
  created_at?: string;
}

interface DealProductComboboxProps {
  deals: DealOption[];
  selectedDealId: string;
  selectedPoNumber?: string;
  selectedProduct?: string;
  onSelectDeal: (deal: DealOption | null, specificProduct?: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

export default function DealProductCombobox({
  deals = [],
  selectedDealId,
  selectedProduct,
  onSelectDeal,
  loading = false,
  disabled = false,
}: DealProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedDeal = useMemo(() => {
    return deals.find(d => d.id === selectedDealId);
  }, [deals, selectedDealId]);

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals;
    const q = searchQuery.toLowerCase().trim();

    return deals.filter(deal => {
      const dealCode = (deal.id ? `DEAL-${deal.id.substring(0, 6)}` : '').toLowerCase();
      const poNum = (deal.po_number || '').toLowerCase();
      const cust = (deal.customer_name || '').toLowerCase();
      const itemsMatch = Array.isArray(deal.deal_items) && deal.deal_items.some(it => {
        const sku = (it.sku_text || '').toLowerCase();
        const dims = (it.dimensions || '').toLowerCase();
        const qty = `${it.quantity || ''} ${it.unit || ''}`.toLowerCase();
        return sku.includes(q) || dims.includes(q) || qty.includes(q);
      });

      return dealCode.includes(q) || poNum.includes(q) || cust.includes(q) || itemsMatch;
    });
  }, [deals, searchQuery]);

  const handleSelect = (deal: DealOption | null, product?: string) => {
    onSelectDeal(deal, product);
    setIsOpen(false);
    setSearchQuery('');
  };

  const displayLabel = useMemo(() => {
    if (!selectedDealId) {
      return '-- Select Specific Deal / PO & Product --';
    }
    if (selectedDeal) {
      const dealCode = `#DEAL-${selectedDeal.id.substring(0, 6).toUpperCase()}`;
      const poStr = selectedDeal.po_number ? ` (PO: ${selectedDeal.po_number})` : '';
      const prodStr = selectedProduct ? ` — ${selectedProduct}` : '';
      return `${dealCode}${poStr}${prodStr}`;
    }
    return `#DEAL-${selectedDealId.substring(0, 6).toUpperCase()}`;
  }, [selectedDealId, selectedDeal, selectedProduct]);

  return (
    <div ref={containerRef} className="relative w-full text-xs font-sans">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between pl-3 pr-2.5 py-2 border rounded-xl bg-white text-left font-medium transition-all cursor-pointer ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}>
        <div className="flex items-center gap-2 truncate pr-2">
          <Hash size={14} className={selectedDealId ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />
          <span className={`truncate ${selectedDealId ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
            {loading ? 'Loading deals...' : displayLabel}
          </span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-72">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Deal ID, PO Number, Product, Grade..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="overflow-y-auto flex-1 p-1.5 space-y-1">
            {/* Unlinked Option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                !selectedDealId ? 'bg-blue-50 text-blue-800 font-semibold' : 'hover:bg-slate-50 text-slate-700'
              }`}>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-slate-400 shrink-0" />
                <span>-- Unlinked / Direct Complaint (No Deal Linked) --</span>
              </div>
              {!selectedDealId && <Check size={14} className="text-blue-600" />}
            </button>

            {filteredDeals.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                <Package size={22} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-medium text-slate-500">No matching deals or products found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a different keyword</p>
              </div>
            ) : (
              filteredDeals.map(deal => {
                const dealCode = `#DEAL-${deal.id.substring(0, 6).toUpperCase()}`;
                const isDealSelected = selectedDealId === deal.id;
                const items = Array.isArray(deal.deal_items) ? deal.deal_items : [];

                return (
                  <div
                    key={deal.id}
                    className={`rounded-xl border transition-all p-2.5 space-y-1.5 ${
                      isDealSelected
                        ? 'border-blue-300 bg-blue-50/40'
                        : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/60'
                    }`}>
                    {/* Deal Header Row */}
                    <div
                      onClick={() => handleSelect(deal)}
                      className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                          {dealCode}
                        </span>
                        {deal.po_number && (
                          <span className="font-mono text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                            PO: {deal.po_number}
                          </span>
                        )}
                        {deal.stage && (
                          <span className="capitalize text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {deal.stage}
                          </span>
                        )}
                      </div>
                      {isDealSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                    </div>

                    {/* Products List under this deal */}
                    {items.length > 0 && (
                      <div className="pt-1 space-y-1 pl-2 border-l-2 border-slate-200">
                        {items.map((item, iIdx) => {
                          const itemSummary = `${item.sku_text || ''} ${item.dimensions || ''} ${item.quantity ? `${item.quantity} ${item.unit || 'MT'}` : ''}`.trim();
                          const isProductActive = isDealSelected && selectedProduct === itemSummary;

                          return (
                            <button
                              key={iIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(deal, itemSummary);
                              }}
                              className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                isProductActive
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                              }`}>
                              <span className="flex items-center gap-1.5 truncate">
                                <Package size={11} className={isProductActive ? 'text-white' : 'text-slate-400'} />
                                <span className="truncate">{itemSummary}</span>
                              </span>
                              <span className="text-[10px] opacity-75 shrink-0 ml-2">Click to select</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
