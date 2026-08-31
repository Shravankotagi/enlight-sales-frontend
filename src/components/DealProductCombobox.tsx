import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Hash, Package, Check, AlertCircle } from 'lucide-react';

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

export interface SelectedDealItem {
  dealId: string;
  dealCode: string;
  poNumber?: string;
  product: string;
  fullLabel: string;
}

interface DealProductComboboxProps {
  deals: DealOption[];
  selectedItems: SelectedDealItem[];
  onChange: (items: SelectedDealItem[]) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  error?: boolean;
  className?: string;
}

export default function DealProductCombobox({
  deals = [],
  selectedItems = [],
  onChange,
  placeholder = 'Type to search or select Won Deal ID, PO Number, Product...',
  disabled = false,
  loading = false,
  error = false,
  className = '',
}: DealProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter ONLY Won deals
  const wonDeals = useMemo(() => {
    return deals.filter(d => (d.stage || '').toLowerCase() === 'won');
  }, [deals]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Build selectable items for won deals
  const flattenedOptions = useMemo(() => {
    const list: Array<{
      key: string;
      dealId: string;
      dealCode: string;
      poNumber: string;
      product: string;
      fullLabel: string;
    }> = [];

    wonDeals.forEach(deal => {
      const cleanId = deal.id.startsWith('DEAL-') ? deal.id.replace(/^DEAL-/, '') : deal.id.substring(0, 6).toUpperCase();
      const dealCode = `#DEAL-${cleanId}`;
      const poStr = deal.po_number ? ` (PO: ${deal.po_number})` : '';
      const items = Array.isArray(deal.deal_items) && deal.deal_items.length > 0 ? deal.deal_items : [];

      if (items.length === 0) {
        list.push({
          key: `${deal.id}-general`,
          dealId: deal.id,
          dealCode,
          poNumber: deal.po_number || '',
          product: 'General Material',
          fullLabel: `${dealCode}${poStr} — General Material`,
        });
      } else {
        items.forEach((it, idx) => {
          const itemSummary = `${it.sku_text || ''} ${it.dimensions || ''} ${it.quantity ? `${it.quantity} ${it.unit || 'MT'}` : ''}`.trim() || 'Steel Material';
          list.push({
            key: `${deal.id}-item-${idx}`,
            dealId: deal.id,
            dealCode,
            poNumber: deal.po_number || '',
            product: itemSummary,
            fullLabel: `${dealCode}${poStr} — ${itemSummary}`,
          });
        });
      }
    });

    return list;
  }, [wonDeals]);

  const query = searchQuery.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!query) return flattenedOptions;
    return flattenedOptions.filter(opt => {
      const code = opt.dealCode.toLowerCase();
      const rawCode = opt.dealCode.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const po = opt.poNumber.toLowerCase();
      const prod = opt.product.toLowerCase();
      const label = opt.fullLabel.toLowerCase();
      return code.includes(query) || rawCode.includes(query) || po.includes(query) || prod.includes(query) || label.includes(query);
    });
  }, [flattenedOptions, query]);

  const isItemSelected = (key: string) => {
    return selectedItems.some(it => {
      const itKey = `${it.dealId}-${it.product}`;
      return itKey === key;
    });
  };

  const toggleItem = (opt: typeof flattenedOptions[0]) => {
    const itKey = `${opt.dealId}-${opt.product}`;
    const exists = selectedItems.some(it => `${it.dealId}-${it.product}` === itKey);

    if (exists) {
      onChange(selectedItems.filter(it => `${it.dealId}-${it.product}` !== itKey));
    } else {
      onChange([
        ...selectedItems,
        {
          dealId: opt.dealId,
          dealCode: opt.dealCode,
          poNumber: opt.poNumber,
          product: opt.product,
          fullLabel: opt.fullLabel,
        },
      ]);
    }
    setSearchQuery('');
  };

  const removeItem = (dealId: string, product: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedItems.filter(it => !(it.dealId === dealId && it.product === product)));
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Combobox Multi-Select Box */}
      <div
        onClick={() => {
          if (!disabled && !loading) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`min-h-[38px] w-full p-1.5 pl-2.5 pr-8 border rounded-xl bg-white flex flex-wrap items-center gap-1.5 cursor-pointer transition-all ${
          error ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/20' : isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : ''}`}>
        
        <Hash size={13} className="text-slate-400 shrink-0 mr-0.5" />

        {/* Selected Chips */}
        {selectedItems.map((item, idx) => (
          <span
            key={`${item.dealId}-${item.product}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold animate-in fade-in zoom-in-95">
            <span className="font-mono text-blue-700">{item.dealCode}</span>
            {item.poNumber && <span className="text-slate-600 font-mono text-[10px]">({item.poNumber})</span>}
            <span className="text-slate-700 font-medium truncate max-w-[150px]">{item.product}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => removeItem(item.dealId, item.product, e)}
                className="p-0.5 text-blue-600 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer ml-0.5">
                <X size={11} />
              </button>
            )}
          </span>
        ))}

        {/* Search Input inside Combobox */}
        <input
          ref={inputRef}
          type="text"
          disabled={disabled || loading}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedItems.length === 0 ? (loading ? 'Loading won orders...' : placeholder) : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs font-medium text-slate-800 placeholder:text-slate-400 py-0.5"
        />

        {/* Dropdown Chevron */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || loading}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && !loading) {
              setIsOpen(prev => !prev);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          {wonDeals.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-slate-500">
              <AlertCircle size={20} className="mx-auto text-amber-500 mb-1" />
              <p className="font-semibold text-slate-700">No Won Orders Found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Complaints can only be logged for won orders / POs.</p>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-400">
              No matching products or Deal IDs found.
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const selected = isItemSelected(`${opt.dealId}-${opt.product}`);
              return (
                <div
                  key={opt.key}
                  onClick={() => toggleItem(opt)}
                  className={`px-3.5 py-2 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between gap-2.5 text-xs ${
                    selected ? 'bg-blue-50/50' : ''
                  }`}>
                  <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center transition-all shrink-0 ${
                        selected
                          ? 'bg-blue-600 border border-blue-600 text-white shadow-2xs'
                          : 'border border-slate-300 bg-white hover:border-slate-400'
                      }`}>
                      {selected && <Check size={11} strokeWidth={3} />}
                    </div>

                    <Package size={14} className={selected ? 'text-blue-600 shrink-0' : 'text-slate-400 shrink-0'} />

                    {/* Deal & Product details */}
                    <div className="truncate min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded text-[10px]">
                        {opt.dealCode}
                      </span>
                      {opt.poNumber && (
                        <span className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded text-[10px]">
                          PO: {opt.poNumber}
                        </span>
                      )}
                      <span className={`truncate font-medium ${selected ? 'text-blue-900 font-bold' : 'text-slate-800'}`}>
                        {opt.product}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    Won
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
