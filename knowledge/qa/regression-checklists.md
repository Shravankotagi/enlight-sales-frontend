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
- [ ] Product/HSN and pricing parity.
- [ ] Quotation/PDF behavior.
- [ ] Stage transition and won-order view.
- [ ] System PO allocation, conflict, release, and retry behavior.

## Procurement
- [ ] Inquiries created before 15 Oct 2026 keep their original status. Only a new inquiry starts as Awaiting Price.
- [ ] A salesperson assigned to a procurement person has their unassigned inquiries, including older rows, land in that person's list.
- [ ] The procurement id is a unique `PR-` number and is not the inquiry id.
- [ ] Sales and procurement both see the stored product, original quantity, and unit. Procurement still does not see customer identity.
- [ ] Procurement person sees only assigned inquiries and only the Inquiries tab.
- [ ] Procurement manager also sees the team and the open unassigned pool.
- [ ] Customer name, phone, email, and raw text are absent for both procurement roles.
- [ ] A blank base price becomes unavailable. One priced line is Price Ready. All blank lines are Unavailable.
- [ ] Procurement can edit only Base Price and has one Save Prices button. A salesperson save collapses Base, Transport, Loading, and Margin into Rate.
- [ ] Sales can price before procurement responds, copy transport, loading, and margin to available rows, and quote only those rows.
- [ ] Maharashtra shows CGST and SGST. Every other state shows IGST.
- [ ] Decline is available only when every line is unavailable.
- [ ] A procurement person can be saved under a procurement manager, and not under a sales manager.

## Visits, complaints, and KRA
- [ ] Create/update, exact entity selection, attachments/follow-up status.
- [ ] Salesperson, manager, admin visibility.
- [ ] KRA/report date window and units.

## Assistant/bot
- [ ] Message delivery through intended channel.
- [ ] Tool authorization and direct tool reply behavior.
- [ ] Session/history persistence; interruption/resume if applicable.
- [ ] Retry/idempotency behavior for mutations.

## Definition of done
A change is complete when tests are proportionate, affected flows have a manually verified happy path, edge/authorization cases are checked, user-visible contract changes are documented, and modified duplicated business logic has parity evidence.
