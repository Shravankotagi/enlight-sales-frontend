# Inquiries and quotations

## Purpose
`InquiriesModule` manages early-stage customer demand in `inquiries` and `inquiry_items`, including intake, status/review queues, document/text parsing, quotation preview/send, and PDF generation.

## Interface
Frontend calls `/inquiries`, `/inquiries/:id`, `/inquiries/review-queue`, `/inquiries/stats`, `/inquiries/:id/status`, quotation preview/send endpoints, `/inquiries/generate-pdf`, `/inquiries/parse-document`, and `/inquiries/parse-text`.

### Quotation email CC contract
`POST /inquiries/quotation-preview/:id` returns the resolved default `cc` list for the Share Quotation modal. The frontend may edit that list as normalized email chips and sends the final list as `cc: string[]` to `POST /inquiries/send-quotation/:id`. The backend validates and deduplicates submitted addresses, excludes the primary `customer_email`, and passes the resulting list to the email provider. If `cc` is omitted, the backend retains the existing default recipients.

## Dependencies
Uses product/HSN/pricing rules, PDF generation and image/text parsing. Quotation PDFs from the dashboard and the bot print each line's Qty as metric tons (`39,897.63 KG` prints as `39.898 MT`), never the commercial unit. It feeds deals/order conversion and bot sales/OCR handling. Preserve server-side field authority and scoped queries when adding editable fields.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
