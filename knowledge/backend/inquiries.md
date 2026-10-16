# Inquiries and quotations

## Purpose
`InquiriesModule` manages early-stage customer demand in `inquiries` and `inquiry_items`, including intake, status/review queues, document/text parsing, quotation preview/send, and PDF generation.

## Interface
Frontend calls `/inquiries`, `/inquiries/:id`, `/inquiries/review-queue`, `/inquiries/stats`, `/inquiries/:id/status`, `/inquiries/:id/procurement-assignee`, quotation preview/send endpoints, `/inquiries/generate-pdf`, `/inquiries/parse-document`, and `/inquiries/parse-text`.

### Procurement Assignment Endpoint
- `PATCH /inquiries/:id/procurement-assignee`:
  - Body: `{ procurementEmployeeId: string | null }`
  - Allowed for `admin` and `procurement_manager` (reassigning within their team).
  - Sets `inquiries.procurement_employee_id` and stamps `inquiries.procurement_assigned_at = NOW()`.
  - Passing `null` returns the inquiry to the unassigned intake pool.

### Procurement Scoping & Intake Pool
When an inquiry query is issued by a procurement role (`procurement_person` or `procurement_manager`), `InquiriesService` applies `procurementScope`:
- Assigned Inquiries: inquiries where `procurement_employee_id` matches the accessible procurement IDs.
- Unassigned Intake Pool: open inquiries where `stage IN ('new', 'pending', 'review', 'draft')` and `procurement_employee_id IS NULL`. This allows procurement specialists to view and claim incoming demands or populate supplier base prices.

### Procurement Guardrails & Prohibitions
To preserve commercial integrity, procurement roles are strictly restricted:
- **Terminal Status Block**: Cannot transition inquiries to sales terminal states (`confirmed`, `won`, `lost`, `saved`, `processed`).
- **Deal Conversion Block**: Cannot create deals or convert inquiries to orders.
- **Quotation Block**: Cannot preview or send customer sales quotations (`POST /inquiries/quotation-preview/:id` and `POST /inquiries/send-quotation/:id` return `403 Forbidden`).
- **Deletion Rules**: `procurement_person` cannot delete inquiries. `procurement_manager` may only delete inquiries assigned to their team (cannot delete from the unassigned pool).

### Quotation email CC contract
`POST /inquiries/quotation-preview/:id` returns the resolved default `cc` list for the Share Quotation modal. The frontend may edit that list as normalized email chips and sends the final list as `cc: string[]` to `POST /inquiries/send-quotation/:id`. The backend validates and deduplicates submitted addresses, excludes the primary `customer_email`, and passes the resulting list to the email provider. If `cc` is omitted, the backend retains the existing default recipients.

## Dependencies
Uses product/HSN/pricing rules, PDF generation and image/text parsing. Quotation PDFs from the dashboard and the bot print each line's Qty as metric tons (`39,897.63 KG` prints as `39.898 MT`), never the commercial unit. It feeds deals/order conversion and bot sales/OCR handling. Preserve server-side field authority and scoped queries when adding editable fields.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

## Procurement roles
Each inquiry has its own `procurement_number` (`PR-10001`, `PR-10002`, ...). That number is not derived from the inquiry id. New inquiries copy `employees.assigned_procurement_employee_id` from the salesperson onto `procurement_employee_id`. A procurement person also sees unassigned inquiries for those salespeople, matched by the salesperson phone's last 10 digits or `employee_id`. A row already owned by someone else stays with that owner. Apply `supabase-procurement-routing.sql` with the other procurement SQL files.

`pricing_status` is set to `awaiting_price` only when a new inquiry is created. Inquiries created before 15 Oct 2026 keep their original status: `supabase-pricing-status-preserve.sql` clears the column default and nulls `awaiting_price` on those rows when they have no saved line prices. The list shows the deal status when `pricing_status` is null.

`procurement_person` sees inquiries whose `procurement_employee_id` is their own employee id. `procurement_manager` also sees their team's rows and open unassigned inquiries (`new`, `pending`, `review`, `draft` with a null owner). Scope is applied in Node, not with a PostgREST `.or()`. They can edit non-terminal inquiries and cannot create inquiries, send or preview quotations, or move an inquiry to confirmed, won, or lost. A manager can delete only rows already assigned to the team. `PATCH /inquiries/:id/procurement-assignee` assigns an owner; admins are unrestricted, managers only within their team.

The assistant uses this same scope. A procurement base-price reply follows `PATCH /inquiries/:id/procurement-pricing`: one priced line makes the inquiry `price_ready`, and every line blank makes it `unavailable`. That save does not replace credit, transport, loading, or margin. Sales then sends transport, loading, credit, and margin. The sell rate is `base + transport + loading + credit + margin`, and the inquiry becomes `sales_priced`. Apply `supabase-inquiry-line-credit.sql` before credit can be stored. The bot retries a pricing save without `credit_per_mt` when that column is missing.

`PATCH /inquiries/:id/procurement-pricing` stores base prices. `PATCH /inquiries/:id/sales-pricing` stores sales rates and GST. `POST /inquiries/:id/decline-preview` and `POST /inquiries/:id/decline-email` are available only when every line is unavailable. Procurement list and detail responses omit customer name, phone, email, sender fields, and raw text. They keep product lines, quantities, units, dimensions, delivery location, payment terms, salesperson name, and `procurement_number`. The inquiry list and drawer prefer those stored line items, including `original_quantity`, over a raw-text guess. Apply `supabase-inquiry-line-pricing.sql` before deploying these fields. The manual pass for procurement person, procurement manager, and salesperson is [qa/procurement-manual-test-suite.md](../qa/procurement-manual-test-suite.md).

Run `backend/supabase-procurement-acl.sql` before deploying the backend. The list and stats queries select `procurement_employee_id` and `procurement_assigned_at`, so those columns must exist or Inquiries fails for every role.
