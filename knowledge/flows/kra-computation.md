# KRA computation flow

`customer_visits`, deals/orders, payments, and follow-ups supply source activity. KRA modules/job code calculate/record results in `kra_logs` and related operational rows. Backend KRA/report APIs project these results to the dashboard. Changes require agreement on period/date boundary, unit conversion, visibility scope, and idempotent scheduled execution.
