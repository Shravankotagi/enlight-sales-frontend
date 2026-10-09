# Reports

`ReportsModule` derives dashboard reporting from operational data instead of owning a canonical business table. It serves overview, monthly, funnel, salesperson, and SKU reporting to the frontend. Date ranges, unit conversion, stage definitions, and manager/salesperson scope materially affect results; verify all when changing aggregation logic.

The salesperson report normalizes phone values to the last 10 digits when joining employee identities and activity records. Each row returns `salesperson_phone`, `name`, and `employee_id`; consumers should fall back from name to employee ID or phone when displaying an unresolved identity. Its backend `kra_score` remains a composite report metric. The Admin Dashboard leaderboard intentionally uses the Home dashboard's won-order, delivered-tonnage, visit, and pending-complaint inputs instead: won orders contribute up to 40 points, visits up to 30 against a 40-visit target, tonnage up to 30 against a 40 MT monthly target, and pending complaints deduct up to 20, clamped to 0–100. Multi-month date ranges scale the tonnage target by calendar months.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
