# Inquiries, pipeline, and orders

`InquiriesPage.tsx` also supports the pipeline redirect (`/pipeline` → `/inquiries?view=pipeline`). `OrdersPage.tsx` displays won deals. They use `inquiriesApi`, `dealsApi`, `ordersApi`, and `productsApi` from `lib/api.ts`; detail and quoting use DealDetailDrawer, SalesQuotationModal, InquiryPdfModal, `AddProductDialog`, and System PO helpers.

In the Inquiry Logging Form (`InquiriesPage.tsx`), all line items are scanned against the standard HSN catalog (`normalizeProductToCatalog`) and custom rows in the `products` table. Unrecognized products leave `HSN/SAC` empty (never fabricating `72083840`), block saving the inquiry until resolved, and display a single consolidated notice (with deduplicated product names, catalog suggestion pills, an **Add Product** button opening `AddProductDialog`, and a **View product list** popup modal showing `MASTER_PRODUCTS_CATALOG`) positioned below the Company Name field and above the Line Items table.

System PO allocation is a reservation protocol, not just a display field. Retain/release the reservation token correctly on success, cancel, retry, and conflicts. Keep inquiry status, deal stage, item data, and generated/reference PO fields consistent with backend/bot rules.

