# Customers

`CustomersPage.tsx` shows Sync Bigin only for a signed-in admin or salesperson, then refreshes the customer list. It lists/imports/updates customer data; `CustomerProfilePage.tsx` presents a single customer and related operations. Both consume `customersApi` and are constrained by the authenticated/viewing-as salesperson context.

The profile edit modal fills State from a GSTIN only when `evaluateCustomerGstin` accepts it: a 15-character GSTIN whose first two digits are a known state code. A blank GSTIN stays optional. A partial or invalid GSTIN shows "Enter a valid 15-character GSTIN. State is filled only from a valid GSTIN.", leaves State unchanged, and cannot be saved. Checksum is not validated. The profile header can still infer a state from a GSTIN that was already saved.

Avoid client-only ownership decisions. After a customer mutation, invalidate/refetch all customer, commercial, and insight views that depend on it.
