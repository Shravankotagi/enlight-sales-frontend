# Home and fallback

`HomePage.tsx` is the protected landing page; `NotFoundPage.tsx` handles unmatched routes. `App.tsx` redirects `/` to `/home` and wraps protected content in the authenticated layout/error boundaries. Add a route in App.tsx and navigation in Layout together.
