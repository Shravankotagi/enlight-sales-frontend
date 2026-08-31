import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Hash, Package, FileText } from 'lucide-react';

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
  value: string;
  onChange: (val: string) => void;
  onSelectDeal: (deal: DealOption | null, specificProduct?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export default function DealProductCombobox({
  deals = [],
  value,
  onChange,
  onSelectDeal,
  placeholder = 'Type or select Deal ID, PO Number, Product...',
  disabled = false,
  loading = false,
  className = '',
}: DealProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Flatten deals and their items into searchable selectable entries
  const flattenedOptions = useMemo(() => {
    const list: Array<{
      key: string;
      deal: DealOption | null;
      dealCode: string;
      poNumber: string;
      productSummary: string;
      fullLabel: string;
      stage?: string;
      isUnlinked?: boolean;
    }> = [];

    // Option 1: Unlinked
    list.push({
      key: 'unlinked-direct',
      deal: null,
      dealCode: '',
      poNumber: '',
      productSummary: '',
      fullLabel: '-- Unlinked / Direct Complaint (No Deal Linked) --',
      isUnlinked: true,
    });

    deals.forEach(deal => {
      const dealCode = `#DEAL-${deal.id.substring(0, 6).toUpperCase()}`;
      const poStr = deal.po_number ? ` (PO: ${deal.po_number})` : '';
      const items = Array.isArray(deal.deal_items) && deal.deal_items.length > 0 ? deal.deal_items : [];

      if (items.length === 0) {
        list.push({
          key: `${deal.id}-deal`,
          deal,
          dealCode,
          poNumber: deal.po_number || '',
          productSummary: 'General Material',
          fullLabel: `${dealCode}${poStr} — General Material`,
          stage: deal.stage,
        });
      } else {
        items.forEach((it, idx) => {
          const itemSummary = `${it.sku_text || ''} ${it.dimensions || ''} ${it.quantity ? `${it.quantity} ${it.unit || 'MT'}` : ''}`.trim();
          list.push({
            key: `${deal.id}-item-${idx}`,
            deal,
            dealCode,
            poNumber: deal.po_number || '',
            productSummary: itemSummary || 'General Material',
            fullLabel: `${dealCode}${poStr} — ${itemSummary || 'General Material'}`,
            stage: deal.stage,
          });
        });
      }
    });

    return list;
  }, [deals]);

  const query = (value || '').trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!query) return flattenedOptions;
    return flattenedOptions.filter(opt => {
      if (opt.isUnlinked) return 'unlinked direct complaint'.includes(query);
      const code = opt.dealCode.toLowerCase();
      const rawCode = opt.dealCode.replace(/[^a-z0-9]/gi, '').toLowerCase();
      const po = opt.poNumber.toLowerCase();
      const prod = opt.productSummary.toLowerCase();
      const label = opt.fullLabel.toLowerCase();
      return code.includes(query) || rawCode.includes(query) || po.includes(query) || prod.includes(query) || label.includes(query);
    });
  }, [flattenedOptions, query]);

  const handleSelect = (option: typeof flattenedOptions[0]) => {
    if (option.isUnlinked || !option.deal) {
      onChange('');
      onSelectDeal(null, '');
    } else {
      onChange(option.fullLabel);
      onSelectDeal(option.deal, option.productSummary);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Hash size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          disabled={disabled || loading}
          autoComplete="off"
          placeholder={loading ? 'Loading deals...' : placeholder}
          value={value}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          className={`w-full pl-8.5 pr-14 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium placeholder:text-slate-400 bg-white transition-all ${
            disabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : ''
          }`}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              onSelectDeal(null, '');
              inputRef.current?.focus();
            }}
            className="absolute right-7 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
            <X size={13} />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || loading}
          onClick={() => {
            if (!disabled && !loading) {
              setIsOpen(prev => !prev);
              inputRef.current?.focus();
            }
          }}
          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </button>
      </div>

      {/* Dropdown Options List */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-400">
              No matching deals or products found.
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.key}
                onClick={() => handleSelect(opt)}
                className="px-3.5 py-2.5 hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between gap-2 group text-xs">
                <div className="flex items-center gap-2 truncate min-w-0">
                  {opt.isUnlinked ? (
                    <FileText size={14} className="text-slate-400 shrink-0" />
                  ) : (
                    <Package size={14} className="text-blue-500 shrink-0" />
                  )}
                  <div className="truncate min-w-0">
                    {opt.isUnlinked ? (
                      <span className="text-slate-600 font-medium">{opt.fullLabel}</span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap truncate">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded text-[10px]">
                          {opt.dealCode}
                        </span>
                        {opt.poNumber && (
                          <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[10px]">
                            PO: {opt.poNumber}
                          </span>
                        )}
                        <span className="font-semibold text-slate-900 truncate">
                          {opt.productSummary}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {opt.stage && (
                  <span className="capitalize text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {opt.stage}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
