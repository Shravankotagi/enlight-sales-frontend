# Inquiry-to-order flow

1. An inquiry is created through dashboard APIs, bot sales/catalog/OCR flow, or document parsing; data is stored in `inquiries`/`inquiry_items`.
2. Sourcing & Base Pricing: Procurement specialists claim inquiries or access the unassigned intake pool to populate supplier base prices (`inquiry_items.base_price_per_unit`). Admins and Procurement Managers assign owners via `PATCH /inquiries/:id/procurement-assignee`.
3. Products, HSN, pricing, and quotation are evaluated under shared business rules. Quotations can only be generated and dispatched by sales personnel or admins.
4. A commercial record progresses through deal/pipeline stages in `deals`/`deal_items`. Procurement roles cannot create deals or confirm orders.
5. System PO allocation uses a reservation token; processing persists generated/reference PO fields and finalizes/release behavior.
6. A won deal is rendered as an order by `OrdersPage` (restricted to sales personnel and admins).

Do not conflate inquiry identifier, deal identifier, purchase-order number, and reservation token. Validate current database state on every transition because bot/UI context may be stale.
