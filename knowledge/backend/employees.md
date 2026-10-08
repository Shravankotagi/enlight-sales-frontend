# Employees and visibility

`EmployeesModule` manages `employees`, including list, next ID, creation, update, and deactivation. Employee phone and role underpin authorization, ownership, frontend “viewing as” filters, bot context, and Bigin assignment.

Never rely only on an arbitrary client `salesperson_phone`; resolve/validate it against the caller’s permitted scope. Deactivation must not orphan customer/deal visibility.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
