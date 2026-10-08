# Visits

`VisitsPage.tsx` uses `visitsApi` (`/kra/visits`) for create/update/delete and follow-up completion. Its data mirrors bot visit-agent writes into `customer_visits` and potentially follow-up/KRA data.

Preserve date and follow-up field formats. Exercise personal/manager filtering and create/edit/complete transitions when changing this page.
