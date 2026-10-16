# Procurement pricing

Procurement users work on `/inquiries`. `/procurement` redirects there. Customer name, phone, email, and raw inquiry text are removed from procurement API responses. Product lines, quantity, unit, and delivery location stay. The inquiry id and the procurement number (`PR-10001`) are both shown. The procurement number is the pricing-case id. The inquiries search matches that number, the salesperson, the product lines, and the delivery location. Kanban View opens the pipeline on the first click.

A procurement person or procurement manager can edit only the base price. Description, HSN, and quantity are read-only. Transport, loading, credit, and margin are hidden. The drawer has one save control for them: Save Prices. A blank base price also has an optional note, stored as the reason that line is unavailable. A salesperson still has Save Prices and the footer Save. The drawer has one quotation button, Send quotation, which becomes Share Again after a quotation has already gone out. The email modal keeps its header and actions visible and scrolls the message. After the salesperson save, base, transport, loading, credit, and margin collapse into the Rate column. Credit is rupees per MT and is added into the rate; a blank credit is zero. The rate cell still opens those five components, and a later inquiry refresh does not replace that saved rate with zero. The GST column uses the same tax split as the total, so a saved row shows 18% IGST, or CGST and SGST inside Maharashtra, instead of zero.

An admin assigns salespeople to a procurement person in the control panel. Inquiries for those salespeople are created with that person's `procurement_employee_id`. A procurement manager sees every inquiry stamped to a person on their team, plus unassigned inquiries for those persons' salespeople in any status.

## Workflow

1. A new inquiry starts as `awaiting_price`.
2. Procurement saves base prices with `PATCH /inquiries/:id/procurement-pricing`. A positive base price is available. A blank base price is unavailable.
3. At least one available line makes the inquiry `price_ready`. Every line blank makes it `unavailable`.
4. Sales saves transport, loading, credit, and margin with `PATCH /inquiries/:id/sales-pricing`. The server stores `rate = base + transport + loading + credit + margin` and the GST split. A blank credit is 0. Maharashtra is CGST 9% + SGST 9%. Every other delivery state is IGST 18%. The same step is available in the assistant with *Price this inquiry* once the inquiry is `price_ready`.
5. Quotation sending uses those saved rates for available lines. When every line is unavailable, sales can preview and send a decline email.

Procurement cannot create inquiries, send quotations, or move an inquiry to confirmed, won, or lost. The same limits apply in WhatsApp and the AI Assistant. There they can list pending and current inquiries, log a base price, and, for a manager, see the team. A later base-price save does not wipe credit, transport, loading, or margin. Apply `supabase-inquiry-line-credit.sql` before credit can be stored.

The manual role pass is [qa/procurement-manual-test-suite.md](../../qa/procurement-manual-test-suite.md). Automated coverage is listed in [qa/test-inventory.md](../../qa/test-inventory.md).
