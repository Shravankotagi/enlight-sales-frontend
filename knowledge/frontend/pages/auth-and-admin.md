# Login and administration pages

`LoginPage.tsx` requests/verifies OTP through `authApi`; `AuthContext.tsx` persists session identity and token; `AdminSelectionPage.tsx` chooses the salesperson/manager context; `AdminDashboard.tsx` is conditional in `App.tsx` via `isAdmin`.

The Axios interceptor adds the token and selected viewing context to every API call. UI selection is not security: backend guards must still validate it. `/admin` is outside the protected `Layout` and needs particular care; do not infer that router placement authorizes the action. The 401 handler performs a full-page redirect and directly clears session keys, so keep it coherent with AuthContext. Do not store secrets beyond the intended session token.
