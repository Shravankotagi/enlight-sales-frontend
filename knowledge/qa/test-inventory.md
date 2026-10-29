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
| Bot | `issue-procurement-chatbot.test.js` | Procurement scope, exact awaiting-price match, text-only base-price list, inquiry details, cancel then menu, customer-field hiding, salesperson price buttons, price confirmation before save with the line amount and subtotal, a dashboard yes that saves, a saved price that becomes Price Quote, and a salesperson log that does not save a sell rate |
| Bot | `issue-procurement-all-inquiries.test.js` | All inquiries uses backend `display_stage` for every pipeline total and badge, pages the newest 10, accepts next and the old current-inquiries phrase, includes an owner-resolved awaiting inquiry that Pending prices lists, and opens pasted details without base-price entry |
| Bot | `issue-procurement-base-price-lines.test.js` | Log a base price shows every line, a price is stored on the chosen line only, and the other lines’ prices and notes stay as they were; a price-ready number does not open or save a base price |
| Bot | `issue-procurement-base-price-dot-separator.test.js` | `1. 500` and `1-500` both preview and save ₹500/MT, not ₹0.5/MT |
| Bot | `duplicate-customer-discard-draft.test.js` | Duplicate-customer warning shows only **Discard Draft**; blocked state ignores other text; discard finalizes the draft |
| Backend | `leaderboard-salesperson-identity.test.ts` | Mixed phone formats resolve to one named row; never "Unknown" |
| Frontend | `admin-leaderboard-identity-and-orders.test.tsx` | Leaderboard shows names/IDs/phones, counts orders (not deals), excludes admins |
| Frontend | `admin-overview-date-filters.test.tsx` | No standalone Month filter; every preset sends `{from, to}` to all Overview queries |
| Frontend | `admin-overview-recent-orders.test.tsx` | Review Queue is absent; recent filtered orders show order details and navigate to Orders |
| Backend | `issue-238-customer-visit-form.test.ts` | New visits require a verified phone, GPS photo, and listed brand and payment terms; Meta 131047 returns the 24-hour message, and other codes return the code in the 400 |
| Frontend | `issue-238-customer-visit-form.test.tsx` | Missing visit fields, locked GPS address, typed city when the address is missing, brand dropdown, camera overlay, and the assistant attach menu |
| Bot | `issue-238-visit-required-fields.test.js` | A new bot visit is not inserted until the new fields, GPS photo, and correct code are present |
| Frontend | `customer-type-other.test.tsx` | Customer type includes Other, and Other without a typed type is rejected |
| Frontend | `visit-select-placeholders.test.tsx` | Customer Type and Payment Terms prompts are shown when empty and cannot be selected |
| Frontend | `visit-future-dates.test.tsx` | A new visit rejects a past next purchase date and follow-up date, and the date pickers start at today |
| Frontend | `visit-media-preview.test.tsx` | A new visit shows a preview of the captured photo and of each added image or PDF before save |
| Frontend | `issue-visit-one-verified-indicator.test.tsx` | After the visit code is accepted, the form shows "Phone verified." and does not also show "Verified" |
| Frontend | `issue-visit-logging-wizard.test.tsx` | The new-visit dialog opens on company and contact, hides later fields, and stays there when Next is pressed with an empty company |
| Frontend | `issue-visit-wizard-step-progress.test.tsx` | An empty Log Visit form shows step 1/5, and Next on a filled first step shows 2/5 |
| Frontend | `visit-list-address.test.tsx` | The visits list shows area and city, keeps the full address on hover, keeps the phone check on that line, and View shows an uploaded document |
| Backend | `visit-future-dates.test.ts` | A new visit rejects a past next purchase date and follow-up date, and accepts today |
| Backend | `visit-followup-salesperson.test.ts` | A salesperson can set a visit follow-up to completed, and cannot edit the rest of the visit |
| Frontend | `assistant-input-scroll.test.tsx` | A long assistant prompt stays in a scrolling textarea, Enter sends, and Shift+Enter adds a line |
| Frontend | `assistant-visit-gps.test.tsx` | Opening Log Visit in the assistant starts the device location watch, and an ordinary reply does not |
| Frontend | `assistant-upload-pdf.test.tsx` | Upload from device accepts a PDF and refuses an image |
| Bot | `visit-chat-location-photo.test.js` | A WhatsApp visit accepts only a location pin, the assistant stores the full auto-fetched address instead of a shortened city, and only a camera photo after the pin is the visit photo |
| Bot | `visit-location-edit-lock.test.js` | A new visit's confirmation and edit steps cannot change the captured location, and a delivery location edit still goes through |
| Bot | `visit-future-dates.test.js` | A past next purchase or follow-up stays in the prompt list until the day is today |
| Bot | `visit-relative-dates.test.js` | Tomorrow and after a month become calendar days and leave the visit prompt list |
| Backend, Bot | `visit-otp-test-mode.test.ts`, `visit-otp-test-mode.test.js` | A visit test flag returns the code without WhatsApp, and the WhatsApp configuration error remains when the flag is off |
| Backend | `customer-type-other.test.ts` | Other without a typed type is rejected, and Other with text is stored on the visit row |
| Bot | `customer-type-other.test.js` | The customer-type prompt includes Other, and the visit row keeps the typed type |
| Frontend | `invalid-gstin-customer-edit.test.tsx` | Profile edit modal does not set state from a partial or invalid GSTIN, shows an error, blocks save, and still fills state from a valid GSTIN |
| Frontend | `remove-uploaded-document.test.tsx` | Remove on Record New Order and Log New Inquiry clears the file and extracted fields; the order system PO stays reserved; a replacement document does not keep the previous extraction |
| Frontend | `ProcurementPage.test.tsx`, `Layout.procurement.test.tsx`, `procurementPricing.test.ts`, `procurement-workflow.test.ts` | Procurement anonymity, base-price status, pricing formula, role-restricted navigation, and saved sales rates |
| Frontend | `issue-procurement-routing-details.test.tsx` | Sales and procurement both show the stored product quantity and the `PR-` id; procurement does not show the customer name |
| Frontend | `issue-historical-pricing-status.test.tsx` | An inquiry with no pricing status keeps its deal status; only an explicit `awaiting_price` shows Awaiting Price |
| Frontend | `issue-procurement-search.test.tsx` | A procurement person can filter inquiries by procurement id and product |
| Frontend | `issue-procurement-price-columns.test.tsx` | A wrapped pricing save keeps the base price; procurement edits only that column on Awaiting Price; a view-only procurement user sees the price and note boxes disabled and no Save Prices; a Price Ready inquiry is read-only and hides Share Quotation and Share Again for a procurement person and manager; a salesperson opening Price Ready sees the saved base price with Transport still visible; a salesperson save collapses the price columns into Rate; a saved row shows 18% GST from the saved rate even when the inquiry line has no amount, including after a list refresh |
| Frontend | `issue-inquiry-gst-column-layout.test.tsx` | A priced inquiry keeps a large IGST, CGST, or SGST amount on one line with its tax label inside the Inquiry & Audit GST column for a salesperson, procurement person, and procurement manager |
| Frontend | `issue-quotation-preview-notices.test.tsx` | A quotation preview with a priced line and a zero-rate line shows the exclusion notice and the priced-item count in separate strips |
| Frontend | `issue-procurement-line-item-controls.test.tsx` | A procurement person or manager cannot add, remove, or edit product lines on a priced inquiry; a salesperson still can |
| Frontend | `issue-procurement-subtotal-only.test.tsx` | A procurement person or manager sees Sub Total in the inquiry drawer and does not see CGST, SGST, IGST, or the grand total; a salesperson still does; a Price Ready line of 30 MT at ₹20,000 shows Sub Total 6,00,000.00 |
| Backend | `issue-salesperson-sees-base-price.spec.ts` | Line pricing follows `employees.id` for a stored id, a customer owner, or a deal; a stranger and a phone with no employee are denied; creating an inquiry stores that id |
| Frontend | `issue-procurement-mt-line-amount.test.tsx` | 300 Nos at 7.359 MT and ₹200/MT show ₹1,471.80, and IGST is 18% of that subtotal |
| Frontend | `issue-procurement-save-base-price.test.tsx` | Procurement Save Prices sends the base price; a rejected save shows the server error; a stale list refresh does not clear Price Ready |
| Backend | `issue-procurement-mt-line-amount.spec.ts` | A Nos line stores taxable amount as its MT weight times the per-MT rate |
| Backend | `issue-procurement-save-base-price.spec.ts` | A missing `credit_per_mt` column retries the upsert, and a failed pricing-status update rejects the save |
| Frontend | `issue-price-quote-status-move.test.ts` | Lost, Negotiation, and On Hold are allowed from a Price Quote badge even when the deal is still New Inquiry, and those moves stay blocked from a New Inquiry badge |
| Backend | `issue-procurement-tonnage-review.spec.ts` | A Price Ready weight change reopens Awaiting Price and stores the MT diff; the same weight in KG and a rate-only edit do not; a later edit keeps the original weight; saving a base price clears the review; another procurement person does not receive the row |
| Frontend | `issue-procurement-tonnage-review.test.tsx` | The procurement bell sits beside Refresh, lists the `PR-` id and the MT change, and opens Save Prices; an empty list has no badge; a salesperson does not see the bell |
| Bot | `issue-procurement-tonnage-review.test.js` | A KG quantity equal to the existing MT does not open a review; a Price Ready quantity sync reopens the inquiry; the awaiting-price reply says Tonnage updated only for an open review |
| Bot | `issue-chatbot-inquiry-update.test.js` | Update Inquiry includes a sender-only inquiry and a customer-owner inquiry; an `INQ-` code opens that inquiry from the menu and from a sentence; a Price Ready quantity change reopens Awaiting Price without moving the deal to Price Quote; the same weight in KG and a manual piece weight do not reopen |
| Bot | `issue-inquiry-number-dashboard-parity.test.js` | Update Inquiry uses the dashboard inquiry code (`INQ-` plus the first six characters of the inquiry id), leads with that row's procurement number, includes blank types, purchase orders, and PO text, and does not invent a code for a deal with no inquiry |
| Bot | `issue-update-inquiry-material-prices.test.js` | Two deal-only materials both show Base, Transport, Loading, Credit, Margin, and Rate; a Price Quote transport change keeps the procurement base and recomputes the rate; Won and Lost refuse a price change; a rate that needs a negative margin asks which component to change |
| Bot | `issue-update-order-scope.test.js` | Update Order lists the caller's won deals and a customer assigned to them, and leaves out another salesperson's won deal even when a shorter customer name would fuzzy-match it, plus any deal that is not won |
| Bot | `issue-update-inquiry-quantity-review.test.js` | A Price Ready card badge does not turn a 40 MT to 50 MT save into a Quoted stage change; the quantity is stored, the inquiry returns to Awaiting Price, and the procurement tonnage review opens |
| Bot | `issue-update-inquiry-price-save.test.js` | A transport, loading, credit, and margin change shows Base through Rate on the save card; the upsert keeps the existing pricing `line_key`, omits `id`, and stores the recomputed rate |
| Bot | `issue-add-price-line-formats.test.js` | Add Price accepts a pasted material line for every row, including two beams distinguished by quantity and Heavy Base Plate; `1.` fills only that material; semicolon, pipe, and space separators reach confirmation; an unknown material is named and not saved |
| Backend | `issue-procurement-awaiting-price-edit.spec.ts` | Procurement base-price and status updates are rejected for Price Ready, Unavailable, and a pre-cutoff Awaiting Price; an Awaiting Price save and an admin save still proceed |
| Backend | `issue-procurement-view-only-acl.spec.ts` | A view-only procurement save is rejected even when fill base prices stays checked; empty permissions still allow an Awaiting Price save; delete and send quote follow their ACL keys |
| Bot | `issue-procurement-view-only-acl.test.js` | A view-only procurement user cannot open or save a base price, and pending prices and all inquiries still open |
| Backend | `issue-procurement-save-access.spec.ts` | A procurement person who can see an inquiry via the sender or customer owner can open it to save prices; another owner's inquiry stays denied |
| Bot | `issue-procurement-mt-line-amount.test.js` | A sales price taxable amount uses the line weight in MT, and an MT line still uses its tonnage |
| Frontend | `issue-send-quotation-button.test.tsx` | A priced inquiry drawer has one quotation button, and the email modal scrolls inside the screen; a denied preview shows the server error |
| Backend | `issue-share-quotation-preview.spec.ts` | Quotation preview follows `employees.id` for a stored id, a customer owner, or a deal, and a different employee id is denied |
| Backend | `issue-send-decline-email.spec.ts` | An unavailable inquiry preview names the material and includes the fixed CC addresses; send requires a customer email and keeps `dj@enlightmetals.com` and `vedant@enlightmetals.com` |
| Frontend | `issue-procurement-kanban-click.test.tsx` | A procurement person opens Kanban View on the first click |
| Frontend | `procurement-header-actions.test.tsx` | Procurement person and manager inquiries headers hide Sync Bigin, View Confirmed Orders, and Log New Inquiry, and keep Refresh |
| Backend | `inquiry-pricing.workflow.spec.ts`, `inquiries.procurement-scope.spec.ts` | Procurement scope, customer-field stripping, partial and unavailable pricing, sales override, decline eligibility, and a sales-price save that moves a New Inquiry deal to Price Quote while leaving Negotiation in place |
| Backend | `issue-procurement-routing-details.spec.ts` | Mapped salesperson inquiries get that procurement person and a unique `PR-` number; product lines survive procurement detail |
| Backend | `issue-procurement-linked-deal-stage.spec.ts` | A procurement list and detail row expose canonical `display_stage` from the newest linked deal or normalized inquiry fields, while hiding the customer |
| Frontend | `issue-procurement-linked-deal-stage.test.ts` | The Inquiries tab consumes backend `display_stage` and does not recreate pipeline decisions from raw deal or status fields |
| Frontend | `issue-procurement-po-stage-normalization.test.ts` | Mixed-case PO metadata is classified once by the backend and consumed as its canonical Won stage |

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

