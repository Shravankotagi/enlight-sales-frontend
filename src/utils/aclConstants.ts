export interface ParticularRow {
  id: string;
  name: string;
  crud: {
    view: string;
    create: string;
    edit: string;
    delete: string;
  };
  otherAction?: {
    key: string;
    headerLabel: string;
    label: string;
  };
  subOptions?: Array<{
    key: string;
    label: string;
  }>;
}

export interface AclSection {
  id: string;
  title: string;
  rows: ParticularRow[];
}

export const ZOHO_ACL_SECTIONS: AclSection[] = [
  {
    id: 'contacts',
    title: 'Contacts & Customers',
    rows: [
      {
        id: 'customers',
        name: 'Customers',
        crud: {
          view: 'customers.view',
          create: 'customers.create',
          edit: 'customers.edit',
          delete: 'customers.delete',
        },
        otherAction: {
          key: 'customers.reassign',
          headerLabel: 'Assign owner',
          label: 'Assign / Reassign account owner to rep',
        },
        subOptions: [
          {
            key: 'customers.scope_assigned',
            label: 'Allow users to handle the data and transactions for assigned customers only.',
          },
          {
            key: 'customers.toggle_active',
            label: 'Activate / Deactivate customer account operational status in directory.',
          },
        ],
      },
    ],
  },
  {
    id: 'visits',
    title: 'Field Operations & Visits',
    rows: [
      {
        id: 'field_visits',
        name: 'Field Visits',
        crud: {
          view: 'visits.view',
          create: 'visits.log',
          edit: 'visits.update',
          delete: 'visits.delete',
        },
        otherAction: {
          key: 'visits.approve',
          headerLabel: 'Verify',
          label: 'Verify visit reports and discussion outcomes',
        },
        subOptions: [
          {
            key: 'visits.scope_assigned',
            label: 'Allow users to log and view visits for assigned customers only.',
          },
          {
            key: 'visits.photo_required',
            label: 'Require site GPS location verification and meeting summary notes.',
          },
        ],
      },
    ],
  },
  {
    id: 'sales',
    title: 'Inquiries & Quotations',
    rows: [
      {
        id: 'inquiries',
        name: 'Inquiries & Quotes',
        crud: {
          view: 'inquiries.view',
          create: 'inquiries.manage',
          edit: 'inquiries.edit',
          delete: 'inquiries.delete',
        },
        otherAction: {
          key: 'inquiries.send_quote',
          headerLabel: 'Send Quote',
          label: 'Generate & share formal quotation PDF via WhatsApp / Email',
        },
        subOptions: [
          {
            key: 'inquiries.scope_assigned',
            label: 'Allow users to handle and rate inquiries received by / assigned to them only.',
          },
          {
            key: 'inquiries.fill_base_prices',
            label: 'Input base product purchase prices and forward raw inquiries to salesperson.',
          },
          {
            key: 'inquiries.price_override',
            label: 'Allow pricing adjustments below standard recommended rate/MT.',
          },
          {
            key: 'inquiries.team_inquiries',
            label: 'Allow managers to view and provide rates across their entire assigned team inquiries.',
          },
        ],
      },
    ],
  },
  {
    id: 'orders',
    title: 'Sales Orders & Deals',
    rows: [
      {
        id: 'sales_orders',
        name: 'Sales Orders & POs',
        crud: {
          view: 'orders.view',
          create: 'orders.create',
          edit: 'orders.update',
          delete: 'deals.delete',
        },
        otherAction: {
          key: 'orders.attach_po',
          headerLabel: 'Attach PO',
          label: 'Upload customer Purchase Order documents & OCR parse details',
        },
        subOptions: [
          {
            key: 'orders.scope_assigned',
            label: 'Allow users to handle sales orders and deals for assigned accounts only.',
          },
        ],
      },
    ],
  },
  {
    id: 'complaints',
    title: 'Customer Grievances',
    rows: [
      {
        id: 'complaints_row',
        name: 'Complaints',
        crud: {
          view: 'complaints.view',
          create: 'complaints.log',
          edit: 'complaints.update',
          delete: 'complaints.delete',
        },
        otherAction: {
          key: 'complaints.resolve',
          headerLabel: 'Resolve',
          label: 'Mark grievances resolved and close remediation tickets',
        },
        subOptions: [
          {
            key: 'complaints.scope_assigned',
            label: 'Allow users to view and log complaints for assigned accounts only.',
          },
        ],
      },
    ],
  },
  {
    id: 'administration',
    title: 'System & Staff Administration',
    rows: [
      {
        id: 'staff_users',
        name: 'Staff & Team Access',
        crud: {
          view: 'staff.view',
          create: 'staff.create',
          edit: 'staff.manage',
          delete: 'staff.delete',
        },
        otherAction: {
          key: 'clients.import_csv',
          headerLabel: 'CSV Import',
          label: 'Bulk import clients & assign accounts via spreadsheet',
        },
        subOptions: [
          {
            key: 'staff.manage_acl',
            label: 'Configure company roles, permission templates, and per-user custom ACLs.',
          },
        ],
      },
    ],
  },
];

