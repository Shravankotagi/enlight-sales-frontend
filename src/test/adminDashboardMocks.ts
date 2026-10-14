import { vi } from 'vitest'

/**
 * Stand-in for `src/lib/api` when testing AdminDashboard:
 *
 *   vi.mock('../lib/api', async () => (await import('../test/adminDashboardMocks')).adminApi)
 *   beforeEach(() => setAdminDashboardData({ employees: [...], orders: [...] }))
 *
 * Each `getAll` resolves with the axios-shaped `{ data }` the page expects.
 */
export interface AdminDashboardData {
  employees?: Record<string, unknown>[]
  orders?: Record<string, unknown>[]
  visits?: Record<string, unknown>[]
  complaints?: Record<string, unknown>[]
  deals?: Record<string, unknown>[]
}

let data: AdminDashboardData = {}
const ok = (payload: unknown) => Promise.resolve({ data: payload })

export const adminApi = {
  employeesApi: { getAll: vi.fn((_params?: unknown) => ok(data.employees ?? [])) },
  ordersApi: { getAll: vi.fn((_params?: unknown) => ok({ data: data.orders ?? [] })) },
  visitsApi: { getAll: vi.fn((_params?: unknown) => ok({ data: data.visits ?? [] })) },
  complaintsApi: { getAll: vi.fn((_params?: unknown) => ok({ data: data.complaints ?? [] })) },
  dealsApi: { getAll: vi.fn((_params?: unknown) => ok({ data: data.deals ?? [] })) },
  reportsApi: {
    getMonthly: vi.fn((_params?: unknown) => ok({ data: { summary: {} } })),
    getFunnel: vi.fn((_params?: unknown) => ok({ data: { stages: [] } })),
    getSku: vi.fn((_params?: unknown) => ok({ data: [] })),
  },
}

/** Replaces the data served by `adminApi` and clears recorded calls. */
export function setAdminDashboardData(next: AdminDashboardData) {
  data = next
  for (const client of Object.values(adminApi)) {
    for (const fn of Object.values(client)) fn.mockClear()
  }
}
