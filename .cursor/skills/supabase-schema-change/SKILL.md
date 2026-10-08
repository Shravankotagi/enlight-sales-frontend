---
name: supabase-schema-change
description: Changes Enlight Metals Supabase tables, columns, indexes, RLS policies, migrations, or application data contracts. Use for database schema and RLS work.
---
# Supabase schema change

Read `knowledge/00-overview/data-model.md` first. The Prisma schema does not represent most operational tables.

1. Locate the existing root `supabase-*.sql` convention and relevant table consumers in backend and bot.
2. Add a reviewable SQL migration/artifact: schema changes, backfill where required, indexes, grants/RLS policies, and rollback notes where feasible.
3. Check backend services, bot `supabase.js`/agents, frontend contracts, reporting/KRA queries, and Bigin mapping.
4. Never run mutating SQL against production by default. State target environment explicitly.
5. Update data model/module docs and test permission plus data-shape behavior.
