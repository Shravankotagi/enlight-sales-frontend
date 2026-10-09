---
name: qa-testing
description: Tests and verifies Enlight Metals OS backend, bot, frontend, and end-to-end workflows. Use when changing or validating code, bugs, modules, APIs, agents, flows, or regressions.
---
# QA testing

Read `knowledge/qa/test-inventory.md` and the relevant module/flow doc first.

1. Identify changed apps and whether the path is read-only or mutating.
2. Run the offline automated suites first (same as CI, no `.env` needed).
3. For bug fixes, confirm a regression test exists in the repo's regression folder and fails without the fix.
4. Use targeted integration scripts only after reading them. Many `src/scripts/` and `scripts/test-*.js` use the configured Supabase database and can mutate data.
5. Verify the happy path, invalid input, empty result, role/salesperson scope, and retry/idempotency behavior where relevant.
6. Report commands, outcomes, and any verification not run.

## Baseline commands (what CI runs)
```bash
npm --prefix em-os-backend run lint
npm --prefix em-os-backend run build
npm --prefix em-os-backend run test:ci
npm --prefix em-os-bot test
npm --prefix em-os-frontend run typecheck
npm --prefix em-os-frontend run test:ci
npm --prefix em-os-frontend run build
```

Use `knowledge/qa/regression-checklists.md` as the definition-of-done checklist.
