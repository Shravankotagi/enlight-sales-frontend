import React, {
  createContext,
  useContext,
  useState,
  forwardRef,
} from 'react';
import { PanelLeft } from 'lucide-react';

interface SidebarContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export function SidebarProvider({
  children,
  defaultOpen = true,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggleSidebar = () => setOpen((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 font-sans">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export const Sidebar = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', children, ...props }, ref) => {
  const { open } = useSidebar();

  return (
    <aside
      ref={ref}
      className={`relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out shrink-0 select-none ${
        open ? 'w-64' : 'w-16'
      } ${className}`}
      {...props}
    >
      {children}
    </aside>
  );
});
Sidebar.displayName = 'Sidebar';

export function SidebarContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarGroup({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`space-y-1 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SidebarGroupLabel({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open } = useSidebar();
  if (!open) return null;

  return (
    <div
      className={`text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function SidebarGroupContent({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`space-y-0.5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SidebarMenu({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={`space-y-0.5 list-none p-0 m-0 ${className}`} {...props}>
      {children}
    </ul>
  );
}

export function SidebarMenuItem({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={`list-none ${className}`} {...props}>
      {children}
    </li>
  );
}

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  tooltip?: string;
  isActive?: boolean;
}

export const SidebarMenuButton = forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(({ className = '', asChild = false, tooltip, isActive = false, children, ...props }, ref) => {
  const { open } = useSidebar();

  const baseClasses = `flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all cursor-pointer ${
    isActive
      ? 'bg-slate-900 text-white shadow-xs'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  } ${className}`;

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref,
      className: `${baseClasses} ${(children as React.ReactElement<any>).props.className || ''}`.trim(),
      title: !open ? tooltip : undefined,
      ...props,
    });
  }

  return (
    <button
      ref={ref}
      title={!open ? tooltip : undefined}
      className={baseClasses}
      {...props}
    >
      {children}
    </button>
  );
});
SidebarMenuButton.displayName = 'SidebarMenuButton';

export function SidebarFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-2 border-t border-slate-100 mt-auto ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SidebarTrigger({
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-xs transition-colors cursor-pointer ${className}`}
      title="Toggle Sidebar"
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}
