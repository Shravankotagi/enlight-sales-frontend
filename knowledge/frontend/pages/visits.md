# Visits

`VisitsPage.tsx` uses `visitsApi` (`/kra/visits`) for create/update/delete and follow-up completion. Its data mirrors bot visit-agent writes into `customer_visits` and potentially follow-up/KRA data.

A new visit, on the dashboard and on both WhatsApp log paths, requires company, person met, designation, a 10-digit phone, a valid email, city, customer type, visit date, visit type, outcome, probability, product details, monthly consumption, preferred brand, payment terms, delivery location, next purchase date, current requirement, follow-up action, follow-up date, meeting remarks, and one photo or document. Editing an existing visit is unchanged.

Preserve date and follow-up field formats. Exercise personal/manager filtering and create/edit/complete transitions when changing this page.
