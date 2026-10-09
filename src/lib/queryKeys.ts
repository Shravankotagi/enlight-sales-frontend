export const queryKeys = {
  employeesDirectory: ['employees-directory'] as const,
  customerNames: (
    phone?: string | null,
    role?: string | null,
    mode?: string | null,
  ) => ['customer-names-list', phone ?? null, role ?? null, mode ?? null] as const,
};

export function normalizeListResponse(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}
