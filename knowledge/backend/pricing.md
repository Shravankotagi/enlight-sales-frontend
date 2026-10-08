# Pricing

`PricingModule` contains `pricing.service.ts` and `pricing.engine.ts`, backed by rate-sheet and floor-margin data (`rate_sheets`, `rate_sheet_items`, `floor_margins`). It evaluates quotations/order pricing and margin guardrails.

Pricing logic is duplicated in bot `src/utils/pricingEngine.js` and frontend `src/utils/pricingEngine.ts`. Any rule change needs a behavioral parity check across all three implementations and a guardrail regression test.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
