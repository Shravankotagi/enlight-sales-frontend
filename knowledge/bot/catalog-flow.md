# Catalog flow

`src/core/catalogFlow.js` is the largest bot module (about 17k lines). It holds the detailed commercial conversation state machine: catalog selection/disambiguation, inquiry/order capture, product line items, pricing/HSN handling, updates, approval/stage gates, generated/system PO behavior, and response templates.

## Safe navigation
Search within the file by exported function, intent/state key, or user-visible response instead of reading it linearly. Trace each state transition to the Supabase helper and `pendingStateManager` call before changing it.

## Invariants
- Preserve active/pending flow state across follow-up messages and intentional flow switching.
- Do not bypass stage/PO validation to make a prompt “work”.
- Revalidate items/prices/server state on writes; user-provided state is stale or incomplete.
- Keep response identity and field terms compatible with the UI and retrieval tools.
- Inquiry payment terms and preferred brand accept only Immediate, Advance, 30 Days, 45 Days, 60 Days, LC, BG, PDC and TATA, JSW, AM/NS India, SAIL, NMDC, Apollo, Others. A close typo maps to that option. Orders and visits keep their own payment-term text.
- Customer name matching verifies against assigned accounts: if similarity is >= 70%, the bot auto-proceeds; if < 70%, the bot pauses with a validation prompt asking "Do you want to continue with the fetched customer name?" with a "Yes" button and up to 3 highest-matching accounts from the assigned customer list. Numbers 1–3 select from that list.
- If a customer is already registered under another representative, the current draft is blocked.
  The response preserves the ownership warning and offers only `Discard Draft`; it must not
  invite a replacement customer name or allow arbitrary text to resume that draft.
- When an unrecognized product is entered, do not fabricate a fallback HSN (`72083840`); leave HSN empty if undetected, present catalog suggestions alongside the `Add Product` button (`btn_add_product`), and allow saving a custom product to `products` via `catalog_implicit_prod_add|<RETURN_INTENT>` using only user-entered product name and specs before resuming the inquiry/order draft.

Run focused scripts under `scripts/test-*catalog*`, `test-*order*`, `test-*inquiry*`, and `test-*update*` in a safe environment after changes.

