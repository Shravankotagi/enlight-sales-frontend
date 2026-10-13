# Inquiries, pipeline, and orders

`InquiriesPage.tsx` also supports the pipeline redirect (`/pipeline` → `/inquiries?view=pipeline`). `OrdersPage.tsx` displays won deals. They use `inquiriesApi`, `dealsApi`, and `ordersApi` from `lib/api.ts`; detail and quoting use DealDetailDrawer, SalesQuotationModal, InquiryPdfModal, and System PO helpers.

System PO allocation is a reservation protocol, not just a display field. Retain/release the reservation token correctly on success, cancel, retry, and conflicts. Keep inquiry status, deal stage, item data, and generated/reference PO fields consistent with backend/bot rules.

## Procurement pricing prototype

The frontend-only Procurement prototype links each inquiry to a session-storage mock procurement request. Procurement enters base price per product in `/procurement`; Sales completes base price, transport, loading and margin, all in ₹/MT. The per-product formula is `base + transport + loading + margin`, then `rate × MT`.

The inquiry drawer starts with the four editable price columns and progresses from `Awaiting Price` to `Price Ready` (including partially available requests), `Unavailable`, or a saved price quote. Sales quotes available products only, can copy Transport, Loading, and Margin to all available products, and can preview a local-only polite decline email when no products are available. After Sales saves every available product, the fields collapse into a clickable Rate breakdown and a GST column. Maharashtra delivery shows CGST 9% + SGST 9%; other states show IGST 18%, consistently in both the row and subtotal. This prototype does not call the backend, database, or bot.
