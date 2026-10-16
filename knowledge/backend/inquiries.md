# Inquiries and quotations

## Purpose
`InquiriesModule` manages early-stage customer demand in `inquiries` and `inquiry_items`, including intake, status/review queues, document/text parsing, quotation preview/send, and PDF generation.

## Interface
Frontend calls `/inquiries`, `/inquiries/:id`, `/inquiries/review-queue`, `/inquiries/stats`, `/inquiries/:id/status`, quotation preview/send endpoints, `/inquiries/generate-pdf`, `/inquiries/parse-document`, and `/inquiries/parse-text`.

### Quotation email CC contract
Quotation emails use the subject `Enlight Metals- Quotation for {customer name}`. The body greets the customer in capital letters, and the sent message is HTML with the company logo at the top and bottom. The quotation PDF attachment is unchanged. If the Share Quotation subject does not already start with `Enlight Metals- `, the backend adds that prefix before sending. Purchase-order emails keep their own template.

`POST /inquiries/quotation-preview/:id` returns the resolved default `cc` list for the Share Quotation modal. The frontend may add extra CC chips, but `dj@enlightmetals.com` and `vedant@enlightmetals.com` are fixed: they cannot be removed, and the backend adds them to every quotation send even if the request omits them. The customer `To` address is still excluded from CC. If `cc` is omitted, the backend also keeps the sender on the default list.

## Dependencies
Uses product/HSN/pricing rules, PDF generation and image/text parsing. Quotation PDFs from the dashboard and the bot print each line's Qty as metric tons (`39,897.63 KG` prints as `39.898 MT`), never the commercial unit. It feeds deals/order conversion and bot sales/OCR handling. Preserve server-side field authority and scoped queries when adding editable fields.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
