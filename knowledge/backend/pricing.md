# Pricing

`PricingModule` contains `pricing.service.ts` and `pricing.engine.ts`, backed by rate-sheet and floor-margin data (`rate_sheets`, `rate_sheet_items`, `floor_margins`). It evaluates quotations/order pricing and margin guardrails.

Pricing logic is duplicated in bot `src/utils/pricingEngine.js` and frontend `src/utils/pricingEngine.ts`. Any rule change needs a behavioral parity check across all three implementations and a guardrail regression test.

## GST & Place of Supply Rules
- **Seller Config (`SELLER_GST_CONFIG`)**: Enlight Metals Private Limited, Maharashtra (`stateCode: '27'`, GSTIN: `27AAICE5263E1ZN`).
- **Place of Supply Resolution**:
  1. Delivery Location / Shipping Destination state
  2. Customer State / GSTIN (first 2 digits) / Registered Address
  3. Default: Seller State (`Maharashtra (27)`)
- **Tax Breakdown**:
  - **Intra-state** (`stateCode === '27'`): `CGST (9%)` + `SGST (9%)`, `IGST = 0%`.
  - **Inter-state** (`stateCode !== '27'`): `IGST (18%)`, `CGST = 0%`, `SGST = 0%`.
  - Subtotal and Grand Total remain identical across both cases. Line items and PDF summaries conditionally render CGST+SGST vs IGST columns and rows.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
