# Home and fallback

The home Total Customers card counts the same customer list the Customers page shows with no segment or date filter. A salesperson sees assigned customers and an admin sees all. The card opens `/customers` without a new-customer filter.

`HomePage.tsx` is the protected landing page; `NotFoundPage.tsx` handles unmatched routes. `App.tsx` redirects `/` to `/home` and wraps protected content in the authenticated layout/error boundaries. Add a route in App.tsx and navigation in Layout together.
