# Activity logs

`ActivityLogsModule` serves `activity_logs` to the Logs page. Events are also written by bot `logBotActivity`, often asynchronously. Role create, update, delete, and employee role changes use module `Roles`. Rows in `Roles`, `Auth`, and `Employees` are returned only to people with `staff.view`.

Login and logout use the same table with `module: Auth`, `action_type` `login` or `logout`, and `entity_id` set to the JWT `sid`. An inquiry stage change is stored once as `Inquiry INQ-XXXXXX details updated for {company} (Stage: {New Inquiry|Price Quote|Negotiation|On Hold|Closed Won|Closed Lost})`. Admin and salesperson logs show that same sentence. Admin activate, deactivate, and delete use `module: Employees` and `action_type` `employee_activated`, `employee_deactivated`, or `employee_deleted`. `GET /activity-logs` returns Auth and Employees rows only when `employee.role === 'admin'`. The module menu counts are exact totals for the selected dates, not the 500-row page cap. Other roles get `module.is.null,module.not.in.(Auth,Employees)`. A login row is paired with its logout (`logout_at`, `logout_status`, `duration_minutes`). A 30-minute idle logout is `Session expired. {name} ({employee id}) logged out.` on the Auth logout row and on that person's login row. No logout row means `No logout recorded`. There is no edit or delete API.

This is business audit data, not debug telemetry. Avoid sending high-volume request logs, secrets, raw messages, or large payloads here. Backend request diagnostics belong in `CustomLoggerService`; see the adding-logs skill.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
