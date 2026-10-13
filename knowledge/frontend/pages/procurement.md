# Procurement prototype

This is a frontend-only presentation prototype for a future Procurement role. It is not connected to backend APIs, Supabase, Prisma, or the bot.

## Workflow

1. Salesperson logs an inquiry.
2. Procurement opens `/procurement` and sees an anonymised request: request ID, salesperson, product rows, quantities, tonnage, delivery region, date, and status. Customer name, company, and phone are intentionally absent from the `ProcurementRequest` type and mock data.
3. Procurement opens an Inquiries-style modal and enters a base price in Rs/MT for available product rows. On save, rows without a base price are inferred as unavailable; a note is optional.
4. Requests with products that still need pricing remain at the top of the queue. Multi-product requests may be **Partly Priced** when some products are priced and others cannot be priced.
5. Salesperson opens the inquiry in `/inquiries`, sees the Procurement ID, prices or unavailability reasons and procurement note, then completes transport, loading and margin for each product.

The pricing formula is:

`rate per MT = base price + transport + loading + margin`

`line amount = rate per MT × quantity in MT`. Maharashtra delivery shows CGST and SGST at 9% each; other states show IGST at 18%.

## Prototype controls

The sidebar's **Prototype demo** selector switches between Salesperson, Procurement, and Admin personas in `sessionStorage`. It does not modify the real auth token or employee record. The mock request store is `src/lib/procurementMock.ts`; replace that module with API calls when the backend contract exists.

## UI boundaries

- Procurement receives a dedicated tab and restricted route rather than a masked copy of the large Inquiries page.
- The Procurement modal includes an explicit customer-identity-hidden notice and only Procurement can edit base prices.
- Procurement queue statuses are UI-only: `Needs Pricing`, `Price Added`, `Partly Priced`, `Can't Price`, and `Quote Sent`. Inquiries show `Awaiting Price`, `Price Ready` (including partial availability), or `Unavailable` before Sales saves pricing. Sales can copy Transport, Loading, and Margin to available rows and preview a local-only decline email when no products are available.
