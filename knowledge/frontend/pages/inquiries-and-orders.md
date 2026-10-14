# Inquiries, pipeline, and orders

`InquiriesPage.tsx` also supports the pipeline redirect (`/pipeline` → `/inquiries?view=pipeline`). `OrdersPage.tsx` displays won deals. They use `inquiriesApi`, `dealsApi`, `ordersApi`, and `productsApi` from `lib/api.ts`; detail and quoting use DealDetailDrawer, SalesQuotationModal, InquiryPdfModal, `AddProductDialog`, and System PO helpers.

In the Inquiry Logging Form (`InquiriesPage.tsx`), all line items are scanned against the standard HSN catalog (`normalizeProductToCatalog`) and custom rows in the `products` table. Unrecognized products leave `HSN/SAC` empty (never fabricating `72083840`), block saving the inquiry until resolved, and display a single consolidated notice (with deduplicated product names, catalog suggestion pills, an **Add Product** button opening `AddProductDialog`, and a **View product list** popup modal showing `MASTER_PRODUCTS_CATALOG`) positioned below the Company Name field and above the Line Items table.

System PO allocation is a reservation protocol, not just a display field. Retain/release the reservation token correctly on success, cancel, retry, and conflicts. Keep inquiry status, deal stage, item data, and generated/reference PO fields consistent with backend/bot rules.

## Procurement View & Base Pricing Workflow

When accessed by users with `procurement_person` or `procurement_manager` roles:
- **Scope & Intake Pool**: The inquiries list displays inquiries assigned to the user/team plus all open inquiries in the **Unassigned Intake Pool** (`stage IN ('new', 'pending', 'review', 'draft')` where `procurement_employee_id IS NULL`).
- **Base Price Entry**: The line items table exposes supplier base price fields (`inquiry_items.base_price_per_unit`), enabling procurement specialists to record supplier costs directly.
- **Procurement Assignee Selector**: Admins and Procurement Managers can assign or reassign any inquiry to a specific procurement team member via `PATCH /inquiries/:id/procurement-assignee`.
- **UI Action Guards**:
  - Commercial action buttons (**Send Quotation**, **Quotation Preview**, **Convert to Deal**, **Confirm Order**, **Mark as Won**, **Mark as Lost**) are completely hidden/disabled for procurement roles.
  - Delete action is hidden for `procurement_person` (procurement managers may only delete team-assigned records, not unassigned pool records).
- **Orders Page (`OrdersPage.tsx`)**: Orders represent confirmed commercial deals. This page is completely hidden from navigation for procurement roles, and its underlying API routes are blocked by `JwtAuthGuard` perimeter rules (`403 Forbidden`).

