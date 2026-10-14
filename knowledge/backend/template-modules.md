# Template and support modules

These Nest modules mainly use the Prisma template schema and generic admin patterns: `users`, `admins`, `plans`, `professions`, `interests`, `addresses`, `companies`, and `health`.

- `admins` includes seed helpers and adapters.
- `users` links plans, professions, interests, and addresses.
- `health` provides service/database health reporting.

Before extending them, verify whether new functionality belongs in the older Prisma model set or the active Supabase operational schema. Mixing the two without a migration path creates invisible data.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
