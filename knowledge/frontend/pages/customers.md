# Customers

On a customer profile, Recent Confirmed Orders shows an item count such as "2 Items". Order Tonnage stays in its own column. The Orders tab still shows the count with MT.

An admin on a customer profile can delete that customer. The confirmation states that the customer and related inquiries, orders, visits, and complaints are removed. Other logins do not see the button, and the API rejects them. A name has to match the company, or share its phone with a compatible name. A short or unrelated name is left in place.

`CustomersPage.tsx` shows Sync Bigin only for a signed-in admin or salesperson, then refreshes the customer list. It lists/imports/updates customer data; `CustomerProfilePage.tsx` presents a single customer and related operations. Both consume `customersApi` and are constrained by the authenticated/viewing-as salesperson context.

The profile edit modal fills State from a GSTIN only when `evaluateCustomerGstin` accepts it: a 15-character GSTIN whose first two digits are a known state code. A blank GSTIN stays optional. A partial or invalid GSTIN shows "Enter a valid 15-character GSTIN. State is filled only from a valid GSTIN.", leaves State unchanged, and cannot be saved. Checksum is not validated. The profile header can still infer a state from a GSTIN that was already saved.

Avoid client-only ownership decisions. After a customer mutation, invalidate/refetch all customer, commercial, and insight views that depend on it.
