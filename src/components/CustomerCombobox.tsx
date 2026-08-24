import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Building2, Plus } from 'lucide-react';

export interface CustomerDirectoryItem {
  id?: string;
  customer_name: string;
  contact_person?: string;
  contact_phone?: string;
  location?: string;
}

interface CustomerComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer?: (customer: CustomerDirectoryItem) => void;
  customers: CustomerDirectoryItem[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function CustomerCombobox({
  value,
  onChange,
  onSelectCustomer,
  customers = [],
  placeholder = 'e.g. Vardhman Steels',
  required = false,
  disabled = false,
  className = '',
}: CustomerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter customers matching query
  const query = (value || '').trim().toLowerCase();
  const filteredCustomers = customers.filter(c => {
    if (!query) return true;
    const name = (c.customer_name || '').toLowerCase();
    const contact = (c.contact_person || '').toLowerCase();
    const phone = (c.contact_phone || '').toLowerCase();
    const loc = (c.location || '').toLowerCase();
    return name.includes(query) || contact.includes(query) || phone.includes(query) || loc.includes(query);
  });

  const hasExactMatch = customers.some(
    c => (c.customer_name || '').trim().toLowerCase() === query
  );

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

  const handleSelect = (customer: CustomerDirectoryItem) => {
    onChange(customer.customer_name);
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredCustomers.length) {
        e.preventDefault();
        handleSelect(filteredCustomers[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          required={required}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-3 pr-16 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-800 disabled:bg-slate-100 placeholder:text-slate-400"
        />

        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={e => {
                e.preventDefault();
                onChange('');
                setIsOpen(true);
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              title="Clear input"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={e => {
              e.preventDefault();
              setIsOpen(prev => !prev);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            title="Toggle customer list"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in-50 duration-100">
          {/* If typing a new name not in existing list, show "Add new" hint at top */}
          {value.trim() && !hasExactMatch && (
            <div
              onClick={() => {
                setIsOpen(false);
              }}
              className="p-2.5 bg-blue-50/60 hover:bg-blue-50 cursor-pointer text-xs font-semibold text-blue-700 flex items-center gap-2 border-b border-blue-100"
            >
              <Plus size={14} className="text-blue-600" />
              <span>Use new company: &quot;<strong>{value.trim()}</strong>&quot;</span>
            </div>
          )}

          {filteredCustomers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 space-y-1">
              <Building2 size={24} className="mx-auto text-slate-300 mb-1" />
              <p className="font-medium text-slate-600">No matching pre-existing customers</p>
              <p className="text-slate-400">You can continue typing to log this as a new customer.</p>
            </div>
          ) : (
            filteredCustomers.map((cust, idx) => {
              const isSelected = cust.customer_name.toLowerCase() === query;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={cust.id || `${cust.customer_name}-${idx}`}
                  onClick={() => handleSelect(cust)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2.5 cursor-pointer text-left transition-colors flex items-center justify-between text-xs font-medium ${
                    isHighlighted
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : isSelected
                      ? 'bg-slate-50 text-slate-900 font-semibold'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Building2 size={14} className="text-blue-600 shrink-0" />
                    <span className="truncate">{cust.customer_name}</span>
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