// Factory standard default templates
export const DEFAULT_ROLE_TEMPLATES: Record<string, Record<string, boolean>> = {
  salesperson: {
    // Customers
    'customers.view': true,
    'customers.create': true,
    'customers.edit': true,
    'customers.delete': false,
    'customers.reassign': false,
    'customers.scope_assigned': true,
    'customers.toggle_active': false,
    // Visits
    'visits.view': true,
    'visits.log': true,
    'visits.update': false,
    'visits.delete': false,
    'visits.approve': false,
    'visits.scope_assigned': true,
    'visits.photo_required': true,
    // Inquiries
    'inquiries.view': true,
    'inquiries.manage': true,
    'inquiries.edit': true,
    'inquiries.delete': false,
    'inquiries.send_quote': true,
    'inquiries.scope_assigned': true,
    'inquiries.price_override': false,
    'inquiries.fill_base_prices': false,
    'inquiries.team_inquiries': false,
    // Orders
    'orders.view': true,
    'orders.create': true,
    'orders.update': true,
    'deals.delete': false,
    'orders.attach_po': true,
    'orders.scope_assigned': true,
    // Complaints
    'complaints.view': true,
    'complaints.log': true,
    'complaints.update': true,
    'complaints.delete': false,
    'complaints.resolve': false,
    'complaints.scope_assigned': true,
    // Staff
    'staff.view': false,
    'staff.create': false,
    'staff.manage': false,
    'staff.delete': false,
    'clients.import_csv': false,
    'staff.manage_acl': false,
  },
  sales_manager: {
    // Customers
    'customers.view': true,
    'customers.create': true,
    'customers.edit': true,
    'customers.delete': true,
    'customers.reassign': true,
    'customers.scope_assigned': false,
    'customers.toggle_active': false,
    // Visits
    'visits.view': true,
    'visits.log': true,
    'visits.update': true,
    'visits.delete': true,
    'visits.approve': true,
    'visits.scope_assigned': false,
    'visits.photo_required': true,
    // Inquiries
    'inquiries.view': true,
    'inquiries.manage': true,
    'inquiries.edit': true,
    'inquiries.delete': true,
    'inquiries.send_quote': true,
    'inquiries.scope_assigned': false,
    'inquiries.price_override': true,
    'inquiries.fill_base_prices': false,
    'inquiries.team_inquiries': true,
    // Orders
    'orders.view': true,
    'orders.create': true,
    'orders.update': true,
    'deals.delete': true,
    'orders.attach_po': true,
    'orders.scope_assigned': false,
    // Complaints
    'complaints.view': true,
    'complaints.log': true,
    'complaints.update': true,
    'complaints.delete': true,
    'complaints.resolve': true,
    'complaints.scope_assigned': false,
    // Staff
    'staff.view': true,
    'staff.create': false,
    'staff.manage': false,
    'staff.delete': false,
    'clients.import_csv': false,
    'staff.manage_acl': false,
  },
  procurement_person: {
    // Customers (No access)
    'customers.view': false,
    'customers.create': false,
    'customers.edit': false,
    'customers.delete': false,
    'customers.reassign': false,
    'customers.scope_assigned': false,
    'customers.toggle_active': false,
    // Visits (No access)
    'visits.view': false,
    'visits.log': false,
    'visits.update': false,
    'visits.delete': false,
    'visits.approve': false,
    'visits.scope_assigned': false,
    'visits.photo_required': false,
    // Inquiries (Exclusive module - receives inquiries & inputs base purchase rates)
    'inquiries.view': true,
    'inquiries.manage': false,
    'inquiries.edit': true,
    'inquiries.delete': false,
    'inquiries.send_quote': false,
    'inquiries.scope_assigned': true,
    'inquiries.price_override': false,
    'inquiries.fill_base_prices': true,
    'inquiries.team_inquiries': false,
    // Orders (No access)
    'orders.view': false,
    'orders.create': false,
    'orders.update': false,
    'deals.delete': false,
    'orders.attach_po': false,
    'orders.scope_assigned': false,
    // Complaints (No access)
    'complaints.view': false,
    'complaints.log': false,
    'complaints.update': false,
    'complaints.delete': false,
    'complaints.resolve': false,
    'complaints.scope_assigned': false,
    // Staff (No access)
    'staff.view': false,
    'staff.create': false,
    'staff.manage': false,
    'staff.delete': false,
    'clients.import_csv': false,
    'staff.manage_acl': false,
  },
  procurement_manager: {
    // Customers (No access)
    'customers.view': false,
    'customers.create': false,
    'customers.edit': false,
    'customers.delete': false,
    'customers.reassign': false,
    'customers.scope_assigned': false,
    'customers.toggle_active': false,
    // Visits (No access)
    'visits.view': false,
    'visits.log': false,
    'visits.update': false,
    'visits.delete': false,
    'visits.approve': false,
    'visits.scope_assigned': false,
    'visits.photo_required': false,
    // Inquiries (Exclusive module - reviews & provides base purchase rates for assigned procurement team)
    'inquiries.view': true,
    'inquiries.manage': false,
    'inquiries.edit': true,
    'inquiries.delete': true,
    'inquiries.send_quote': false,
    'inquiries.scope_assigned': false,
    'inquiries.price_override': true,
    'inquiries.fill_base_prices': true,
    'inquiries.team_inquiries': true,
    // Orders (No access)
    'orders.view': false,
    'orders.create': false,
    'orders.update': false,
    'deals.delete': false,
    'orders.attach_po': false,
    'orders.scope_assigned': false,
    // Complaints (No access)
    'complaints.view': false,
    'complaints.log': false,
    'complaints.update': false,
    'complaints.delete': false,
    'complaints.resolve': false,
    'complaints.scope_assigned': false,
    // Staff (Can view their assigned procurement team members)
    'staff.view': true,
    'staff.create': false,
    'staff.manage': false,
    'staff.delete': false,
    'clients.import_csv': false,
    'staff.manage_acl': false,
  },
  admin: {
    // Customers
    'customers.view': true,
    'customers.create': true,
    'customers.edit': true,
    'customers.delete': true,
    'customers.reassign': true,
    'customers.scope_assigned': false,
    'customers.toggle_active': true,
    // Visits
    'visits.view': true,
    'visits.log': true,
    'visits.update': true,
    'visits.delete': true,
    'visits.approve': true,
    'visits.scope_assigned': false,
    'visits.photo_required': true,
    // Inquiries
    'inquiries.view': true,
    'inquiries.manage': true,
    'inquiries.edit': true,
    'inquiries.delete': true,
    'inquiries.send_quote': true,
    'inquiries.scope_assigned': false,
    'inquiries.price_override': true,
    'inquiries.fill_base_prices': true,
    'inquiries.team_inquiries': true,
    // Orders
    'orders.view': true,
    'orders.create': true,
    'orders.update': true,
    'deals.delete': true,
    'orders.attach_po': true,
    'orders.scope_assigned': false,
    // Complaints
    'complaints.view': true,
    'complaints.log': true,
    'complaints.update': true,
    'complaints.delete': true,
    'complaints.resolve': true,
    'complaints.scope_assigned': false,
    // Staff
    'staff.view': true,
    'staff.create': true,
    'staff.manage': true,
    'staff.delete': true,
    'clients.import_csv': true,
    'staff.manage_acl': true,
  },
};

