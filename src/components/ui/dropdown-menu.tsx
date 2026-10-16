import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  forwardRef,
} from 'react';

interface DropdownContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = createContext<DropdownContextValue | undefined>(
  undefined
);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block w-full text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild = false,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    ctx.setOpen((prev) => !prev);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      'aria-expanded': ctx.open,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={ctx.open}
      className="inline-flex items-center justify-between w-full"
    >
      {children}
    </button>
  );
}

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  {
    className?: string;
    children: React.ReactNode;
    align?: 'start' | 'end' | 'center';
  }
>(({ className = '', children, align = 'start' }, ref) => {
  const ctx = useContext(DropdownContext);
  if (!ctx || !ctx.open) return null;

  const alignmentClass =
    align === 'end'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  return (
    <div
      ref={ref}
      className={`absolute bottom-full mb-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl animate-in fade-in zoom-in-95 ${alignmentClass} ${className}`}
    >
      {children}
    </div>
  );
});

DropdownMenuContent.displayName = 'DropdownMenuContent';

export function DropdownMenuLabel({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-2 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({
  className = '',
}: {
  className?: string;
}) {
  return <div className={`-mx-1 my-1 h-px bg-slate-100 ${className}`} />;
}

export function DropdownMenuItem({
  className = '',
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const ctx = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent) => {
    onClick?.(e);
    ctx?.setOpen(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      {children}
    </button>
  );
}
