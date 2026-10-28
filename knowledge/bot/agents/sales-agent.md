# Sales agent

`src/agents/salesAgent.js` handles commercial inquiry/deal and order workflows, line items, stage progression, pricing/quotation concerns, and generated/System PO paths. It is coupled to `catalogFlow`, `supabase.js`, pricing/HSN utilities, and sales-oriented tools. Preserve atomic/revalidation logic and stage gate messages; changes require inquiry/order and PO regression scripts.

Free-text inquiry lookup (`findDealByCodeOrId`, `getAllOpenDealsForCustomer`, `findBestDeal`) uses the same salesperson match as the catalog: stored phone, sender, linked deal phone, or active customer owner. An empty salesperson phone is not enough. `syncInquiryFromDeal` merges lines with `applyCommercialLines`. When that merge opens a tonnage review, the deal stage is not copied onto the inquiry, so a Price Ready quantity change does not become Price Quote.
