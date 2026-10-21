# Inquiries, pipeline, and orders

`InquiriesPage.tsx` also supports the pipeline redirect (`/pipeline` → `/inquiries?view=pipeline`). Kanban cards show the deal's item count and total tonnage in MT, the same summary as the inquiry list, instead of each product line. `OrdersPage.tsx` displays won deals. They use `inquiriesApi`, `dealsApi`, `ordersApi`, and `productsApi` from `lib/api.ts`; detail and quoting use DealDetailDrawer, SalesQuotationModal, InquiryPdfModal, `AddProductDialog`, and System PO helpers.

In the Log New Inquiry form, Company Name and Email ID sit on one row. Email ID is optional. A document or the inquiry text fills it when an address is present, and the salesperson can change it. The same address is stored on the inquiry and prefills the Share Quotation customer email, which stays editable. Preferred Brand / Make and Payment Terms are dropdowns. Preferred makes are TATA, JSW, AM/NS India, SAIL, NMDC, Apollo, and Others. Payment terms on a new inquiry are Immediate, Advance, 30 Days, 45 Days, 60 Days, LC, BG, and PDC. A value filled by document parsing that is not in the list stays selectable. Recording an order uses the same eight options and does not accept any other payment term. Closing Record New Order without saving clears the form.

On Record New Order and Log New Inquiry, an attached PDF, JPEG, or PNG shows the file name, Change, and Remove while parsing is idle. Remove sits outside the file label. It clears every field that document extraction writes, including the inquiry's extracted JSON, and brings back the drop zone. Values typed into those fields are cleared with them. Remove does not release the order's system PO number or reservation. Starting another upload clears that previous extraction before the new document is parsed, and a parse that is still running is ignored.

Inquiry line items are checked against the standard HSN catalog and custom `products` rows. Unknown products leave HSN/SAC empty, block inquiry saving until resolved, and provide catalog suggestions plus product-add/list controls.

System PO allocation is a reservation protocol, not just a display field. Retain/release the reservation token correctly on success, cancel, retry, and conflicts. Keep inquiry status, deal stage, item data, and generated/reference PO fields consistent with backend/bot rules.

## Procurement pricing

Procurement and sales price the same inquiry. Procurement enters a base price per product. Sales adds transport, loading, credit, and margin, all in ₹/MT. The server stores `base + transport + loading + credit + margin`, then `rate × MT`. A blank credit is 0.

The inquiry list must not sync query results until the request has resolved. A pending or failed request leaves the query data unset, and a fresh empty-array default retriggers that sync on every render and freezes the page, including the sidebar. The inquiry drawer shows `Awaiting Price`, `Price Ready` (including partially available requests), or `Unavailable`. Sales quotes available products only, can copy Transport, Loading, and Margin to all available products, and can send a decline email when no products are available. Maharashtra delivery shows CGST 9% + SGST 9%; other states show IGST 18%.

## Procurement view

When accessed by users with `procurement_person` or `procurement_manager` roles:
- A procurement person sees inquiries stamped to them and unassigned inquiries for the salespeople assigned to them.
- A procurement manager also sees the team and the open unassigned pool (`status` in `new`, `pending`, `review`, `draft` where `procurement_employee_id` is null).
- Admins and procurement managers can assign or reassign an inquiry to a procurement team member.
- Commercial actions such as sending a quotation, converting to a deal, and marking won or lost stay hidden for procurement roles.
- The Orders page is hidden from procurement navigation, and its API routes are blocked for those roles.

