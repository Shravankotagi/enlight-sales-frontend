# KRA dashboard

`KRADashboard.tsx` reads dashboard, sheets, logs, and action queue from `kraApi`. It is a projection of database and scheduled/bot-driven KRA writes; it should not recreate business calculation rules client-side.

When changing filters or visualizations, verify period boundaries, salesperson/manager scope, metrics units, and empty/error states.