const STORAGE_KEY_PREFIX = 'enlight_role_template_';

export function resolveEmployeeInquiryPermissions(
  role?: string | null,
  stored?: Record<string, boolean> | null,
): Record<string, boolean> {
  const normalized = role === 'manager' ? 'sales_manager' : role || '';
  const defaults = { ...(DEFAULT_ROLE_TEMPLATES[normalized] || {}) };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return defaults;
  }
  const overlay: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === 'boolean') overlay[key] = value;
  }
  return { ...defaults, ...overlay };
}

export function canFillProcurementBasePrices(employee?: {
  role?: string | null;
  permissions?: Record<string, boolean> | null;
} | null) {
  const permissions = resolveEmployeeInquiryPermissions(
    employee?.role,
    employee?.permissions,
  );
  return (
    permissions['inquiries.view'] === true &&
    permissions['inquiries.edit'] === true &&
    permissions['inquiries.fill_base_prices'] === true
  );
}

export function canSendProcurementQuote(employee?: {
  role?: string | null;
  permissions?: Record<string, boolean> | null;
} | null) {
  const permissions = resolveEmployeeInquiryPermissions(
    employee?.role,
    employee?.permissions,
  );
  return (
    permissions['inquiries.view'] === true &&
    permissions['inquiries.send_quote'] === true
  );
}

