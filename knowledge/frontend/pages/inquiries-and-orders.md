# Inquiries, pipeline, and orders

`InquiriesPage.tsx` also supports the pipeline redirect (`/pipeline` → `/inquiries?view=pipeline`). `OrdersPage.tsx` displays won deals. They use `inquiriesApi`, `dealsApi`, `ordersApi`, and `productsApi` from `lib/api.ts`; detail and quoting use DealDetailDrawer, SalesQuotationModal, InquiryPdfModal, `AddProductDialog`, and System PO helpers.

Inquiry line items are checked against the standard HSN catalog and custom `products` rows. Unknown products leave HSN/SAC empty, block inquiry saving until resolved, and provide catalog suggestions plus product-add/list controls.

System PO allocation is a reservation protocol, not just a display field. Retain/release the reservation token correctly on success, cancel, retry, and conflicts. Keep inquiry status, deal stage, item data, and generated/reference PO fields consistent with backend/bot rules.

## Procurement pricing

Procurement and sales price the same inquiry. Procurement enters a base price per product. Sales completes base price, transport, loading, and margin, all in ₹/MT. The server stores `base + transport + loading + margin`, then `rate × MT`.

The inquiry list must not sync query results until the request has resolved. A pending or failed request leaves the query data unset, and a fresh empty-array default retriggers that sync on every render and freezes the page, including the sidebar. The inquiry drawer shows `Awaiting Price`, `Price Ready` (including partially available requests), or `Unavailable`. Sales quotes available products only, can copy Transport, Loading, and Margin to all available products, and can send a decline email when no products are available. Maharashtra delivery shows CGST 9% + SGST 9%; other states show IGST 18%.

## Procurement view

When accessed by users with `procurement_person` or `procurement_manager` roles:
- A procurement person sees inquiries stamped to them and unassigned inquiries for the salespeople assigned to them.
- A procurement manager also sees the team and the open unassigned pool (`status` in `new`, `pending`, `review`, `draft` where `procurement_employee_id` is null).
- Admins and procurement managers can assign or reassign an inquiry to a procurement team member.
- Commercial actions such as sending a quotation, converting to a deal, and marking won or lost stay hidden for procurement roles.
- The Orders page is hidden from procurement navigation, and its API routes are blocked for those roles.

