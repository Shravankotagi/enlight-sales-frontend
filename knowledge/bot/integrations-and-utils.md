# Bot integrations and shared utilities

- `supabase.js`: broad database access, scope helpers, persistence and business queries.
- `gemini.js`: Gemini invocation/configuration.
- `agents/biginSyncAgent.js`: Zoho Bigin synchronization.
- `utils/pricingEngine.js`, `utils/hsnDetector.js`: commercial product rules; duplicated in backend/frontend.
- `utils/quotationPdf.js`: quotation PDFs.
- `utils/imageCompressor.js`: media size handling.
- `utils/activityLogger.js`: fire-and-forget business events to `activity_logs`.
- `utils/jsonUtils.js`: model/JSON cleanup.

Integrations must fail visibly to application logs but should not make non-critical activity logging block a customer response. Never include tokens, full phone numbers, raw images, or full LLM context in logs.
