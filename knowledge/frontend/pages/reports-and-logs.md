# Reports and activity logs

`ReportsPage.tsx` uses `reportsApi` for overview/monthly/funnel/salesperson/SKU views. Sync Bigin is shown there only for a signed-in admin or salesperson, then the overview is refetched. Admins also see a Login activity table from `activityLogsApi` (`module: Auth`) for the current rep and date range. `LogsPage.tsx` queries `activityLogsApi` with module, date, search, salesperson, mode, and limit filters. Admins get a Login / Logout module (salesperson filter, IST times, duration, and CSV) and a User Management module (activate, deactivate, delete), each with an action filter. Salesperson views do not include those rows.

Reports are server-derived and scope-sensitive. Activity logs are business audit records—not a client telemetry sink. Validate filter state and pagination when changing either page.