export function canDeleteProcurementInquiries(employee?: {
  role?: string | null;
  permissions?: Record<string, boolean> | null;
} | null) {
  const permissions = resolveEmployeeInquiryPermissions(
    employee?.role,
    employee?.permissions,
  );
  return (
    permissions['inquiries.view'] === true &&
    permissions['inquiries.delete'] === true
  );
}

export function getRoleTemplate(role: string): Record<string, boolean> {
  const normalized = role === 'manager' ? 'sales_manager' : role;
  const defaultTemplate =
    DEFAULT_ROLE_TEMPLATES[normalized] || DEFAULT_ROLE_TEMPLATES.salesperson;

  if (typeof window === 'undefined') {
    return { ...defaultTemplate };
  }

  try {
    const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${normalized}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultTemplate, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load custom role template from localStorage', err);
  }

  return { ...defaultTemplate };
}

export function saveRoleTemplate(
  role: string,
  permissions: Record<string, boolean>,
): void {
  const normalized = role === 'manager' ? 'sales_manager' : role;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${normalized}`,
      JSON.stringify(permissions),
    );
    window.dispatchEvent(
      new CustomEvent('enlight_role_template_updated', {
        detail: { role: normalized },
      }),
    );
  } catch (err) {
    console.error('Failed to save role template to localStorage', err);
  }
}

export function resetRoleTemplate(role: string): Record<string, boolean> {
  const normalized = role === 'manager' ? 'sales_manager' : role;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${normalized}`);
    window.dispatchEvent(
      new CustomEvent('enlight_role_template_updated', {
        detail: { role: normalized },
      }),
    );
  } catch (err) {
    console.error('Failed to reset role template', err);
  }
  return {
    ...(DEFAULT_ROLE_TEMPLATES[normalized] || DEFAULT_ROLE_TEMPLATES.salesperson),
  };
}

export function countOverrides(
  role: string,
  permissions?: Record<string, boolean> | null,
): number {
  if (!permissions) return 0;
  const template = getRoleTemplate(role);
  return Object.keys(template).reduce((count, key) => {
    if (key in permissions && permissions[key] !== template[key]) {
      return count + 1;
    }
    return count;
  }, 0);
}

