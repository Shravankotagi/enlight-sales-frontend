# Employees and visibility

`EmployeesModule` manages `employees`, including list, next ID, creation, update, and deactivation. Employee phone and role underpin authorization, ownership, frontend “viewing as” filters, bot context, and Bigin assignment.

Never rely only on an arbitrary client `salesperson_phone`; resolve/validate it against the caller’s permitted scope. Deactivation must not orphan customer/deal visibility.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.

`procurement_person` and `procurement_manager` are employees roles. A procurement person reports through the existing `manager_id` / `manager_phone` columns, and that manager must be a `procurement_manager`. A salesperson's manager must be a sales manager. `GET /employees` for a procurement manager returns self plus that team; a procurement person gets self only. `employees.permissions` is stored and not enforced.
