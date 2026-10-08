# Deals and orders

## Purpose
`DealsModule` owns the commercial pipeline and won-order representation. Deals are stored in `deals` with line items in `deal_items`; “orders” in the UI are deals filtered to stage `won`.

## Interface
The dashboard calls `/deals`, `/deals/kanban`, `/deals/pipeline`, `/deals/:id`, `/deals/:id/stage`, `/deals/order`, `/deals/process-po`, and System PO reservation endpoints under `/deals/po/*`.

## Critical invariants
- Stage transitions, PO allocation/release, lost reason, and generated/reference PO fields are coupled.
- Keep a reservation token through allocation → save/update → release/finalize; do not allocate a System PO twice.
- Role/salesperson scope affects reads and writes.
- Item writes must retain `deal_items` consistency.

Related UI: OrdersPage, InquiriesPage pipeline view, DealDetailDrawer, System PO helper. Related bot paths: sales agent and catalog flow.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
