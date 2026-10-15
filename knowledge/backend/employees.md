# Employees and visibility

`EmployeesModule` manages `employees`, including list, next ID, creation, update, and deactivation. Employee phone and role underpin authorization, ownership, frontend “viewing as” filters, bot context, and Bigin assignment.

Never rely only on an arbitrary client `salesperson_phone`; resolve/validate it against the caller’s permitted scope. Deactivation must not orphan customer/deal visibility.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

`procurement_person` and `procurement_manager` are employees roles. A procurement person reports through the existing `manager_id` / `manager_phone` columns, and that manager must be a `procurement_manager`. A salesperson's manager must be a sales manager. `GET /employees` for a procurement manager returns self plus that team; a procurement person gets self only. `employees.permissions` is stored and not enforced. Inquiry pricing uses the role and assignment scope, not that permissions column.

`employees.assigned_procurement_employee_id` stores the one procurement person who covers that salesperson. The control panel sends `assigned_salesperson_ids` when saving a procurement person. That write sets the column on the selected salespeople, clears it for salespeople removed from the selection, and stamps every unassigned inquiry for those salespeople, in any status. Matching uses the salesperson phone's last 10 digits and `employee_id`. Apply `supabase-procurement-routing.sql` before using the column.
