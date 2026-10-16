import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/blocks/sidebar';

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';

import {
  CircleUserRound,
  ChevronsUpDown,
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  ChevronDown,
} from 'lucide-react';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ---------------- Top Team Switcher ---------------- */
export function TeamSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between gap-2 mb-3 font-medium"
        >
          My Team
          <ChevronsUpDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>Select Team</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Engineering</DropdownMenuItem>
        <DropdownMenuItem>Design</DropdownMenuItem>
        <DropdownMenuItem>Marketing</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Footer User Menu ---------------- */
export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between gap-3 h-12 px-3"
        >
          <div className="flex items-center gap-2">
            <CircleUserRound className="h-5 w-5 rounded-md" />
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">ruixen</span>
              <span className="text-xs text-slate-500">
                team@ruixen.com
              </span>
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-48">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Billing</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-500">Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------- Status Badge ---------------- */
export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    New: 'bg-green-100 text-green-700',
    Updated: 'bg-blue-100 text-blue-700',
    'Coming Soon': 'bg-yellow-100 text-yellow-700',
    Live: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span
      className={`ml-2 px-2 py-0.5 rounded-md text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-700'}`}
    >
      {status}
    </span>
  );
}

/* ---------------- Sidebar Data ---------------- */
export const sidebarData = [
  {
    label: 'Main',
    items: [
      { title: 'Home', url: '#', icon: Home },
      { title: 'Inbox', url: '#', icon: Inbox, status: 'New' },
    ],
  },
  {
    label: 'Work',
    items: [
      {
        sublabel: 'Projects',
        children: [
          { title: 'Calendar', url: '#', icon: Calendar },
          { title: 'Search', url: '#', icon: Search, status: 'Updated' },
        ],
      },
      {
        sublabel: 'Settings',
        children: [{ title: 'Preferences', url: '#', icon: Settings }],
      },
      {
        title: 'Reports', // <-- single item, no dropdown
        url: '#',
        icon: Inbox,
        status: 'Coming Soon',
      },
    ],
  },
];

/* ---------------- Collapsible Subgroup ---------------- */
export function CollapsibleSubGroup({
  sublabel,
  childrenItems,
}: {
  sublabel: string;
  childrenItems: any[];
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full justify-between items-center px-2 py-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition cursor-pointer"
      >
        {sublabel}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <SidebarMenu>
              {childrenItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <a
                        href={item.url}
                        className="flex items-center text-slate-600 hover:text-slate-900"
                      >
                        {Icon && <Icon className="h-4 w-4 mr-2" />}
                        <span>{item.title}</span>
                        <StatusBadge status={item.status} />
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Main Sidebar Demo Component ---------------- */
export function SidebarDemo() {
  return (
    <SidebarProvider>
      <Sidebar className="bg-white">
        <SidebarContent>
          <div className="p-2">
            <TeamSwitcher />
          </div>

          {sidebarData.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wide text-slate-400 px-2">
                {group.label}
              </SidebarGroupLabel>

              <SidebarGroupContent>
                {group.label === 'Work' ? (
                  <>
                    {group.items.map((item: any) =>
                      item.children ? (
                        <CollapsibleSubGroup
                          key={item.sublabel}
                          sublabel={item.sublabel}
                          childrenItems={item.children}
                        />
                      ) : (
                        // Single item with no dropdown
                        <SidebarMenu key={item.title}>
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild tooltip={item.title}>
                              <a
                                href={item.url}
                                className="flex items-center text-slate-600 hover:text-slate-900"
                              >
                                {item.icon && <item.icon className="h-4 w-4 mr-2" />}
                                <span>{item.title}</span>
                                <StatusBadge status={item.status} />
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        </SidebarMenu>
                      )
                    )}
                  </>
                ) : (
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <a
                              href={item.url}
                              className="flex items-center text-slate-600 hover:text-slate-900"
                            >
                              {Icon && <Icon className="h-4 w-4 mr-2" />}
                              <span>{item.title}</span>
                              <StatusBadge status={item.status} />
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* Footer dropdown menu */}
        <SidebarFooter>
          <UserMenu />
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1">
        <div className="px-4 py-2">
          <SidebarTrigger className="h-5 w-5 mt-2" />
        </div>

        <div className="p-6 space-y-8">
          {/* Hero Section */}
          <section className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Ruixen UI
            </h1>
            <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
              Build modern websites with handcrafted components, templates, and
              interactive sections. Designed for speed, creativity, and developer-friendliness.
            </p>
          </section>

          {/* Featured Templates */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900">✨ Featured Templates</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <a
                href="https://www.ruixen.com/templates?utm_source=21st.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-slate-200 bg-white hover:shadow-lg transition overflow-hidden"
              >
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900">Premium Templates</h3>
                  <p className="text-sm text-slate-500">
                    Get production-ready landing pages, dashboards, and portfolios to
                    kickstart your next project.
                  </p>
                </div>
              </a>
            </div>
          </section>

          {/* Components Showcase */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900">🛠️ Popular Components</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <a
                href="https://www.ruixen.com/docs/sections/staggered-faq-section?utm_source=21st.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-slate-200 bg-white hover:shadow-lg transition overflow-hidden"
              >
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-slate-900">Staggered FAQ Section</h3>
                  <p className="text-sm text-slate-500">
                    Enhance your product page with beautiful, animated FAQ layouts that
                    improve UX and reduce support tickets.
                  </p>
                </div>
              </a>
            </div>
          </section>

          {/* Call-to-Action */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">🚀 Start Building with Ruixen UI</h2>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Explore 250+ components, ready-to-use templates, and interactive
              sections—all optimized for developers.
            </p>
            <div className="mt-4 flex justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="rounded-xl font-medium shadow-md"
              >
                <a
                  href="https://www.ruixen.com/templates?utm_source=21st.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Browse Templates
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl font-medium"
              >
                <a
                  href="https://www.ruixen.com/docs/sections/staggered-faq-section?utm_source=21st.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Components
                </a>
              </Button>
            </div>
          </section>
        </div>
      </main>
    </SidebarProvider>
  );
}

export default SidebarDemo;
