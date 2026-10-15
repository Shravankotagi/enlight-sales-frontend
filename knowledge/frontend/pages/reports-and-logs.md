# Reports and activity logs

`ReportsPage.tsx` uses `reportsApi` for overview/monthly/funnel/salesperson/SKU views. Its customer-visit table shows Verification, Location, Photo, and Documents. Verification is Phone verified or Phone not verified when `phone_verified` is set. Location shows the city and whether it was a GPS location or a typed location. Sync Bigin is shown there only for a signed-in admin or salesperson, then the overview is refetched. `LogsPage.tsx` queries `activityLogsApi` with module, date, search, salesperson, mode, and limit filters.

Reports are server-derived and scope-sensitive. Activity logs are business audit records—not a client telemetry sink. Validate filter state and pagination when changing either page.
