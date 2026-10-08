---
name: qa-testing
description: Tests and verifies Enlight Metals OS backend, bot, frontend, and end-to-end workflows. Use when changing or validating code, bugs, modules, APIs, agents, flows, or regressions.
---
# QA testing

Read `knowledge/qa/test-inventory.md` and the relevant module/flow doc first.

1. Identify changed apps and whether the path is read-only or mutating.
2. Run the smallest safe automated check first: backend Jest/lint/build, bot node test, frontend lint/build.
3. Use targeted integration scripts only after reading them. Many `src/scripts/` and `scripts/test-*.js` use the configured Supabase database and can mutate data.
4. Verify the happy path, invalid input, empty result, role/salesperson scope, and retry/idempotency behavior where relevant.
5. Report commands, outcomes, and any verification not run.

## Baseline commands
```bash
npm --prefix em-os-backend test
npm --prefix em-os-backend run lint
npm --prefix em-os-backend run build
npm --prefix em-os-bot test
npm --prefix em-os-frontend run lint
npm --prefix em-os-frontend run build
```

Use `knowledge/qa/regression-checklists.md` as the definition-of-done checklist.
