---
name: frontend-page
description: Adds or changes an Enlight Metals React dashboard page, route, component, API usage, protected UI, or client workflow. Use for frontend feature work.
---
# Frontend page workflow

Read `knowledge/frontend/README.md` and the relevant page/shared-component guide.

1. Use `src/lib/api.ts` rather than ad-hoc HTTP clients.
2. Respect AuthContext, protected route layout, Axios JWT/viewing-as interception, and server-enforced scope.
3. Add routes in `App.tsx`; update `Layout.tsx` navigation when appropriate.
4. Implement loading, empty, error, and stale-data refresh behavior.
5. Preserve System PO reservation lifecycle and never log sensitive payloads in the browser.
6. Run lint/build and relevant manual flow checks.
