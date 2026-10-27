# Roles and permissions

Roles live in the Supabase `roles` table (`backend/supabase-dynamic-roles.sql`). Run that script after `backend/supabase-procurement-acl.sql` and before deploying a backend that expects the table. If the table is missing, the API uses the built-in templates in `backend/src/common/acl/permissionKeys.ts` so existing role strings keep working.

`employees.role` stores the role id (`admin`, `sales_manager`, `salesperson`, `procurement_manager`, `procurement_person`, or `role_...`). A stored value of `manager` is treated as `sales_manager`. `employees.permissions` holds optional per-person overrides. A key set on the person replaces the role value. Unknown keys are ignored.

Each role has `data_scope`: `own`, `team`, or `all`. `*.scope_assigned` can still force a module down to that person's own phone. Personal mode (`personal`, `strict_self`, `self`) and an admin phone override keep their previous meaning.

`GET /auth/me` returns the current permissions. `GET/POST /roles`, `PUT /roles/:id`, and `DELETE /roles/:id` need `staff.manage_acl`. System roles cannot be deleted. The Admin role cannot lose `staff.manage_acl`. A role with people still assigned cannot be deleted.

The JWT is still a login proof. `JwtAuthGuard` re-reads the employee and role on each request. Requests with the bot secret stay internal and skip permission checks. The dashboard `can()` helper uses the signed-in person, including during View Rep. The WhatsApp bot reads the same table, caches it for 30 seconds, and replies with a plain denial instead of throwing.

Role create, update, delete, and employee role changes are written to `activity_logs` with module `Roles`. Those rows, plus `Auth` and `Employees`, are hidden from people without `staff.view`.
