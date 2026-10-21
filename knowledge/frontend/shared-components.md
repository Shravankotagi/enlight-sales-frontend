# Shared components, hooks, and libraries

- `components/Layout.tsx`: protected dashboard shell and navigation. Procurement roles see only Inquiries.
  - **Sidebar Architecture**: Collapsible rail (`w-72` open, `w-20` collapsed) with smooth hover enlargement (`w-[22rem]`).
  - **Zero Layout Shift**: Fixed desktop spacer rail holds the page content layout position firmly; the floating aside expands over page content on hover without shifting page elements.
  - **Compositor & 120 FPS Performance**: Uses 200 ms Lenis-style ease-out curve (`cubic-bezier(0.2, 0, 0, 1)`), pure GPU alpha-blend dimming (`bg-slate-900/15 will-change-[opacity]`, avoiding expensive Gaussian blur shaders), pre-baked shadow opacity overlay, fixed item heights (`h-11`) and typography (`text-xs`) to prevent vertical jitter, and GPU-composited icon scaling (`scale-110`).
  - **State Persistence**: Persists open/collapsed state to `localStorage` (`em_sidebar_open`) synchronously on mount and toggle.
  - **Accessibility**: Includes `motion-reduce:transition-none` and respects operating system reduced motion preferences.
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
