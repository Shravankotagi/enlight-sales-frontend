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
- Backend: employee phone helpers and salesperson scope (`getAccessibleSalespersonPhones`), procurement scope (`getAccessibleProcurementIds`), procurement pricing workflow (anonymity, partial availability, sales override, GST, decline), manager hierarchy validation (`assertManagerFitsRole`), `JwtAuthGuard` perimeter allowlist for procurement roles, commercial mutation blocks (status, deals, quotations), `RolesGuard`/`RoleGuard`, report date ranges and `allowedPhones` scope, leaderboard identity, pricing parity, plus the existing deals/inquiries/KRA/reports/app specs.
- Bot: phone and role resolution (`src/utils/roles.js`), fail-closed phone scope in `src/supabase.js`, WhatsApp webhook early exit and informational notification for procurement roles, WebChat 403 authorization guard, retrieval tools phone scoping, JSON utils, pricing engine, HSN detector, pricing parity, catalog-flow helpers, new-customer catalog flow state machine, PO resolver, network guard.
- Frontend: Zoho Books permissions matrix (`RolePermissionsMatrixModal`, `ZohoPermissionsTable`, `aclConstants.ts`), Control Panel role filter tabs and manager hierarchy validation (`AdminSelectionPage`), procurement inquiries view and base price entry (`InquiriesPage`), action button visibility guards, date utilities and presets, `DateFilterControl`, pricing parity, `systemPo`, Admin Overview leaderboard scoring/identity/info popover/drill-in, date filters, Review Queue removal, recent order fields/navigation, the new customer visit form, customer-profile GSTIN validation, removing an uploaded order or inquiry document and clearing its extracted fields, and `Layout.sidebar` (sidebar 200ms ease-out timing, `will-change-[width,transform]`, reduced motion safety, `localStorage` persistence, and hover enlargement/collapse).

## Regression tests: one per fixed bug
Every bug fix adds a test that fails before the fix and passes after it.
- File name: `issue-<number>-<short-slug>.test.(js|ts|tsx)` in the repo's regression folder; first line links the GitHub issue.
- Retroactive tests written before issue numbers were known use `<short-slug>.test.*` with an `Issue: <add GitHub issue link>` header; rename them when the issue is linked.
- Assert the user-visible contract (reply text/buttons, rendered labels, query params, returned rows), not implementation details.
- Never delete or weaken a regression test to make CI pass; if behavior intentionally changes, update the test in the same PR and say why.

