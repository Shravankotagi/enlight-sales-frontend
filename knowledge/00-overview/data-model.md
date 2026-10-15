# Operational data model

Supabase is the operational store. Calls to `supabase.from()` are the live authority; Prisma models only cover legacy/template entities such as Company, Plan, Profession, Interest, Address, and their join tables.

## Core table families

| Family | Main tables | Used for |
|---|---|---|
| Commercial | `inquiries`, `inquiry_items`, `deals`, `deal_items`, `rate_sheets`, `rate_sheet_items`, `floor_margins`, `products` | quotation, negotiation, system PO, won orders, pricing |
| CRM | `recurring_customers`, `employees`, `customer_visits`, `followup_tasks`, `crm_sync_log`, `visit_phone_verifications` | customer ownership, field visits, team scope, Bigin sync, visit phone codes |
| Operations | `complaints`, `complaint_attachments`, `payment_tracking`, `activity_logs`, `audit_log` | post-sales work and auditable activity |
| Assistant | `conversation_sessions`, `chat_sessions`, `chat_messages`, `kb_documents`, `kb_chunks`, `daily_llm_usage` | assistant history, retrieval, knowledge base, quotas |
| Metrics | `kra_logs` | KRA calculation and dashboard data |
| Auth | `otp_sessions` | OTP verification lifecycle |

## Sources of schema truth
Read the `supabase-*.sql` files at the backend root and bot root before changing a table. Notable rollout files include phase migrations/RLS (`supabase-phase0-migrations.sql`, `supabase-phase2-rls.sql`, `supabase-phase3-kb-rls.sql`, `supabase-phase4-guardrails.sql`), System PO, pricing, manager columns, KRA tables, and visit phone verification (`supabase-visit-verification.sql`).

## Authorization caveat
Checked-in RLS rollout SQL covers deals/deal items, recurring customers, payment tracking, KB tables/chunks, and daily LLM usage. It does not cover every operational table (notably inquiries, visits, complaints, employees, KRA logs, CRM sync logs, and conversation sessions). Backend/bot service-role clients bypass RLS, so service-level employee/phone scope checks remain mandatory.

RLS policies are part of the contract. A schema change needs an explicit migration/SQL artifact, policy review, application query review, and an update to this doc. See `.cursor/skills/supabase-schema-change/SKILL.md`.
