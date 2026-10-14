# Shared components, hooks, and libraries

- `components/Layout.tsx`: protected dashboard shell/navigation with dynamic link visibility based on user permissions.
- `components/DealDetailDrawer.tsx`, `SalesQuotationModal.tsx`, `InquiryPdfModal.tsx`: commercial detail/quotation/PDF interactions.
- `components/RolePermissionsMatrixModal.tsx`, `components/ZohoPermissionsTable.tsx`: Zoho Books-style granular permissions modal and matrix table.
- `components/RoleSelectDropdown.tsx`: employee role dropdown with department styling and manager constraints.
- `constants/aclConstants.ts`: default permission matrices per role and sub-options (`fill_base_prices`, `team_inquiries`).
- `components/KnowledgeBaseModal.tsx`: KB management UI.
- `components/chat/*`: interactive assistant catalog/buttons.
- `CustomerCombobox.tsx`, `DealProductCombobox.tsx`: selection contracts tied to API data.
- `DateFilterControl.tsx`, `PaginationControl.tsx`: reusable query controls.
- `hooks/useSystemPoConflictSuggestion.ts`, `lib/systemPo.ts`: System PO reservation/conflict behavior.
- `utils/{pricingEngine,hsnDetector,image?}.ts`: shared business helpers where present.

Use `lib/api.ts` rather than ad-hoc Axios calls. Keep error states, loading states, cache invalidation, filters, and business field names aligned with the page that consumes a component.