`em-os-bot/test/regression/issue-update-inquiry-status-pricing.test.js` covers pricing-status precedence, historical awaiting-price handling, stage normalization, and the five-component sales pricing breakdown.

`em-os-bot/test/regression/issue-update-inquiry-material-prices.test.js` covers that breakdown for every deal material, a Price Quote transport save that keeps the procurement base, the Won and Lost refusal, and a rate that would require a negative margin.

`em-os-bot/test/regression/issue-add-price-line-formats.test.js` covers pasted material lines, line numbers, semicolon, pipe, and space separators, and an unknown material in Add Price to Inquiry.

`em-os-bot/test/regression/issue-update-inquiry-quantity-review.test.js` covers a quantity change while the open card still says Price Ready. The quantity is saved, the inquiry returns to Awaiting Price, and the procurement tonnage review opens without moving the deal stage.

`em-os-bot/test/regression/issue-update-inquiry-price-save.test.js` covers a price-component save when the pricing row's `line_key` is not the deal item id. The confirmation shows the resulting rate, and the write updates that row in place.

`em-os-bot/test/regression/issue-chatbot-inquiry-update.test.js` also covers the seven-row Update Inquiry page, Next pagination, and visibility of Won/Lost rows.

`em-os-bot/test/regression/issue-inquiry-number-dashboard-parity.test.js` covers the dashboard inquiry code, the procurement number on the same line, and the dashboard row set.

`em-os-bot/test/regression/issue-update-inquiry-empty-select.test.js` covers a `display_stage` select failure, the fallback inquiry query, and a linked-deal salesperson match.

`em-os-frontend/src/test/regression/issue-assistant-chat-cors.test.ts` checks that chat requests send the account token only as `Authorization`. `issue-assistant-session-load.test.tsx` checks that a failed history request is shown as a load error. `em-os-backend/src/__regression__/issue-assistant-chat-cors.spec.ts` checks the CORS allow-list and that a chat with no employee phone is refused.
