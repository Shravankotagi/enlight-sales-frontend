---
name: backend-feature
description: Adds or changes an Enlight Metals NestJS API module, endpoint, service, controller, authorization rule, or Supabase-backed workflow. Use for backend feature work.
---
# Backend feature workflow

1. Read `knowledge/backend/README.md`, the affected module guide, and `knowledge/00-overview/data-model.md`.
2. Trace controller → guard/decorator → service → Supabase query; preserve response transform/error filter behavior.
3. Enforce salesperson/manager/admin scope on the server, not the frontend.
4. Update `em-os-frontend/src/lib/api.ts` and consumer UI only when the REST contract changes.
5. Test role cases and update the relevant knowledge/flow documents.

Use `supabase-schema-change` for any schema/RLS work; do not silently alter operational tables through application code.
