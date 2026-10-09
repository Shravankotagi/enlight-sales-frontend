# Login and administration pages

`LoginPage.tsx` requests/verifies OTP through `authApi`; `AuthContext.tsx` persists session identity and token; `AdminSelectionPage.tsx` chooses the salesperson/manager context; `AdminDashboard.tsx` is conditional in `App.tsx` via `isAdmin`.

The Axios interceptor adds the token and selected viewing context to every API call. UI selection is not security: backend guards must still validate it. `/admin` is outside the protected `Layout` and needs particular care; do not infer that router placement authorizes the action. The global 401 handler performs a full-page redirect and directly clears session keys for non-authenticated API requests. OTP request/verification 401 responses are form-validation failures and must be handled by `LoginPage` without leaving the OTP step, so the user can correct and resubmit the code. Do not store secrets beyond the intended session token.

On `AdminDashboard`, leaderboard rows intentionally filter the full dashboard to the selected salesperson. The selected context is shown in the header and the `Company-Wide` action clears it. The leaderboard uses the Home dashboard's won orders, delivered tonnage, visits, and pending complaints, and the info control explains that 0–100 calculation without changing the selected salesperson.
