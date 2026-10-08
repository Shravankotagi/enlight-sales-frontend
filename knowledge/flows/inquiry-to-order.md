# Inquiry-to-order flow

1. An inquiry is created through dashboard APIs, bot sales/catalog/OCR flow, or document parsing; data is stored in `inquiries`/`inquiry_items`.
2. Products, HSN, pricing, and quotation are evaluated under shared business rules.
3. A commercial record progresses through deal/pipeline stages in `deals`/`deal_items`.
4. System PO allocation uses a reservation token; processing persists generated/reference PO fields and finalizes/release behavior.
5. A won deal is rendered as an order by `OrdersPage`.

Do not conflate inquiry identifier, deal identifier, purchase-order number, and reservation token. Validate current database state on every transition because bot/UI context may be stale.
