# Zoho Bigin integration

`ZohoModule` wraps Bigin CRM access and webhooks. `zoho.service.ts` performs integration work; `zoho-webhook.controller.ts` handles inbound CRM events; `zoho.controller.ts` includes actions such as initial pull sync. Bot `biginSyncAgent.js` implements a second integration surface.

Changes must account for duplicate prevention, field mapping, ownership mapping, pagination/rate limits, webhook authenticity, and `crm_sync_log`. The backend sync has environment kill switches including `ZOHO_SYNC_PAUSED`, `ZOHO_AUTO_SYNC_ENABLED`, and `ZOHO_READ_ONLY_MODE`. Test against safe data; sync can mutate operational records.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
