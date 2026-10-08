# Customers and customer intelligence

`CustomersModule` owns `recurring_customers` and customer-facing analytics. It exposes customer list/detail/update/import plus churn risk, reorder queue, and loss analytics. `customer-insights.service.ts` derives behavior from orders/deals, visit and ownership data.

A customer may be resolved by name/ID in different bot flows. Normalize carefully and preserve salesperson/manager scope. Customer onboarding/update is also performed by bot tools; align field names and ownership assignment with those tools.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
