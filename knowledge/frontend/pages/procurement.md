# Procurement prototype

This is a frontend-only presentation prototype for a future Procurement role. It is not connected to backend APIs, Supabase, Prisma, or the bot.

## Workflow

1. Salesperson logs an inquiry.
2. Procurement opens `/procurement` and sees an anonymised request: request ID, material, grade, dimensions, quantity, tonnage, delivery region, date, and status. Customer name, company, and phone are intentionally absent from the `ProcurementRequest` type and mock data.
3. Procurement enters a base price in Rs/MT and saves it.
4. Salesperson opens the inquiry in `/inquiries`, adds transport in Rs/MT and margin as a percentage, and reviews the live total.
5. The existing quotation flow opens after the salesperson clicks Send quotation.

The pricing formula is:

`total = (base price + transport) × (1 + margin percentage) × quantity in MT`

GST uses the existing `calculateQuotationBreakdown` helper.

## Prototype controls

The sidebar's **Prototype demo** selector switches between Salesperson, Procurement, and Admin personas in `sessionStorage`. It does not modify the real auth token or employee record. The mock request store is `src/lib/procurementMock.ts`; replace that module with API calls when the backend contract exists.

## UI boundaries

- Procurement receives a dedicated tab and restricted route rather than a masked copy of the large Inquiries page.
- The Procurement detail drawer includes an explicit customer-identity-hidden notice.
- The salesperson sees only the pricing panel and final quotation total; procurement base price and internal margin are not customer-facing fields.
- Statuses are UI-only: `Awaiting procurement`, `Priced by procurement`, and `Quotation sent`.
