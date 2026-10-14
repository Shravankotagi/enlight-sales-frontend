# CRM Bigin synchronization

Backend Zoho services/webhooks and bot `biginSyncAgent` synchronize operational records with Zoho Bigin. A sync maps fields and ownership, reads/writes remote data, and should maintain `crm_sync_log` to diagnose duplicates/failures. Handle webhooks as retryable/untrusted external inputs. Before changing mapping, inspect both sync implementations and run only safe targeted tests.
