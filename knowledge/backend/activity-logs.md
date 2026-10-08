# Activity logs

`ActivityLogsModule` serves `activity_logs` to the Logs page. Events are also written by bot `logBotActivity`, often asynchronously. Fields include timestamp, actor/salesperson identity, module, action type, entity type/id, source, description, and change detail.

This is business audit data, not debug telemetry. Avoid sending high-volume request logs, secrets, raw messages, or large payloads here. Backend request diagnostics belong in `CustomLoggerService`; see the adding-logs skill.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
