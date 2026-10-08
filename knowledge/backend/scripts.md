# Backend scripts, migrations, and tests

`src/scripts/` contains targeted migration, diagnosis, and operational test scripts (RBAC, chatbot, visits, customer analytics, KRA metrics, catalog/product identification, PDF extraction, and RLS phases). The backend root also contains `supabase-*.sql` rollout scripts.

Many scripts are not isolated test fixtures: they can read from or mutate the configured Supabase database. Read the script and use a safe environment before executing. Standard unit/e2e specs live under `src/**/*.spec.ts` and `test/`; package scripts include `npm test`, `npm run test:rbac`, and `npm run test:guardrails`.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
