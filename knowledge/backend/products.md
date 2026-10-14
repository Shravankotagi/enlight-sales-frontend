# Products

`ProductsModule` is a lightweight product catalogue/lookup boundary over `products`. It exposes `GET /products` (list/lookup) and `POST /products` (protected by `JwtAuthGuard`) to create custom product entries (`product_name`, optional `dimensions`, optional `hsn_code`). Custom product creation never fabricates `dimensions` or `hsn_code` when omitted. Product name/dimensions can be normalized by the HSN detector and pricing engine; do not change product matching semantics without checking bot catalogFlow, sales agent, inquiries, and frontend comboboxes.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

