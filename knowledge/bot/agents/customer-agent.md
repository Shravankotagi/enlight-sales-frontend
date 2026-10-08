# Customer agent

`src/agents/customerAgent.js` onboards and updates recurring customer profiles, resolving ownership and customer identity. It operates on `recurring_customers` and must respect the caller’s scope. Avoid weak name-only updates when a stable customer/phone identity is available.
