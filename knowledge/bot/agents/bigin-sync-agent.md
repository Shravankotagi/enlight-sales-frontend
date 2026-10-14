# Bigin sync agent

`src/agents/biginSyncAgent.js` performs outbound and inbound Zoho Bigin synchronization. It maps database records, handles pull/sync operations, and should record/consult `crm_sync_log`. Safeguard duplicate handling, remote rate limits, owner mapping, retry behavior, and field mappings.
