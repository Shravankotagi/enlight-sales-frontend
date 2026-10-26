# Inquiries and quotations

## Purpose
`InquiriesModule` manages early-stage customer demand in `inquiries` and `inquiry_items`, including intake, status/review queues, document/text parsing, quotation preview/send, and PDF generation.

## Interface
Frontend calls `/inquiries`, `/inquiries/:id`, `/inquiries/review-queue`, `/inquiries/stats`, `/inquiries/:id/status`, quotation preview/send endpoints, `/inquiries/generate-pdf`, `/inquiries/parse-document`, and `/inquiries/parse-text`.

### Procurement Scoping & Intake Pool
When an inquiry query is issued by a procurement role (`procurement_person` or `procurement_manager`), `InquiriesService` applies `procurementScope`:
- Assigned Inquiries: inquiries where `procurement_employee_id` matches the accessible procurement IDs.
- Unassigned Intake Pool: open inquiries where `stage IN ('new', 'pending', 'review', 'draft')` and `procurement_employee_id IS NULL`. Procurement specialists can view those inquiries and enter supplier base prices.

### Procurement Guardrails & Prohibitions
To preserve commercial integrity, procurement roles are strictly restricted:
- **Terminal Status Block**: Cannot transition inquiries to sales terminal states (`confirmed`, `won`, `lost`, `saved`, `processed`).
- **Deal Conversion Block**: Cannot create deals or convert inquiries to orders.
- **Quotation Block**: Preview and send stay forbidden unless `inquiries.send_quote` is on. Both procurement templates leave it off, so `POST /inquiries/quotation-preview/:id` and `POST /inquiries/send-quotation/:id` return `403 Forbidden` for a normal procurement user.
- **Deletion Rules**: Delete requires `inquiries.view` and `inquiries.delete`. The person template is off and the manager template is on. A manager may only delete inquiries assigned to their team (cannot delete from the unassigned pool).

### Quotation email CC contract
Quotation emails use the subject `Enlight Metals- Quotation for {customer name}`. The body greets the customer in capital letters, and the sent message is HTML with the company logo at the top and bottom. The quotation PDF attachment is unchanged. If the Share Quotation subject does not already start with `Enlight Metals- `, the backend adds that prefix before sending. Purchase-order emails keep their own template.

Quotation preview and send allow the inquiry when the caller's `employees.id` owns it, the same way line pricing does. A raw phone match is not enough. The Share Quotation modal shows the API `error` field when prepare or send fails.

`POST /inquiries/quotation-preview/:id` returns the resolved default `cc` list for the Share Quotation modal. The frontend may add extra CC chips, but `dj@enlightmetals.com` and `vedant@enlightmetals.com` are fixed: they cannot be removed, and the backend adds them to every quotation send even if the request omits them. The customer `To` address is still excluded from CC. If `cc` is omitted, the backend also keeps the sender on the default list.

The customer email is optional on an inquiry. Document parsing and text parsing store it as `ai_extraction_json.customer_email`. Share Quotation prefills that address in an editable field. The WhatsApp bot and the AI assistant collect the same optional Email ID when logging or updating an inquiry.

## Dependencies
Uses product/HSN/pricing rules, PDF generation and image/text parsing. Quotation PDFs from the dashboard and the bot print each line's Qty as metric tons (`39,897.63 KG` prints as `39.898 MT`), never the commercial unit. It feeds deals/order conversion and bot sales/OCR handling. Preserve server-side field authority and scoped queries when adding editable fields.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

## Procurement roles
Each inquiry has its own `procurement_number` (`PR-10001`, `PR-10002`, ...). That number is not derived from the inquiry id. New inquiries copy `employees.assigned_procurement_employee_id` from the salesperson onto `procurement_employee_id`. A procurement person also sees unassigned inquiries for those salespeople, matched by the salesperson phone's last 10 digits or `employee_id`. A row already owned by someone else stays with that owner. Apply `supabase-procurement-routing.sql` with the other procurement SQL files.

`pricing_status` is set to `awaiting_price` only when a new inquiry is created. Inquiries created before 15 Oct 2026 keep their original status: `supabase-pricing-status-preserve.sql` clears the column default and nulls `awaiting_price` on those rows when they have no saved line prices. The list shows the deal status when `pricing_status` is null.

`procurement_person` sees inquiries whose `procurement_employee_id` is their own employee id. `procurement_manager` also sees their team's rows and open unassigned inquiries (`new`, `pending`, `review`, `draft` with a null owner). Scope is applied in Node, not with a PostgREST `.or()`. They can save a base price only when `inquiries.view`, `inquiries.edit`, and `inquiries.fill_base_prices` are on, and only while the inquiry is Awaiting Price. A status change requires view and edit. A historical `awaiting_price` from before `2026-10-15T00:00:00+05:30` is not editable. Price Ready, Unavailable, and every later status stay read-only. They cannot create inquiries. Quotation preview and send require `inquiries.send_quote`, which stays off unless an admin grants it. They cannot move an inquiry to confirmed, won, or lost. Delete requires `inquiries.delete`, and a pool row still cannot be deleted. `inquiries.team_inquiries` uses the manager scope, `inquiries.scope_assigned` uses the person scope, and view with neither flag shows only inquiries stamped to that employee. A missing permissions object uses the role template. An inquiry owner is copied from the salesperson when the inquiry is created, or when that salesperson is routed to a procurement person. There is no control to assign or clear an owner on an existing inquiry.

The assistant uses this same scope. A procurement base-price reply follows `PATCH /inquiries/:id/procurement-pricing`: one priced line makes the inquiry `price_ready`, and every line blank makes it `unavailable`. That save does not replace credit, transport, loading, or margin. Sales then sends transport, loading, credit, and margin. The sell rate is `base + transport + loading + credit + margin`. The inquiry becomes `sales_priced`, and its stage becomes `quoted` (Price Quote) unless it is already Negotiation, On Hold, Won, or Lost. Apply `supabase-inquiry-line-credit.sql` before credit can be stored. The bot retries a pricing save without `credit_per_mt` when that column is missing.

`PATCH /inquiries/:id/procurement-pricing` stores base prices. `PATCH /inquiries/:id/sales-pricing` stores sales rates and GST. `POST /inquiries/:id/decline-preview` and `POST /inquiries/:id/decline-email` are available only when every line is unavailable. Procurement list and detail responses omit customer name, phone, email, sender fields, and raw text. They keep product lines, quantities, units, dimensions, delivery location, payment terms, salesperson name, `procurement_number`, and `linked_deal_stage`. That stage is the newest deal with the same `inquiry_id` (`created_at`, then `id`). The Inquiries dropdown uses it because procurement does not call `/deals`. A stage outside Won, Lost, Negotiation, Price Quote, On Hold, qualified, and hold is left unset. The inquiry list and drawer prefer those stored line items, including `original_quantity`, over a raw-text guess. Apply `supabase-inquiry-line-pricing.sql` before deploying these fields. The manual pass for procurement person, procurement manager, and salesperson is [qa/procurement-manual-test-suite.md](../qa/procurement-manual-test-suite.md).

Run `backend/supabase-procurement-acl.sql` before deploying the backend. The list and stats queries select `procurement_employee_id` and `procurement_assigned_at`, so those columns must exist or Inquiries fails for every role.
