# Login and administration pages

`LoginPage.tsx` is a split screen: the Enlight Metals logo and sourcing stats on the left, and the WhatsApp OTP form on the right. The request button reads "Get OTP on WhatsApp". It requests/verifies OTP through `authApi`; `AuthContext.tsx` persists session identity, token, and user permissions; `AdminSelectionPage.tsx` is User Management. An admin opens it from the sidebar at `/control-panel`. Roles and permission templates are on `/roles`. Edit User does not change the role and does not show the permission matrix. Assign the role and permissions on `/roles`. The personal-workspace and company-overview launch cards are not on this page. Deactivated employees stay in the admin list with a Deactivated label and can be activated again from the edit form; the manager dropdown still lists active managers only. `AdminDashboard.tsx` is conditional in `App.tsx` via `isAdmin`.

## Control Panel & Employee Management (`AdminSelectionPage.tsx`)

`AdminSelectionPage.tsx` provides full lifecycle and access control management for company personnel:
- **Role Taxonomy**: Supports `admin`, `sales_manager`, `salesperson`, `procurement_manager`, and `procurement_person`.
- **Role Filtering**: Tab controls allow filtering staff by `All`, `Sales`, `Managers`, and `Procurement` (which groups `procurement_person` and `procurement_manager`).
- **Visual Badges**: Clear badge indicators differentiate departments:
  - `procurement_manager`: Emerald badge
  - `procurement_person`: Teal badge
  - `sales_manager`: Purple badge
  - `salesperson`: Blue badge
  - `admin`: Rose badge
- **Manager Assignment Validation**:
  - The manager selection dropdown strictly adheres to department hierarchy:
    - Sales representatives can only be assigned to active `sales_manager` accounts.
    - Procurement specialists can only be assigned to active `procurement_manager` accounts.
    - Cross-department assignment is blocked in both UI and backend.
- **Deactivated Employees**: Retained in list with a `Deactivated` label; can be reactivated directly from the edit modal.

## Zoho Books-Style Permissions Matrix (`RolePermissionsMatrixModal.tsx`)

Administrators can inspect and customize individual employee capabilities via a granular permissions editor:
- **Components**: `RolePermissionsMatrixModal.tsx` hosting `ZohoPermissionsTable.tsx`.
- **Invite User**: Name, email, and WhatsApp stay in their own form so a browser contact suggestion does not write the Users tab search.
- **Permission Matrix**: Controls granular actions across functional modules (Inquiries, Deals, Customers, Visits, Complaints, Reports, KRA):
  - View (None, Own, Team, All)
  - Create (boolean)
  - Edit (None, Own, Team, All)
  - Delete (None, Own, Team, All)
- **Sub-Options**: Granular sub-permissions such as `inquiries.fill_base_prices`, `inquiries.team_inquiries`, etc.
- **Defaults & Templates**: Uses predefined role defaults from `aclConstants.ts`. Provides a **Reset to Role Default** button to restore standard role capabilities.
- **Persistence**: Saved directly to `employees.permissions` (JSONB) via `PATCH /employees/:id`.

## Security Boundaries & Routing
The Axios interceptor adds the token and selected viewing context to every API call. UI selection is not security: backend guards must still validate it. `/admin` is outside the protected `Layout` and needs particular care; do not infer that router placement authorizes the action. A procurement user is automatically redirected to `/inquiries` and the sidebar displays only Inquiries, Products, and Pricing. The global 401 handler performs a full-page redirect and directly clears session keys for non-authenticated API requests. OTP request/verification 401 responses are form-validation failures and must be handled by `LoginPage` without leaving the OTP step, so the user can correct and resubmit the code. Do not store secrets beyond the intended session token.

`AdminDashboard` does not repeat the reports funnel. `AdminDashboard` shows Sync Bigin for the signed-in admin. The button calls `zohoApi.pullInitialSync` and then refreshes the dashboard. On `AdminDashboard`, leaderboard rows intentionally filter the full dashboard to the selected salesperson. The selected context is shown in the header and the `Company-Wide` action clears it. The leaderboard uses the Home dashboard's won orders, delivered tonnage, visits, and pending complaints, and the info control explains that 0–100 calculation without changing the selected salesperson.

Admin Overview uses `DateFilterControl` as the single date source; the standalone month and year selectors were removed. Rolling presets remain available alongside calendar presets: This/Previous Week, This/Previous Month, and This/Previous Year. Calendar current periods run from their boundary through today, while previous periods are complete calendar periods; all dashboard metric queries receive the resulting local `from` and `to` dates.