Current regression tests:
| Repo | File | Guards |
|---|---|---|
| Bot | `issue-procurement-chatbot.test.js` | Procurement scope, exact awaiting-price match, text-only base-price list, inquiry details, cancel then menu, customer-field hiding, salesperson price buttons, price confirmation before save, a dashboard yes that saves, a saved price that becomes Price Quote, and a salesperson log that does not save a sell rate |
| Bot | `issue-procurement-all-inquiries.test.js` | All inquiries counts every Inquiries-tab status filter, including a pricing row that also has a deal stage, pages the newest 10, accepts next and the old current-inquiries phrase, includes an owner-resolved awaiting inquiry that Pending prices lists, and a pasted line opens details without base-price entry |
| Bot | `issue-procurement-base-price-lines.test.js` | Log a base price shows every line, a price is stored on the chosen line only, and the other lines’ prices and notes stay as they were; a price-ready number does not open or save a base price |
| Bot | `duplicate-customer-discard-draft.test.js` | Duplicate-customer warning shows only **Discard Draft**; blocked state ignores other text; discard finalizes the draft |
| Backend | `leaderboard-salesperson-identity.test.ts` | Mixed phone formats resolve to one named row; never "Unknown" |
| Frontend | `admin-leaderboard-identity-and-orders.test.tsx` | Leaderboard shows names/IDs/phones, counts orders (not deals), excludes admins |
| Frontend | `admin-overview-date-filters.test.tsx` | No standalone Month filter; every preset sends `{from, to}` to all Overview queries |
| Frontend | `admin-overview-recent-orders.test.tsx` | Review Queue is absent; recent filtered orders show order details and navigate to Orders |
| Backend | `issue-238-customer-visit-form.test.ts` | New visits require a verified phone, GPS photo, and listed brand and payment terms; Meta 131047 returns the 24-hour message, and other codes return the code in the 400 |
| Frontend | `issue-238-customer-visit-form.test.tsx` | Missing visit fields, locked GPS address, typed city when the address is missing, brand dropdown, camera overlay, and the assistant attach menu |
| Bot | `issue-238-visit-required-fields.test.js` | A new bot visit is not inserted until the new fields, GPS photo, and correct code are present |
| Frontend | `invalid-gstin-customer-edit.test.tsx` | Profile edit modal does not set state from a partial or invalid GSTIN, shows an error, blocks save, and still fills state from a valid GSTIN |
| Frontend | `remove-uploaded-document.test.tsx` | Remove on Record New Order and Log New Inquiry clears the file and extracted fields; the order system PO stays reserved; a replacement document does not keep the previous extraction |
| Frontend | `ProcurementPage.test.tsx`, `Layout.procurement.test.tsx`, `procurementPricing.test.ts`, `procurement-workflow.test.ts` | Procurement anonymity, base-price status, pricing formula, role-restricted navigation, and saved sales rates |
| Frontend | `issue-procurement-routing-details.test.tsx` | Sales and procurement both show the stored product quantity and the `PR-` id; procurement does not show the customer name |
| Frontend | `issue-historical-pricing-status.test.tsx` | An inquiry with no pricing status keeps its deal status; only an explicit `awaiting_price` shows Awaiting Price |
| Frontend | `issue-procurement-search.test.tsx` | A procurement person can filter inquiries by procurement id and product |
| Frontend | `issue-procurement-price-columns.test.tsx` | A wrapped pricing save keeps the base price; procurement edits only that column on Awaiting Price; a view-only procurement user sees the price and note boxes disabled and no Save Prices; a Price Ready inquiry is read-only and hides Share Quotation and Share Again for a procurement person and manager; a salesperson opening Price Ready sees the saved base price with Transport still visible; a salesperson save collapses the price columns into Rate; a saved row shows 18% GST from the saved rate even when the inquiry line has no amount, including after a list refresh |
| Backend | `issue-salesperson-sees-base-price.spec.ts` | Line pricing follows `employees.id` for a stored id, a customer owner, or a deal; a stranger and a phone with no employee are denied; creating an inquiry stores that id |
| Frontend | `issue-procurement-mt-line-amount.test.tsx` | 300 Nos at 7.359 MT and ₹200/MT show ₹1,471.80, and IGST is 18% of that subtotal |
| Frontend | `issue-procurement-save-base-price.test.tsx` | Procurement Save Prices sends the base price; a rejected save shows the server error; a stale list refresh does not clear Price Ready |
| Backend | `issue-procurement-mt-line-amount.spec.ts` | A Nos line stores taxable amount as its MT weight times the per-MT rate |
| Backend | `issue-procurement-save-base-price.spec.ts` | A missing `credit_per_mt` column retries the upsert, and a failed pricing-status update rejects the save |
| Backend | `issue-procurement-awaiting-price-edit.spec.ts` | Procurement base-price and status updates are rejected for Price Ready, Unavailable, and a pre-cutoff Awaiting Price; an Awaiting Price save and an admin save still proceed |
| Backend | `issue-procurement-view-only-acl.spec.ts` | A view-only procurement save is rejected even when fill base prices stays checked; empty permissions still allow an Awaiting Price save; delete and send quote follow their ACL keys |
| Bot | `issue-procurement-view-only-acl.test.js` | A view-only procurement user cannot open or save a base price, and pending prices and all inquiries still open |
| Backend | `issue-procurement-save-access.spec.ts` | A procurement person who can see an inquiry via the sender or customer owner can open it to save prices; another owner's inquiry stays denied |
| Bot | `issue-procurement-mt-line-amount.test.js` | A sales price taxable amount uses the line weight in MT, and an MT line still uses its tonnage |
| Frontend | `issue-send-quotation-button.test.tsx` | A priced inquiry drawer has one quotation button, and the email modal scrolls inside the screen; a denied preview shows the server error |
| Backend | `issue-share-quotation-preview.spec.ts` | Quotation preview follows `employees.id` for a stored id, a customer owner, or a deal, and a different employee id is denied |
| Frontend | `issue-procurement-kanban-click.test.tsx` | A procurement person opens Kanban View on the first click |
| Frontend | `procurement-header-actions.test.tsx` | Procurement person and manager inquiries headers hide Sync Bigin, View Confirmed Orders, and Log New Inquiry, and keep Refresh |
| Backend | `inquiry-pricing.workflow.spec.ts`, `inquiries.procurement-scope.spec.ts` | Procurement scope, customer-field stripping, partial and unavailable pricing, sales override, decline eligibility |
| Backend | `issue-procurement-routing-details.spec.ts` | Mapped salesperson inquiries get that procurement person and a unique `PR-` number; product lines survive procurement detail |

## Cross-repo parity fixture
`pricing-parity.json` is copied identically to `em-os-bot/test/fixtures/`, `em-os-backend/src/test-utils/fixtures/`, and `em-os-frontend/src/test/fixtures/`. Each repo's parity test runs its own pricing/HSN code against it. Change all three copies together in the same set of PRs.

Known divergences are listed under `knownDivergences` and run as `todo` tests until a business decision is made:
- KG rate: bot treats the rate as per-kg (500 kg @ 60 = 30000); backend/frontend treat it as per-MT (= 30).
- `pcs` unit: bot normalizes to `Nos`, backend/frontend to `Pcs`.
- Empty product: bot returns no HSN; backend/frontend default to `72083840`.

When one is resolved, move its case into the main fixture sections and delete the `todo`.

## Manual / integration scripts (not in CI)
- [procurement-manual-test-suite.md](procurement-manual-test-suite.md) is the manual pass for procurement person, procurement manager, and salesperson. It is not part of CI.
- Backend `src/scripts/` covers RBAC/RLS, chatbot, assistant operational parity, customer analytics, visits, complaints, products/HSN, KRA/tonnage, and PDF/voice work. E2E config is under `em-os-backend/test/`.
- Bot `scripts/test-*.js` cover catalog, inquiries, order atomicity/parity, visits, complaints, query/retrieval, updates, and live flows.
- Root `docs/` and `em-os-backend/docs/` contain module-specific manual/testing suites.

## Safety classification
Many scripts use configured Supabase and can create/update/delete data. There is no repository-wide dry-run/test-mode switch. They are integration/operational scripts, not automatically safe unit tests. Inspect the script, use a dedicated safe environment where possible, and state the target database before running. Never run migration/cleanup scripts as a default QA command. In particular, `migrate-from-supabase.ts` truncates its target database and RLS/cleanup/migration scripts are operational mutators.

The automated suites above are the only default QA commands; they never touch a real database.
