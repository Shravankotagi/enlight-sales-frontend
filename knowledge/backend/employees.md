# Employees and visibility

`EmployeesModule` manages `employees`, including list, next ID, creation, update, and deactivation. Employee phone and role underpin authorization, ownership, frontend “viewing as” filters, bot context, and Bigin assignment.

## Role Taxonomy

The system defines five primary operational roles:
- `admin`: Superuser with unrestricted access across all modules, commercial workflows, procurement allocation, and employee ACL configurations.
- `sales_manager`: Manages sales teams, reviews team inquiries, deals, visits, customer accounts, and sales leaderboards.
- `salesperson`: Direct sales representative, scoped strictly to their own assigned inquiries, deals, visits, and customer accounts.
- `procurement_manager`: Oversees procurement operations. Can assign/reassign inquiries across their team, manage base prices, and access the unassigned intake pool.
- `procurement_person`: Procurement specialist responsible for base price entry and vendor quotes. Scoped to assigned inquiries plus the unassigned intake pool.

## Manager Assignment & Department Hierarchy

Department integrity is strictly validated in `EmployeesService` via `assertManagerFitsRole()`:
- A `salesperson` must report to an active employee with `role === 'sales_manager'`.
- A `procurement_person` must report to an active employee with `role === 'procurement_manager'`.
- Cross-department assignment (e.g. assigning a salesperson to a procurement manager, or a procurement person to a sales manager) throws `BadRequestException` (`400`).
- Managers and admins cannot report to another manager.

## Scope Resolution Helpers

- `getAccessibleSalespersonPhones(phone, role)`: Resolves accessible salesperson phones (caller's own phone, team phones for sales managers, or unrestricted for admins). Excludes procurement personnel.
- `getAccessibleProcurementIds(employeeId, role)`: Resolves accessible employee IDs for procurement scoping:
  - `admin`: `{ ids: [], includeUnassignedPool: true, unrestricted: true }`
  - `procurement_manager`: `{ ids: [managerId, ...reportIds], includeUnassignedPool: true }`
  - `procurement_person`: `{ ids: [personId], includeUnassignedPool: true }`
- `getAssignedSalespersons()`: Returns the sales team list for UI assignment, explicitly excluding `procurement_person` and `procurement_manager` so procurement staff never appear in sales quota/leaderboard calculations or customer sales assignment.

## Granular UI Permissions (`permissions` column)

`employees.permissions` (JSONB) stores a customizable Zoho Books-style permissions matrix for each employee:
- Defines module-level capabilities: `view`, `create`, `edit`, `delete` across Inquiries, Deals, Customers, Visits, Complaints, Reports, KRA, etc.
- Stores specialized sub-permissions such as `inquiries.fill_base_prices`, `inquiries.team_inquiries`, etc.
- Default matrices are provided by `aclConstants.ts` in the frontend; customizations are saved via `PATCH /employees/:id`.

## Safe modification path
Never rely only on an arbitrary client `salesperson_phone`; resolve/validate it against the caller’s permitted scope. Deactivation must not orphan customer/deal visibility.
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

`procurement_person` and `procurement_manager` are employees roles. A procurement person reports through the existing `manager_id` / `manager_phone` columns, and that manager must be a `procurement_manager`. A salesperson's manager must be a sales manager. `GET /employees` for a procurement manager returns self plus that team; a procurement person gets self only. `employees.permissions` is stored and not enforced. Inquiry pricing uses the role and assignment scope, not that permissions column.

`employees.assigned_procurement_employee_id` stores the one procurement person who covers that salesperson. The control panel sends `assigned_salesperson_ids` when saving a procurement person. That write sets the column on the selected salespeople, clears it for salespeople removed from the selection, and stamps every unassigned inquiry for those salespeople, in any status. Matching uses the salesperson phone's last 10 digits and `employee_id`. Apply `supabase-procurement-routing.sql` before using the column.
