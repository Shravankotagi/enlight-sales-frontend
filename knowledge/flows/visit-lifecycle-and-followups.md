# Visit and follow-up lifecycle

Visits originate from `VisitsPage` or `visitAgent`, are persisted in `customer_visits`, and can create/update `followup_tasks` and KRA-related activity. Update flows must preserve their field authority and use a specific visit identity; never update a guessed latest visit. Follow-up completion should update the same canonical record, then refresh dashboard/action-queue data.
