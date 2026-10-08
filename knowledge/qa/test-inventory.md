# Test inventory

## Standard commands
| Area | Safe baseline |
|---|---|
| Backend | `npm --prefix em-os-backend test`, `npm --prefix em-os-backend run lint`, `npm --prefix em-os-backend run build` |
| Bot | `npm --prefix em-os-bot test` (`node --test src/**/*.test.js`) |
| Frontend | `npm --prefix em-os-frontend run lint`, `npm --prefix em-os-frontend run build` (no automated test script is configured) |

## Targeted suites
- Backend unit specs include inquiries, KRA, deals, and app controller. E2E config is under `em-os-backend/test/`.
- Backend `src/scripts/` covers RBAC/RLS, chatbot, assistant operational parity, customer analytics, visits, complaints, products/HSN, KRA/tonnage, and PDF/voice work.
- Bot `src/core/poResolver.test.js` is a node test. `scripts/test-*.js` cover catalog, inquiries, order atomicity/parity, visits, complaints, query/retrieval, updates, and live flows.
- Root `docs/` and `em-os-backend/docs/` contain module-specific manual/testing suites.

## Safety classification
Many scripts use configured Supabase and can create/update/delete data. There is no repository-wide dry-run/test-mode switch. They are integration/operational scripts, not automatically safe unit tests. Inspect the script, use a dedicated safe environment where possible, and state the target database before running. Never run migration/cleanup scripts as a default QA command. In particular, `migrate-from-supabase.ts` truncates its target database and RLS/cleanup/migration scripts are operational mutators.
