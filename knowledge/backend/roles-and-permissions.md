# Roles and permissions

Roles live in the Supabase `roles` table (`backend/supabase-dynamic-roles.sql`). Run that script after `backend/supabase-procurement-acl.sql` and before deploying a backend that expects the table. If the table is missing, the API uses the built-in templates in `backend/src/common/acl/permissionKeys.ts` so existing role strings keep working.

`employees.role` stores the role id (`admin`, `sales_manager`, `salesperson`, `procurement_manager`, `procurement_person`, or `role_...`). A stored value of `manager` is treated as `sales_manager`. `employees.permissions` holds optional per-person overrides. A key set on the person replaces the role value. Unknown keys are ignored.

Each role has `data_scope`: `own`, `team`, or `all`. A custom role with `all` is not an admin. The dashboard leaves `effectivePhone` empty for that person, unless they are viewing a specific rep, so lists are company-wide. The role matrix does not offer an assigned-only box, and stored `*.scope_assigned` or `visibility_scope` values do not narrow a module. Personal mode (`personal`, `strict_self`, `self`) and an admin phone override keep their previous meaning.

In the role matrix, Create also turns View on, Edit also turns View and Create on, and Delete also turns View, Create, and Edit on. Turning View off clears Create, Edit, and Delete. Turning Create off clears Edit and Delete. Turning Edit off clears Delete. For staff, turning View off also clears CSV import, and turning CSV import on turns View on. Assign owner, Send Quote, and the other special boxes are not part of that chain.

Intelligence, Reports, and the home dashboard only include a module the role can view. Customer, inquiry, order, visit, and complaint numbers stay hidden when that module's View box is off. The customer profile and the customer list order columns follow the same View flags.

User Management stays available with `staff.view`, and that view lists every employee. Add Member needs `staff.create`, picks a role, and stores no separate permission copy, so the person uses that role's permissions. Edit and activate/deactivate need `staff.manage`, and permanent delete needs `staff.delete`. `staff.manage_acl` only opens Roles and Permissions.

`GET /auth/me` returns the current permissions. `GET/POST /roles`, `PUT /roles/:id`, and `DELETE /roles/:id` need `staff.manage_acl`. System roles cannot be deleted. The Admin role cannot lose `staff.manage_acl`. A role with people still assigned cannot be deleted.

The JWT is still a login proof. `JwtAuthGuard` re-reads the employee and role on each request. Requests with the bot secret stay internal and skip permission checks. The dashboard `can()` helper uses the signed-in person, including during View Rep. The WhatsApp bot reads the same table, caches it for about 10 seconds, and replies with a plain denial instead of throwing.

Saving a custom role clears `employees.permissions` for everyone on that role, clears the backend permission cache, and calls the bot `POST /chat/web/permissions/invalidate` so WhatsApp and the web assistant drop stale caches. A failed bot call does not fail the role save. For custom roles, the bot also ignores an employee override that is empty, an exact copy of the salesperson template, or an exact copy of the current role permissions.

The assistant and WhatsApp welcome catalog is built with `catalogForPhone`: each menu row is included only when that person has the matching permission. Visible rows are renumbered; empty sections are dropped. If nothing is allowed, the reply is that no sales actions are enabled for the role.

Role create, update, delete, and employee role changes are written to `activity_logs` with module `Roles`. Those rows, plus `Auth` and `Employees`, are hidden from people without `staff.view`.