export function countFactoryDiff(
  role: string,
  permissions: Record<string, boolean>,
): number {
  const normalized = role === 'manager' ? 'sales_manager' : role;
  const factory =
    DEFAULT_ROLE_TEMPLATES[normalized] || DEFAULT_ROLE_TEMPLATES.salesperson;
  return Object.keys(factory).reduce((count, key) => {
    if (key in permissions && permissions[key] !== factory[key]) {
      return count + 1;
    }
    return count;
  }, 0);
}

export interface RoleItem {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  data_scope?: 'own' | 'team' | 'all';
  permissions: Record<string, boolean>;
}

export const SYSTEM_ROLE_IDS = [
  'admin',
  'sales_manager',
  'salesperson',
  'procurement_manager',
  'procurement_person',
] as const;

export type SystemRoleId = (typeof SYSTEM_ROLE_IDS)[number];

export function isSystemRoleId(roleId: string | null | undefined): boolean {
  if (!roleId) return false;
  const norm = roleId === 'manager' ? 'sales_manager' : String(roleId).trim().toLowerCase();
  return (SYSTEM_ROLE_IDS as readonly string[]).includes(norm);
}

export const INITIAL_SYSTEM_ROLES: RoleItem[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full company-wide visibility, staff management, and system configuration.',
    isSystem: true,
    data_scope: 'all',
    permissions: DEFAULT_ROLE_TEMPLATES.admin,
  },
  {
    id: 'sales_manager',
    name: 'Sales Manager',
    description: 'Team supervisor: manages assigned sales reps, customer accounts, deals, and field visits.',
    isSystem: true,
    data_scope: 'team',
    permissions: DEFAULT_ROLE_TEMPLATES.sales_manager,
  },
  {
    id: 'salesperson',
    name: 'Salesperson',
    description: 'Standard field representative: creates visits, handles inquiries, applies margins, and issues quotes.',
    isSystem: true,
    data_scope: 'own',
    permissions: DEFAULT_ROLE_TEMPLATES.salesperson,
  },
  {
    id: 'procurement_manager',
    name: 'Procurement Manager',
    description: 'Procurement supervisor: reviews raw inquiries and provides base product purchase rates for all assigned procurement team inquiries.',
    isSystem: true,
    data_scope: 'team',
    permissions: DEFAULT_ROLE_TEMPLATES.procurement_manager,
  },
  {
    id: 'procurement_person',
    name: 'Procurement Person',
    description: 'Receives raw customer inquiries, fills in base product purchase prices, and forwards rated inquiry to salesperson. Scoped strictly to inquiries received by them.',
    isSystem: true,
    data_scope: 'own',
    permissions: DEFAULT_ROLE_TEMPLATES.procurement_person,
  },
  {
    id: 'staff_assigned_only',
    name: 'Staff (Assigned Customers Only)',
    description: 'Operational sales staff limited strictly to assigned customer portfolios.',
    isSystem: false,
    data_scope: 'own',
    permissions: {
      ...DEFAULT_ROLE_TEMPLATES.salesperson,
      'inquiries.delete': false,
      'deals.delete': false,
      'customers.reassign': false,
      'customers.scope_assigned': true,
      'visits.scope_assigned': true,
    },
  },
];

const ROLES_LIST_STORAGE_KEY = 'enlight_custom_roles_list';

