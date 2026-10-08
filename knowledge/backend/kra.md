# KRA, visits, and complaints

`KraModule` groups operational KRA dashboard, logs, action queue, visits, and complaints. Core tables are `kra_logs`, `customer_visits`, `followup_tasks`, `complaints`, and `complaint_attachments`.

The dashboard uses `/kra/dashboard`, `/kra/sheets`, `/kra/logs`, `/kra/action-queue`; visit endpoints `/kra/visits`; complaint endpoints `/kra/complaints`. The bot writes several of these directly. Preserve exact follow-up status/date semantics and authorization filtering when adding fields. See [../../flows/kra-computation.md](../flows/kra-computation.md) and [../../flows/visit-lifecycle-and-followups.md](../flows/visit-lifecycle-and-followups.md).

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
