# Test inventory

## Automated suite (runs in CI on every PR)
Every repo has an offline suite: Supabase, Prisma, and LLM calls are mocked and outbound network access throws, so no `.env` or secrets are needed. The same commands run in `.github/workflows/ci.yml`; see [ci-and-branch-protection.md](ci-and-branch-protection.md).

| Area | Commands (what CI runs) | Runner |
|---|---|---|
| Backend | `npm run lint`, `npm run build`, `npm run test:ci` | Jest + ts-jest, `src/**/*.(spec\|test).ts` |
| Bot | `node --check` on every source file, `npm test` | `node:test`, `src/**/*.test.js` + `test/**/*.test.js` |
| Frontend | ESLint on changed files, `npm run typecheck`, `npm run test:ci`, `npm run build` | Vitest + Testing Library (jsdom), `src/**/*.test.{ts,tsx}` |

Faster local loops: backend `npm test` / `npm run test:regression`, bot `npm run test:regression`, frontend `npm test` (watch mode) / `npm run test:regression`.

## Layout and helpers
| Repo | Unit / integration | Regression tests | Mock helpers |
|---|---|---|---|
| Backend | co-located `*.spec.ts` | `src/__regression__/` | `src/test-utils/` (`createSupabaseMock`, `asSupabaseService`, network guard in `setup.ts`) |
| Bot | `test/unit/`, `test/integration/`, existing `src/**/*.test.js` | `test/regression/` | `test/helpers/` (`createSupabaseMock`, `loadWithMocks`, `loadCatalogFlow`), network guard in `test/setup.js` |
| Frontend | co-located `*.test.ts(x)` | `src/test/regression/` | `src/test/` (`renderWithProviders`, `supabaseMock`, `adminDashboardMocks`), network guard in `setup.ts` |

- Bot modules are mocked by injecting into `require.cache` via `loadWithMocks(target, { 'supabase': fake, ... })`; keys are paths relative to `src/`.
- Frontend pages mock `lib/api` with `vi.mock` and a stable mock module (see `src/test/adminDashboardMocks.ts`) and render through `renderWithProviders`.

## Coverage today
- Backend: employee phone helpers and salesperson scope (`getAccessibleSalespersonPhones`), `RolesGuard`/`RoleGuard`, report date ranges and `allowedPhones` scope, leaderboard identity, pricing parity, plus the existing deals/inquiries/KRA/reports/app specs.
- Bot: JSON utils, pricing engine, HSN detector, pricing parity, catalog-flow helpers, new-customer catalog flow state machine, PO resolver, network guard.
- Frontend: date utilities and presets, `DateFilterControl`, pricing parity, `systemPo`, Admin Overview leaderboard scoring/identity/info popover/drill-in, date filters, Review Queue removal, recent order fields/navigation, the new customer visit form, customer-profile GSTIN validation, and `Layout.sidebar` (sidebar 200ms ease-out timing, `will-change-[width,transform]`, reduced motion safety, `localStorage` persistence, and hover enlargement/collapse).

## Regression tests: one per fixed bug
Every bug fix adds a test that fails before the fix and passes after it.
- File name: `issue-<number>-<short-slug>.test.(js|ts|tsx)` in the repo's regression folder; first line links the GitHub issue.
- Retroactive tests written before issue numbers were known use `<short-slug>.test.*` with an `Issue: <add GitHub issue link>` header; rename them when the issue is linked.
- Assert the user-visible contract (reply text/buttons, rendered labels, query params, returned rows), not implementation details.
- Never delete or weaken a regression test to make CI pass; if behavior intentionally changes, update the test in the same PR and say why.

Current regression tests:
| Repo | File | Guards |
|---|---|---|
| Bot | `duplicate-customer-discard-draft.test.js` | Duplicate-customer warning shows only **Discard Draft**; blocked state ignores other text; discard finalizes the draft |
| Backend | `leaderboard-salesperson-identity.test.ts` | Mixed phone formats resolve to one named row; never "Unknown" |
| Frontend | `admin-leaderboard-identity-and-orders.test.tsx` | Leaderboard shows names/IDs/phones, counts orders (not deals), excludes admins |
| Frontend | `admin-overview-date-filters.test.tsx` | No standalone Month filter; every preset sends `{from, to}` to all Overview queries |
| Frontend | `admin-overview-recent-orders.test.tsx` | Review Queue is absent; recent filtered orders show order details and navigate to Orders |
| Backend | `issue-238-customer-visit-form.test.ts` | New visits require a verified phone, GPS photo, and listed brand and payment terms; Meta 131047 returns the 24-hour message, and other codes return the code in the 400 |
| Frontend | `issue-238-customer-visit-form.test.tsx` | Missing visit fields, locked GPS address, typed city when the address is missing, brand dropdown, camera overlay, and the assistant attach menu |
| Bot | `issue-238-visit-required-fields.test.js` | A new bot visit is not inserted until the new fields, GPS photo, and correct code are present |
| Frontend | `invalid-gstin-customer-edit.test.tsx` | Profile edit modal does not set state from a partial or invalid GSTIN, shows an error, blocks save, and still fills state from a valid GSTIN |

## Cross-repo parity fixture
`pricing-parity.json` is copied identically to `em-os-bot/test/fixtures/`, `em-os-backend/src/test-utils/fixtures/`, and `em-os-frontend/src/test/fixtures/`. Each repo's parity test runs its own pricing/HSN code against it. Change all three copies together in the same set of PRs.

Known divergences are listed under `knownDivergences` and run as `todo` tests until a business decision is made:
- KG rate: bot treats the rate as per-kg (500 kg @ 60 = 30000); backend/frontend treat it as per-MT (= 30).
- `pcs` unit: bot normalizes to `Nos`, backend/frontend to `Pcs`.
- Empty product: bot returns no HSN; backend/frontend default to `72083840`.

When one is resolved, move its case into the main fixture sections and delete the `todo`.

## Manual / integration scripts (not in CI)
- Backend `src/scripts/` covers RBAC/RLS, chatbot, assistant operational parity, customer analytics, visits, complaints, products/HSN, KRA/tonnage, and PDF/voice work. E2E config is under `em-os-backend/test/`.
- Bot `scripts/test-*.js` cover catalog, inquiries, order atomicity/parity, visits, complaints, query/retrieval, updates, and live flows.
- Root `docs/` and `em-os-backend/docs/` contain module-specific manual/testing suites.

## Safety classification
Many scripts use configured Supabase and can create/update/delete data. There is no repository-wide dry-run/test-mode switch. They are integration/operational scripts, not automatically safe unit tests. Inspect the script, use a dedicated safe environment where possible, and state the target database before running. Never run migration/cleanup scripts as a default QA command. In particular, `migrate-from-supabase.ts` truncates its target database and RLS/cleanup/migration scripts are operational mutators.

The automated suites above are the only default QA commands; they never touch a real database.
