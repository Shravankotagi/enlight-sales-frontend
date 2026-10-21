# Authentication and RBAC flow

The system enforces a multi-tier authorization perimeter spanning OTP authentication, NestJS perimeter guards, service-level database scoping, bot channel isolation, and granular UI permission matrices.

## 1. Authentication Lifecycle

1. Frontend initiates OTP request via `POST /auth/request-otp` and verifies code via `POST /auth/verify-otp`.
2. Backend validates OTP session and issues a signed JWT containing employee claims:
   - `sub`: Employee ID (UUID)
   - `phone`: Normalized employee phone
   - `role`: One of `admin`, `sales_manager`, `salesperson`, `procurement_manager`, `procurement_person`
   - `permissions`: Custom JSONB permissions map (if assigned)
3. Frontend stores token and viewing context in session storage; Axios interceptor injects `Authorization: Bearer <token>` on all outbound calls.

## 2. Backend Perimeter Guard (`JwtAuthGuard`)

`JwtAuthGuard` acts as an early perimeter firewall. For procurement roles (`procurement_person` and `procurement_manager`), it strictly enforces an endpoint allowlist:
- **Permitted**:
  - `/inquiries/*` (all HTTP verbs, subject to service-level operation guards)
  - `GET` and `POST` `/chat/message` and `/chat/sessions`
  - `GET /products*`
  - `GET /pricing*`
  - `GET /employees*`
- **Denied**:
  - Any request to `/deals*`, `/customers*`, `/customer-visits*`, `/complaints*`, `/reports*`, `/kra*`, `/zoho*`, or admin-only mutation endpoints.
  - `/chat/kb` stays denied. A path such as `/inquiries-x` does not match the inquiries allow.
  - The guard immediately short-circuits and returns `403 Forbidden`, preventing procurement tokens from reaching business controllers or database queries for unpermitted modules.

## 3. Backend Role-Ordering Invariant

`procurement_manager` contains the substring `manager`. A naive substring or regex check (`role.includes('manager')`) will misidentify a procurement manager as a sales manager, leading to broken phone queries or leaked sales scopes.

> [!IMPORTANT]
> **Role-Ordering Rule**: Whenever branching on roles in backend code, always evaluate `isProcurementRole()` (`role === 'procurement_person' || role === 'procurement_manager'`) **BEFORE** evaluating any sales manager condition (`role === 'sales_manager'` or `role.includes('manager')`).

## 4. Service-Level Scope Resolution

Client query parameters (`salesperson_phone`, `viewing_as`) are untrusted hints. Services enforce server-resolved boundaries:
- **Sales Scope** (`getAccessibleSalespersonPhones`):
  - `admin`: All phones (unrestricted).
  - `sales_manager`: Caller's phone + all direct report salespeople.
  - `salesperson`: Caller's phone only.
  - Procurement employees are never included in sales phone scopes.
- **Procurement Scope** (`getAccessibleProcurementIds`):
  - `procurement_manager`: Caller's employee ID, direct-report procurement persons, the salespeople routed to those persons, and the open unassigned pool.
  - `procurement_person`: Caller's employee ID and unassigned inquiries for the salespeople routed to them. They do not see the generic unassigned pool.
  - Open unassigned pool: inquiries where `status IN ('new', 'pending', 'review', 'draft')` and `procurement_employee_id IS NULL`.
  - Pricing is saved on the inquiry, so it stays inside the inquiries surface the guard already allows.

## 5. WhatsApp Bot and the dashboard assistant

Procurement can use WhatsApp and the dashboard AI Assistant. `JwtAuthGuard` allows procurement `GET` and `POST` for `/chat/message` and `/chat/sessions`. `/chat/kb` stays denied. The nav shows AI Assistant beside Inquiries.
- Caller resolution checks `procurement_person` and `procurement_manager` before any `manager` match, and forwards that role to the bot.
- The bot uses the employee row, not a collapsed sales role. Procurement gets the procurement menu. Sales keeps the catalog menu.
- A procurement reply stays inside the inquiries scope and does not include customer name, phone, email, or raw inquiry text.

## 6. Granular UI Permissions Matrix (Zoho Books Style)

In addition to system role scoping, the frontend supports granular module-level ACLs stored in `employees.permissions` (JSONB):
- Managed via `RolePermissionsMatrixModal.tsx` and `ZohoPermissionsTable.tsx` in the Control Panel (`/control-panel`).
- Default permission sets are defined in `aclConstants.ts` for each role.
- Controls View, Create, Edit, Delete capabilities across each functional module.
- Supports fine-grained sub-permissions (e.g. `inquiries.fill_base_prices`, `inquiries.team_inquiries`).
- Controls navigation visibility in `Layout.tsx` and conditional UI controls on pages.

Client filters are a convenience; server perimeter guards and database scope checks are the actual authorization boundary. Test salesperson, sales manager, procurement person, procurement manager, and admin cases for every query/mutation.
