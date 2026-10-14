# Customers

`CustomersPage.tsx` shows Sync Bigin only for a signed-in admin or salesperson, then refreshes the customer list. It lists/imports/updates customer data; `CustomerProfilePage.tsx` presents a single customer and related operations. Both consume `customersApi` and are constrained by the authenticated/viewing-as salesperson context.

Avoid client-only ownership decisions. After a customer mutation, invalidate/refetch all customer, commercial, and insight views that depend on it.
