# Procurement manual test suite

The detailed script, including the tonnage bell, is [procurement-test-cases.md](procurement-test-cases.md). This file is the short role pass.

Use this on `feature/procurement` after `supabase-procurement-acl.sql`, `supabase-inquiry-line-pricing.sql`, `supabase-procurement-routing.sql`, `supabase-pricing-status-preserve.sql`, and `supabase-procurement-tonnage-review.sql` have been applied. Do not run it against production customer data. Use three test accounts: a procurement person who reports to a procurement manager, that procurement manager, and a salesperson. An admin account is needed only for the setup checks.

Record the result of each case as Pass or Fail. A case fails if the expected result does not happen, even if a nearby case passes.

## Setup

1. As admin, create or confirm a procurement manager.
2. Create a procurement person and set **Assigned Procurement Manager** to that manager. Saving must succeed. Assigning that person to a sales manager must be rejected.
3. Confirm the salesperson can log in and already owns at least one open inquiry with two products, a quantity, a unit, and a delivery location. One location should be in Maharashtra and another outside Maharashtra.
4. Leave the salesperson unrouted at the start, so those inquiries have no procurement owner.

## Shared rules

- Procurement person and procurement manager see only **Inquiries** in the sidebar. `/procurement` opens `/inquiries`.
- Procurement responses never show customer name, phone, email, or the raw inquiry text. Sales and admin still see them.
- A positive base price makes a line available. A blank base price saved by procurement makes that line unavailable. A note is optional.
- One available line makes the inquiry **Price Ready**. Every line blank makes it **Unavailable**. A new inquiry starts as **Awaiting Price**. An inquiry created before 15 Oct 2026 keeps its original status unless a price was already saved. There is no **Price Hold** status.
- Rate per MT is base + transport + loading + credit + margin. A blank credit is 0. Maharashtra shows CGST 9% and SGST 9%. Every other delivery state shows IGST 18%.
- Procurement cannot create an inquiry, send a quotation, or move an inquiry to confirmed, won, or lost.

## Procurement person

| # | Action | Expected result |
|---|---|---|
| P1 | Open Inquiries. | Only the Inquiries tab is available. Dashboard, Orders, Customers, and the other salesperson tabs are absent. |
| P2 | Before anyone routes a salesperson to this person, review the list. | Inquiries stamped to someone else are absent. Inquiries with no procurement owner are absent. |
| P3 | Ask an admin or procurement manager to assign one open inquiry to this person, or assign this person's salesperson in the control panel and create an inquiry for that salesperson. Refresh. | That inquiry appears with its `PR-` procurement id. Customer name, phone, and raw text do not. Salesperson, products, original quantity, unit, and delivery region do. |
| P4 | Open the inquiry and enter a base price on one product. Leave the other base price blank. Save. | The priced line is available. The blank line is unavailable. Status becomes **Price Ready**. |
| P5 | On a second assigned inquiry, save with every base price blank. | Status becomes **Unavailable**. |
| P6 | Try to log a new inquiry, send a quotation, or mark the inquiry confirmed, won, or lost. | Each action is blocked. |
| P7 | Send a WhatsApp message from the procurement person's number. | The bot stops the message and does not run quotation, customer, or pricing tools. |
| P8 | After this person has saved a base price, have the salesperson change that inquiry's tonnage on the dashboard, in the assistant, or on WhatsApp. Open the bell beside Refresh. | The inquiry is Awaiting Price again. The bell lists its `PR-` number and the old and new weight. Opening it shows Save Prices. Saving a base price, or leaving every base price blank, removes it from the bell. The deal does not become Price Quote. |

## Procurement manager

| # | Action | Expected result |
|---|---|---|
| M1 | Open Inquiries. | Only the Inquiries tab is available. Customer identity is hidden on every row. |
| M2 | Compare the list with the person's list. | The manager sees inquiries stamped to the person and inquiries stamped to the manager. An inquiry with no procurement owner is absent. |
| M3 | Route one salesperson to the person and another to the manager. Refresh both lists. | The person sees only the inquiries of the salesperson routed to them, and each row is stamped to that person. The manager sees both sets. A row already owned by another procurement person stays there. |
| M4 | Save a base price on a team inquiry. | The save succeeds and the status follows the same available / unavailable rules as P4 and P5. |
| M5 | Try to create an inquiry, send a quotation, or move an inquiry to confirmed, won, or lost. | Each action is blocked. |

## Salesperson

| # | Action | Expected result |
|---|---|---|
| S1 | Open the same inquiry before procurement has priced it. | Customer identity is visible. The product, quantity, and unit match the stored line, including the original quantity. The procurement id and the inquiry id are both shown and they are different. Status is **Awaiting Price**. The base price can still be typed. |
| S2 | Enter base, transport, loading, and margin on one available row. Use **Copy to all** for transport, loading, and margin. | Those three values copy only to available rows. An unavailable row stays unchanged and cannot be quoted. |
| S3 | Save prices, then send a quotation. | The quotation uses the saved rate for available lines only. The server total matches base + transport + loading + margin, multiplied by MT. |
| S4 | Repeat S3 for a Maharashtra delivery and for a delivery outside Maharashtra. | Maharashtra shows CGST 9% and SGST 9% on the row and the subtotal. The other state shows IGST 18% only. |
| S5 | Open the inquiry whose lines are all unavailable. | **Send quotation** is not the action. **Send Decline Email** opens a polite message that names the material, with a customer email field and CC. `dj@enlightmetals.com` and `vedant@enlightmetals.com` have no remove button. Sending it records the decline. |
| S6 | After procurement has priced one line, change the working base price and save again. | The quotation uses the salesperson's base. Procurement's original base is still retained for audit. |
| S7 | Open Dashboard, Orders, and Customers. | Those tabs still open. The inquiries page does not trap navigation. |

## Admin assignment

| # | Action | Expected result |
|---|---|---|
| A1 | Edit the procurement person and choose the procurement manager. | The person saves with that manager. |
| A2 | Edit the same person and choose a sales manager. | The save is rejected because a procurement person must report to a procurement manager. |
| A3 | On the procurement person, select one or more salespeople and save. | Each selected salesperson is routed to that person. Every inquiry of those salespeople is stamped to that person, including older won or quoted rows, a sender match, a customer-owner match, and phones stored in another format. The row is not labeled Unassigned. A row already owned by another procurement person stays there. A new inquiry for one of those salespeople appears without a manual assign. The inquiry drawer has no Procurement owner control. Its procurement id is `PR-` plus a number, and that id is not the inquiry id. |

## Automated coverage

The same rules are guarded offline, without a database:

- Backend: `em-os-backend/src/modules/inquiries/inquiry-pricing.workflow.spec.ts`, `inquiries.procurement-scope.spec.ts`, and `src/__regression__/issue-procurement-routing-details.spec.ts`
- Frontend: `em-os-frontend/src/test/regression/procurement-workflow.test.ts`, `issue-procurement-routing-details.test.tsx`, and `src/components/Layout.procurement.test.tsx`
- Bot: `em-os-bot/src/tests/procurement-pricing.test.js`

Run `npm test -- --testPathPattern='inquiry-pricing.workflow|inquiries.procurement'` in `em-os-backend`, `npx vitest run src/test/regression/procurement-workflow.test.ts src/components/Layout.procurement.test.tsx` in `em-os-frontend`, and `npm test` in `em-os-bot`.
