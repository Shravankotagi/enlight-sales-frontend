# Sales agent

`src/agents/salesAgent.js` handles commercial inquiry/deal and order workflows, line items, stage progression, pricing/quotation concerns, and generated/System PO paths. It is coupled to `catalogFlow`, `supabase.js`, pricing/HSN utilities, and sales-oriented tools. Preserve atomic/revalidation logic and stage gate messages; changes require inquiry/order and PO regression scripts.
