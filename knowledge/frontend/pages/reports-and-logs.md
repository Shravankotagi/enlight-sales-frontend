# Reports and activity logs

`ReportsPage.tsx` uses `reportsApi` for overview/monthly/funnel/salesperson/SKU views. Sync Bigin is shown there only for a signed-in admin or salesperson, then the overview is refetched. `LogsPage.tsx` queries `activityLogsApi` with module, date, search, salesperson, mode, and limit filters.

Reports are server-derived and scope-sensitive. Activity logs are business audit records—not a client telemetry sink. Validate filter state and pagination when changing either page.
