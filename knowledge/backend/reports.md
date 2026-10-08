# Reports

`ReportsModule` derives dashboard reporting from operational data instead of owning a canonical business table. It serves overview, monthly, funnel, salesperson, and SKU reporting to the frontend. Date ranges, unit conversion, stage definitions, and manager/salesperson scope materially affect results; verify all when changing aggregation logic.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
