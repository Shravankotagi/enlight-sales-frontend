# KRA, visits, and complaints

`KraModule` groups operational KRA dashboard, logs, action queue, visits, and complaints. Core tables are `kra_logs`, `customer_visits`, `followup_tasks`, `complaints`, and `complaint_attachments`.

The dashboard uses `/kra/dashboard`, `/kra/sheets`, `/kra/logs`, `/kra/action-queue`; visit endpoints `/kra/visits`, `/kra/visits/otp/request`, `/kra/visits/otp/verify`, and `/kra/visits/reverse-geocode`; complaint endpoints `/kra/complaints`. New dashboard visits require a consumed phone-verification token, a GPS photo, and the standardized brand and payment lists. A failed visit-code send logs Meta's error code, subcode, and message with the phone reduced to its last four digits. Meta `131047` tells the user the number has not messaged the business WhatsApp in the last 24 hours, and `131026` tells them the number could not be reached. Any other code returns that code and Meta's message in the 400, with long digit runs removed. A new bot visit uses the same phone-code table before saving. The bot still writes the visit row itself. Preserve exact follow-up status/date semantics and authorization filtering when adding fields. See [../../flows/kra-computation.md](../flows/kra-computation.md) and [../../flows/visit-lifecycle-and-followups.md](../flows/visit-lifecycle-and-followups.md).

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
