# Frontend guide

`em-os-frontend` is a Vite/React 19 dashboard. `main.tsx` creates the query client, router, and toaster; `App.tsx` defines public and protected routes plus realtime setup; `AuthContext.tsx` owns session identity; `lib/api.ts` is the service boundary for backend and bot requests.

Supabase is used for realtime invalidation, not direct application data reads. The app uses polling, realtime invalidation, and manual refetches, so new pages should avoid creating additional redundant refresh loops.

## Navigation map
| Route | Page |
|---|---|
| `/login`, `/admin` | Login and admin selection |
| `/home`, `/assistant`, `/intelligence` | overview and assistant intelligence |
| `/inquiries`, `/orders`, `/customers/:id` | commercial/customer operations |
| `/visits`, `/complaints`, `/kra`, `/reports`, `/logs` | field operations and analytics |
| `/admin-dashboard` | admin only |

Use the page guides in [pages/](pages/) and [shared-components.md](shared-components.md) before modifying a workflow. Mobile layout rules are in [responsive-ui.md](responsive-ui.md).
