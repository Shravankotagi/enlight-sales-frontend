---
name: debugging
description: Diagnoses a bug across Enlight Metals frontend, NestJS backend, WhatsApp/web bot, Supabase, CRM, and AI integrations. Use when tracing errors, unexpected data, failed flows, or production-like issues.
---
# Cross-system debugging

1. Identify the user action, channel, stable entity ID, masked phone, timestamp, and expected versus actual result.
2. Read the related `knowledge/flows/` doc; trace frontend/API or webhook → orchestrator/tool → Supabase/CRM.
3. Inspect safe structured logs and database state without exposing sensitive content.
4. Confirm identity/scope, current entity stage/status, pending state/session, and external response boundaries.
5. Make the narrowest verified fix; add only useful safe logs; run targeted QA.

Do not use production-like scripts that mutate data merely to inspect an issue.
