# Domain glossary

- **Inquiry**: pre-order commercial request. The bot and UI may refer to its generated identity as `INQ-…`.
- **Deal / Order**: a CRM commercial record in `deals`; a won deal is displayed as an order.
- **System PO**: a system-generated purchase-order number. Allocation is a reservation workflow; retain its reservation token through the transition.
- **KRA**: Key Result Area operational metrics and activity calculations; source data includes visits, deals, collections, and KRA logs.
- **Bigin**: Zoho Bigin CRM. The bot and backend include synchronization paths.
- **HSN**: Harmonized System of Nomenclature code inferred/validated for metal products.
- **Floor margin**: minimum permitted margin, used by pricing and approval guardrails.
- **Follow-up task**: action derived from visits, payment, customer retention, or KRA work.
- **Salesperson scope**: frontend and backend filter company data by employee phone, employee role, and manager/team visibility.
- **Procurement scope**: backend filter for `procurement_person` and `procurement_manager`. An inquiry is visible only when `procurement_employee_id` is the caller or, for a manager, a procurement person who reports to them.
- **Role Permissions Matrix**: Zoho Books-style granular ACL matrix stored in `employees.permissions` (JSONB) defining module-level View/Create/Edit/Delete actions and sub-options (e.g. `fill_base_prices`, `team_inquiries`).
