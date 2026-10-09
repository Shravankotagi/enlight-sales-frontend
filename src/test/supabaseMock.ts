/**
 * Chainable Supabase client fake for component and unit tests.
 *
 *   const db = createSupabaseMock({ tables: { employees: [...] } })
 *   vi.mock('../lib/supabase', () => ({ supabase: db.client }))
 *
 * `eq`, `neq`, `in`, `is`, `ilike`, `gte`, `lte` filter rows; other modifiers
 * are recorded and ignored. Every terminal query is pushed to `db.calls`.
 */

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

export interface RecordedCall {
  table: string
  op: string
  modifiers: [string, unknown[]][]
}

const PASSTHROUGH = ['select', 'order', 'limit', 'range', 'or', 'not', 'contains', 'filter', 'match', 'gt', 'lt']

const likeToRegExp = (pattern: string) => {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/%/g, '.*').replace(/_/g, '.')}$`, 'i')
}

export function createSupabaseMock(options: { tables?: Record<string, Row[]> } = {}) {
  const store: Record<string, Row[]> = {}
  for (const [name, rows] of Object.entries(options.tables ?? {})) store[name] = rows.map((r) => ({ ...r }))
  const calls: RecordedCall[] = []

  const builder = (table: string) => {
    const filters: Filter[] = []
    const modifiers: [string, unknown[]][] = []
    let op = 'select'
    let single = false
    let maybe = false

    const run = () => {
      calls.push({ table, op, modifiers })
      const rows = (store[table] ?? []).filter((row) => filters.every((f) => f(row)))
      if (single || maybe) {
        if (rows.length === 0) {
          return maybe ? { data: null, error: null } : { data: null, error: { code: 'PGRST116', message: 'No rows found' } }
        }
        return { data: rows[0], error: null }
      }
      return { data: rows, error: null, count: rows.length }
    }

    const api: Record<string, unknown> = {
      insert: () => ((op = 'insert'), api),
      update: () => ((op = 'update'), api),
      upsert: () => ((op = 'upsert'), api),
      delete: () => ((op = 'delete'), api),
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), api),
      neq: (col: string, val: unknown) => (filters.push((r) => r[col] !== val), api),
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), api),
      is: (col: string, val: unknown) => (filters.push((r) => (r[col] ?? null) === val), api),
      ilike: (col: string, pattern: string) => {
        const re = likeToRegExp(pattern)
        filters.push((r) => re.test(String(r[col] ?? '')))
        return api
      },
      gte: (col: string, val: string | number) => (filters.push((r) => (r[col] as string | number) >= val), api),
      lte: (col: string, val: string | number) => (filters.push((r) => (r[col] as string | number) <= val), api),
      single: () => ((single = true), api),
      maybeSingle: () => ((maybe = true), api),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    }
    for (const name of PASSTHROUGH) {
      api[name] = (...args: unknown[]) => (modifiers.push([name, args]), api)
    }
    return api
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: () => {},
  }

  return { client, store, calls }
}
