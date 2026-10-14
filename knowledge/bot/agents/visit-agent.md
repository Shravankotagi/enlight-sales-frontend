# Visit agent

`src/agents/visitAgent.js` creates and updates customer visits, extended fields, follow-ups, and visit-related customer handling. It writes `customer_visits` and may derive `followup_tasks`/KRA effects. Dates, actor ownership, and editable/non-editable field rules are important; test create, update, follow-up completion, and exact retrieval.
