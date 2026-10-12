# Inquiries, pipeline, and orders

`InquiriesPage.tsx` also supports the pipeline redirect (`/pipeline` → `/inquiries?view=pipeline`). `OrdersPage.tsx` displays won deals. They use `inquiriesApi`, `dealsApi`, and `ordersApi` from `lib/api.ts`; detail and quoting use DealDetailDrawer, SalesQuotationModal, InquiryPdfModal, and System PO helpers.

System PO allocation is a reservation protocol, not just a display field. Retain/release the reservation token correctly on success, cancel, retry, and conflicts. Keep inquiry status, deal stage, item data, and generated/reference PO fields consistent with backend/bot rules.

## Procurement pricing prototype

The frontend-only Procurement prototype adds a `ProcurementPricingPanel` to the salesperson inquiry drawer. Procurement enters a base price in the dedicated `/procurement` queue; Sales then adds transport in Rs/MT and margin as a percentage. The displayed formula is `(base + transport) × (1 + margin%) × quantity`, followed by the existing GST breakdown. The prototype uses session storage mock data and does not call the backend, database, or bot.
