# Regression checklists

## Any change
- [ ] Review relevant knowledge doc and Cursor skill.
- [ ] Run lint/build/unit tests appropriate to changed projects.
- [ ] Verify error, empty, and unauthorized/scope paths.
- [ ] Confirm no credentials, raw image/base64, full phone number, or raw prompt were added to output/logs.
- [ ] Update knowledge docs when an interface, table, or flow changed.

## Authentication and OTP
- [ ] Request an OTP for a registered phone and remain on the OTP step.
- [ ] Submit an invalid or expired six-digit OTP and confirm the warning appears while the OTP step remains visible.
- [ ] Replace the invalid code and submit the valid OTP successfully without returning to the phone form.
- [ ] Confirm a 401 from an authenticated API request still clears the session and redirects to `/login`.

## Commercial flow
- [ ] Inquiry create/read/update and scoped listing.
- [ ] Procurement scope: a person sees inquiries stamped to them, and a manager sees inquiries stamped to their team. A row with no owner is absent.
- [ ] Procurement guardrails: commercial terminal statuses (`confirmed`, `won`, `lost`), deal conversion, and quotations are blocked for procurement roles.
- [ ] Product/HSN and pricing parity.
- [ ] Quotation/PDF behavior.
- [ ] Stage transition and won-order view.
- [ ] System PO allocation, conflict, release, and retry behavior.

## Procurement
- [ ] Inquiries created before 15 Oct 2026 keep their original status. Only a new inquiry starts as Awaiting Price.
- [ ] A salesperson assigned to a procurement person has every inquiry stamped to that person, including older rows and a sender or customer-owner match.
- [ ] The procurement id is a unique `PR-` number and is not the inquiry id.
- [ ] Sales and procurement both see the stored product, original quantity, and unit. Procurement still does not see customer identity.
- [ ] Procurement person sees assigned inquiries, Inquiries, and AI Assistant.
- [ ] Procurement manager sees inquiries stamped to the procurement people who report to them. An inquiry with no owner is absent.
- [ ] Customer name, phone, email, and raw text are absent for both procurement roles.
- [ ] A blank base price becomes unavailable. One priced line is Price Ready. All blank lines are Unavailable.
- [ ] A Price Ready inquiry whose tonnage changes returns to Awaiting Price, appears on the procurement bell, and leaves that bell when base prices are saved again.
- [ ] Update Inquiry in the assistant and on WhatsApp includes an inquiry whose salesperson is only the sender or the customer owner. An `INQ-` code opens it. A Price Ready quantity change returns it to Awaiting Price and does not move the deal to Price Quote.
- [ ] Procurement can edit only Base Price and has one Save Prices button. A salesperson save collapses Base, Transport, Loading, Credit, and Margin into Rate.
- [ ] Sales can price before procurement responds, copy transport, loading, and margin to available rows, and quote only those rows.
- [ ] Maharashtra shows CGST and SGST. Every other state shows IGST.
- [ ] Decline is available only when every line is unavailable.
- [ ] A procurement person can be saved under a procurement manager, and not under a sales manager.

## Access Control and Administration
- [ ] Control Panel manager dropdown enforces department hierarchy (`salesperson` → `sales_manager`, `procurement_person` → `procurement_manager`).
- [ ] Cross-department manager assignment is rejected with 400.
- [ ] Role Permissions Matrix (`RolePermissionsMatrixModal`) saves granular module permissions to `employees.permissions`.
- [ ] Navigation sidebar in `Layout.tsx` hides unauthorized module links based on role and permissions.


## Visits, complaints, and KRA
- [ ] Create/update, exact entity selection, attachments/follow-up status.
- [ ] A new visit cannot be saved until every field except Add Document is filled, the phone code is verified, and the camera photo has GPS.
- [ ] A new WhatsApp or assistant visit asks for every required field together, then only for anything still missing. It requires a GPS photo or a typed city, and saves only after the customer code. Existing visit edits stay unchanged.
- [ ] Salesperson, manager, admin visibility.
- [ ] KRA/report date window and units.
- [ ] Perimeter guard (`JwtAuthGuard`) rejects procurement access with 403.

## Assistant/bot
- [ ] Message delivery through intended channel.
- [ ] Tool authorization and direct tool reply behavior.
- [ ] WhatsApp bot and WebChat isolate procurement users (informational message / 403 response).
- [ ] Session/history persistence; interruption/resume if applicable.
- [ ] Retry/idempotency behavior for mutations.

## Definition of done
A change is complete when tests are proportionate, affected flows have a manually verified happy path, edge/authorization cases are checked, user-visible contract changes are documented, and modified duplicated business logic has parity evidence.

For Update Inquiry, verify the list and detail card match dashboard pricing badges, show the procurement number, and show Base, Transport, Loading, Credit, Margin, and Rate for every material. A named component change is saved for every status except Won and Lost. A rate that would make the margin negative asks which component to change. The procurement base stays in place.

Also verify that the Update Inquiry page matches the dashboard inquiry code and procurement number, includes the same genuine rows, and shows seven per page. Next shows the following page. Won and Lost stay visible, and their price and stage changes are rejected.

For WebChat, verify the authenticated token phone is used and sender-only, linked-deal, and customer-owner inquiries are not lost because of phone formatting or a database-side OR filter. Chat requests must send that token only as `Authorization`. A failed session load must say the history could not be loaded.
