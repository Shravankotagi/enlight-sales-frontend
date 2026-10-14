# KRA engine and scheduled work

KRA features are split across `kra2.js`, `kra3.js`, `kra5.js`, `kra8.js`, `kra9.js`, `kraReport.js`, and `scheduler.js`. The scheduler starts from `index.js`; KRA code computes/records metrics and reports using operational tables such as deals, visits, payment tracking, and `kra_logs`. Current scheduled reminders include customer retention (daily 21:00 IST), visits (Friday 17:00), payments (09:00 and 15:00), and complaints (10:00 and 22:00).

Before changing a calculation, identify its source rows, date boundary/time zone, unit conversion, idempotency key, and dashboard consumer. Scheduled jobs must tolerate retries and must not double-write daily/period metrics. Use the dedicated KRA scripts only against a safe database unless their writes are understood.
