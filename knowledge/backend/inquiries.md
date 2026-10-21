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
Quotation emails use the subject `Enlight Metals- Quotation for {customer name}`. The body greets the customer in capital letters, and the sent message is HTML with the company logo at the top and bottom. The quotation PDF attachment is unchanged. If the Share Quotation subject does not already start with `Enlight Metals- `, the backend adds that prefix before sending. Purchase-order emails keep their own template.

`POST /inquiries/quotation-preview/:id` returns the resolved default `cc` list for the Share Quotation modal. The frontend may add extra CC chips, but `dj@enlightmetals.com` and `vedant@enlightmetals.com` are fixed: they cannot be removed, and the backend adds them to every quotation send even if the request omits them. The customer `To` address is still excluded from CC. If `cc` is omitted, the backend also keeps the sender on the default list.

The customer email is optional on an inquiry. Document parsing and text parsing store it as `ai_extraction_json.customer_email`. Share Quotation prefills that address in an editable field. The WhatsApp bot and the AI assistant collect the same optional Email ID when logging or updating an inquiry.

## Dependencies
Uses product/HSN/pricing rules, PDF generation and image/text parsing. Quotation PDFs from the dashboard and the bot print each line's Qty as metric tons (`39,897.63 KG` prints as `39.898 MT`), never the commercial unit. It feeds deals/order conversion and bot sales/OCR handling. Preserve server-side field authority and scoped queries when adding editable fields.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

## Procurement roles
`procurement_person` sees inquiries whose `procurement_employee_id` is their own employee id. `procurement_manager` also sees their team's rows and open unassigned inquiries (`new`, `pending`, `review`, `draft` with a null owner). Scope is applied in Node, not with a PostgREST `.or()`. They can edit non-terminal inquiries and cannot create inquiries, send or preview quotations, or move an inquiry to confirmed, won, or lost. A manager can delete only rows already assigned to the team. `PATCH /inquiries/:id/procurement-assignee` assigns an owner; admins are unrestricted, managers only within their team.

Run `backend/supabase-procurement-acl.sql` before deploying the backend. The list and stats queries select `procurement_employee_id` and `procurement_assigned_at`, so those columns must exist or Inquiries fails for every role.