export function getAllRoles(): RoleItem[] {
  if (rolesCache && rolesCache.length > 0) return rolesCache;
  if (typeof window === 'undefined') {
    return INITIAL_SYSTEM_ROLES;
  }
  try {
    const raw = localStorage.getItem(ROLES_LIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all system roles are present in the list
        const existingIds = new Set(parsed.map((r: RoleItem) => r.id));
        const missingSystem = INITIAL_SYSTEM_ROLES.filter((sys) => !existingIds.has(sys.id));
        let merged = parsed;
        if (missingSystem.length > 0) {
          merged = [...parsed, ...missingSystem];
          saveAllRoles(merged);
        }
        // Always sync system roles with their latest fixed active template
        return merged.map((r: RoleItem) => {
          if (isSystemRoleId(r.id) || r.isSystem) {
            const sysId = r.id === 'manager' ? 'sales_manager' : r.id;
            const sysTemplate = DEFAULT_ROLE_TEMPLATES[sysId] || DEFAULT_ROLE_TEMPLATES.salesperson;
            const sysScope = sysId === 'admin' ? 'all' : (sysId === 'sales_manager' || sysId === 'procurement_manager') ? 'team' : 'own';
            return {
              ...r,
              isSystem: true,
              data_scope: sysScope,
              permissions: sysTemplate,
            };
          }
          return r;
        });
      }
    }
  } catch (err) {
    console.warn('Failed to parse roles list from localStorage', err);
  }
  return INITIAL_SYSTEM_ROLES.map((r) => ({
    ...r,
    isSystem: isSystemRoleId(r.id),
    permissions: getRoleTemplate(r.id),
  }));
}

export function saveAllRoles(roles: RoleItem[]): void {
  // Guarantee system roles never have their default permissions corrupted in localStorage
  const sanitized = roles.map((r) => {
    if (isSystemRoleId(r.id) || r.isSystem) {
      const sysId = r.id === 'manager' ? 'sales_manager' : r.id;
      return {
        ...r,
        isSystem: true,
        permissions: DEFAULT_ROLE_TEMPLATES[sysId] || DEFAULT_ROLE_TEMPLATES.salesperson,
      };
    }
    return r;
  });
  rolesCache = sanitized;
  try {
    localStorage.setItem(ROLES_LIST_STORAGE_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent('enlight_roles_updated'));
  } catch (err) {
    console.error('Failed to save roles list to localStorage', err);
  }
}

export function createNewRole(
  name: string,
  description: string,
  permissions: Record<string, boolean>,
): RoleItem {
  const current = getAllRoles();
  const id = `role_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString().slice(-4)}`;
  const newRole: RoleItem = {
    id,
    name,
    description,
    isSystem: false,
    permissions,
  };
  const updated = [...current, newRole];
  saveAllRoles(updated);
  return newRole;
}

export function updateExistingRole(
  id: string,
  updates: Partial<RoleItem>,
): void {
  if (isSystemRoleId(id)) {
    console.warn(`Attempted to update fixed system role "${id}". System roles cannot be modified.`);
    return;
  }
  const current = getAllRoles();
  const updated = current.map((r) => {
    if (r.id === id) {
      return { ...r, ...updates };
    }
    return r;
  });
  saveAllRoles(updated);
}

export function deleteRole(id: string): void {
  if (isSystemRoleId(id)) {
    console.warn(`Attempted to delete system role "${id}". System roles cannot be deleted.`);
    return;
  }
  const current = getAllRoles();
  const filtered = current.filter((r) => r.id !== id && !isSystemRoleId(r.id));
  saveAllRoles(filtered);
}

export const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/customers': ['customers.view'],
  '/visits': ['visits.view'],
  '/inquiries': ['inquiries.view'],
  '/pipeline': ['inquiries.view'],
  '/orders': ['orders.view'],
  '/complaints': ['complaints.view'],
  '/admin-dashboard': ['staff.view'],
  '/control-panel': [
    'staff.view',
    'staff.create',
    'staff.manage',
    'staff.delete',
    'staff.manage_acl',
  ],
  '/roles': [
    'staff.view',
    'staff.create',
    'staff.manage',
    'staff.delete',
    'staff.manage_acl',
  ],
};

export function routeAllowed(
  path: string,
  can: (key: string) => boolean,
): boolean {
  const keys = ROUTE_PERMISSIONS[path];
  if (!keys) return true;
  return keys.some((key) => can(key));
}

let rolesCache: RoleItem[] | null = null;

export function setRolesCache(roles: RoleItem[]) {
  rolesCache = roles;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('enlight_roles_updated'));
  }
}

export function getCachedRoles(): RoleItem[] {
  return rolesCache && rolesCache.length > 0 ? rolesCache : getAllRoles();
}

