## What and why
<!-- Link the issue: Fixes #123 -->

## Regression test (required for bug fixes)
- [ ] Added `src/test/regression/issue-<n>-<slug>.test.tsx` that fails without this fix and passes with it
- Test file: <!-- path, or "N/A – not a bug fix" with reason -->

## Checklist
- [ ] `npm run typecheck`, `npm run test:ci`, `npm run build` pass locally; changed files lint clean
- [ ] Backend/bot still enforce authorization (frontend filters are not security)
- [ ] Pricing/HSN changes mirrored in backend + bot and all three `pricing-parity.json` copies
- [ ] No secrets, tokens, or full phone numbers in code, logs, or tests
- [ ] `knowledge/` updated if an API, table, workflow, or test contract changed
