# Customer agent

`src/agents/customerAgent.js` onboards and updates recurring customer profiles, resolving ownership and customer identity. Customer 360 keeps a stored segment only when it is exactly `key_account`, `growth`, or `new`; otherwise it uses the Customer Health tonnage, value, and order rule. It operates on `recurring_customers` and must respect the caller’s scope. Avoid weak name-only updates when a stable customer/phone identity is available.
