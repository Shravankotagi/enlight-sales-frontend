import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  value?: string | number;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
  options?: SelectOption[];
  placeholder?: string;
  name?: string;
  prefixIcon?: React.ReactNode;
  menuClassName?: string;
  wrapperClassName?: string;
  children?: React.ReactNode;
  required?: boolean;
  hideChevron?: boolean;
  chevronClassName?: string;
}

const MENU_WANT = 240;

/** Open down unless the list would leave the popup, then open up. */
export function selectMenuPlacement(below: number, above: number, want = MENU_WANT) {
  const dropUp = below < want && above > below;
  const room = (dropUp ? above : below) - 12;
  return { dropUp, maxHeight: Math.max(96, Math.min(want, room)) };
}

function clipSpace(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  let below = window.innerHeight - rect.bottom;
  let above = rect.top;
  let node = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') {
      const box = node.getBoundingClientRect();
      below = Math.min(below, box.bottom - rect.bottom);
      above = Math.min(above, rect.top - box.top);
      break;
    }
    node = node.parentElement;
  }
  return selectMenuPlacement(below, above);
}

function extractOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (React.isValidElement(child)) {
      if (child.type === 'option') {
        const props = child.props as {
          value?: string | number;
          children?: React.ReactNode;
          disabled?: boolean;
        };
        options.push({
          value: props.value !== undefined ? props.value : (typeof props.children === 'string' ? props.children : ''),
          label: props.children,
          disabled: props.disabled,
        });
      } else if (child.props && (child.props as any).children) {
        options.push(...extractOptions((child.props as any).children));
      }
    }
  });
  return options;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value = '',
      onChange,
      options: propOptions,
      placeholder = 'Select option...',
      name,
      prefixIcon,
      className = '',
      menuClassName = '',
      wrapperClassName = '',
      disabled = false,
      required = false,
      hideChevron = false,
      chevronClassName = '',
      children,
      ...rest
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const [dropUp, setDropUp] = useState(false);
    const [menuMax, setMenuMax] = useState(MENU_WANT);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const hiddenSelectRef = useRef<HTMLSelectElement>(null);

    // Extract options from either props or <option> children
    const options: SelectOption[] = propOptions ? [...propOptions] : extractOptions(children);

    // Keep hidden select value in sync with prop value
    useEffect(() => {
      if (hiddenSelectRef.current && value !== undefined) {
        hiddenSelectRef.current.value = String(value);
      }
    }, [value]);

    // Outside click listener
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
      if (open) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [open]);

    // Keyboard navigation (Escape to close)
    useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if (!open) return;
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [open]);

    // Find current active option
    const activeOption = options.find((opt) => String(opt.value) === String(value));

    // Handle selection and dispatch synthetic change event matching native select
    const handleSelect = (optValue: string | number) => {
      const stringValue = String(optValue);
      if (hiddenSelectRef.current) {
        hiddenSelectRef.current.value = stringValue;
      }
      if (onChange) {
        onChange({
          target: {
            value: stringValue,
            name: name || '',
          },
        });
      }
      setOpen(false);
    };

    // Determine display label
    let displayLabel: React.ReactNode = placeholder;
    if (activeOption) {
      displayLabel = activeOption.label;
    } else if (options.length > 0 && (value === '' || value === undefined)) {
      // If the first option has empty value (like "Select..."), display it
      const emptyOpt = options.find((opt) => String(opt.value) === '');
      if (emptyOpt) {
        displayLabel = emptyOpt.label;
      }
    }

    const { id, ...buttonRest } = rest;

    return (
      <div ref={containerRef} className={`relative inline-block ${wrapperClassName || 'w-full'}`}>
        <select
          ref={hiddenSelectRef}
          tabIndex={-1}
          value={value !== undefined ? String(value) : ''}
          name={name}
          id={id}
          required={required}
          onChange={(e) => {
            if (onChange) {
              onChange({
                target: {
                  value: e.target.value,
                  name: e.target.name || name || '',
                },
              });
            }
          }}
          className="sr-only"
          disabled={disabled}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
            pointerEvents: 'none',
          }}
        >
          {options.map((opt, idx) => (
            <option key={`${opt.value}-${idx}`} value={opt.value} disabled={opt.disabled}>
              {typeof opt.label === 'string' || typeof opt.label === 'number'
                ? opt.label
                : String(opt.value)}
            </option>
          ))}
        </select>
        <button
          ref={ref}
          id={id ? `${id}-btn` : undefined}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (!open && containerRef.current) {
              const place = clipSpace(containerRef.current);
              setDropUp(place.dropUp);
              setMenuMax(place.maxHeight);
            }
            setOpen(!open);
          }}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`w-full flex items-center justify-between text-left transition-all select-none ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${className}`}
          {...buttonRest}
        >
          <div className="flex items-center gap-2 truncate min-w-0 mr-1">
            {prefixIcon && <span className="shrink-0">{prefixIcon}</span>}
            <span className="truncate">{displayLabel}</span>
          </div>
          {!hideChevron && (
            <ChevronDown
              className={chevronClassName || `h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        {open && (
          <div
            ref={listRef}
            role="listbox"
            className={`absolute left-0 z-[100] min-w-full w-max max-w-sm max-sm:max-w-[calc(100vw-2rem)] bg-white border border-slate-200/90 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${menuClassName}`}
          >
            <div
              style={{ maxHeight: menuMax }}
              className="overflow-y-auto p-1 space-y-0.5 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400 text-center font-medium">
                  No options available
                </div>
              ) : (
                options.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value);
                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && handleSelect(opt.value)}
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full flex items-center justify-between px-3 py-2 max-sm:min-h-11 max-sm:text-sm text-xs rounded-lg text-left transition-colors font-medium select-none cursor-pointer ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : isSelected
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'text-slate-800 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate mr-2">{opt.label}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
