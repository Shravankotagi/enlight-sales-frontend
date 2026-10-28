const BUILTIN_ROLE_NAMES = new Set([
  'salesperson',
  'admin',
  'sales_manager',
  'manager',
  'procurement_manager',
  'procurement manager',
  'procurement_person',
  'procurement person',
]);

function formatRole(role?: string) {
  if (!role) return '';
  return role
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function menuRoleLabel(input: {
  roleName?: string;
  isAdmin?: boolean;
  isProcurementManager?: boolean;
  isProcurementPerson?: boolean;
  isSalesManager?: boolean;
}) {
  const name = input.roleName || '';
  if (name && !BUILTIN_ROLE_NAMES.has(name.toLowerCase())) return formatRole(name);
  if (input.isAdmin) return 'Admin';
  if (input.isProcurementManager) return 'Procurement Manager';
  if (input.isProcurementPerson) return 'Procurement Person';
  if (input.isSalesManager) return 'Sales Manager';
  return 'Salesperson';
}
