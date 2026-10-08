# Regression checklists

## Any change
- [ ] Review relevant knowledge doc and Cursor skill.
- [ ] Run lint/build/unit tests appropriate to changed projects.
- [ ] Verify error, empty, and unauthorized/scope paths.
- [ ] Confirm no credentials, raw image/base64, full phone number, or raw prompt were added to output/logs.
- [ ] Update knowledge docs when an interface, table, or flow changed.

## Commercial flow
- [ ] Inquiry create/read/update and scoped listing.
- [ ] Product/HSN and pricing parity.
- [ ] Quotation/PDF behavior.
- [ ] Stage transition and won-order view.
- [ ] System PO allocation, conflict, release, and retry behavior.

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
