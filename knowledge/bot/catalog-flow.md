# Catalog flow

`src/core/catalogFlow.js` is the largest bot module (about 17k lines). It holds the detailed commercial conversation state machine: catalog selection/disambiguation, inquiry/order capture, product line items, pricing/HSN handling, updates, approval/stage gates, generated/system PO behavior, and response templates.

## Safe navigation
Search within the file by exported function, intent/state key, or user-visible response instead of reading it linearly. Trace each state transition to the Supabase helper and `pendingStateManager` call before changing it.

## Invariants
- Preserve active/pending flow state across follow-up messages and intentional flow switching.
- Do not bypass stage/PO validation to make a prompt “work”.
- Revalidate items/prices/server state on writes; user-provided state is stale or incomplete.
- Keep response identity and field terms compatible with the UI and retrieval tools.
- If a customer is already registered under another representative, the current draft is blocked.
  The response preserves the ownership warning and offers only `Discard Draft`; it must not
  invite a replacement customer name or allow arbitrary text to resume that draft.

Run focused scripts under `scripts/test-*catalog*`, `test-*order*`, `test-*inquiry*`, and `test-*update*` in a safe environment after changes.
