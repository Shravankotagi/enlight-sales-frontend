# Bot channels and HTTP boundaries

- `index.js`: Express setup, body limits, route mounting, health, import and Bigin sync routes, scheduler start.
- `src/webhook.js`: WhatsApp webhook verification/inbound event handling and message lifecycle.
- `src/whatsapp.js`: WhatsApp Cloud API outbound formatting/sending.
- `src/api/webChat.js`: browser/web chat HTTP interface.
- `src/assemblyai.js`: voice/audio transcription integration.

Keep webhook acknowledgement latency low. WhatsApp processing acknowledges first and continues asynchronously through a per-phone queue, so mutation handling must tolerate redelivery/overlap. Validate webhook handshake/authentication, normalize sender phone numbers once, retain media MIME/type metadata, and make outbound failure handling idempotent. Images can be large: do not log base64 or raw buffers.

## Role Isolation on Bot Channels
The WhatsApp assistant and WebChat channels are strictly dedicated to sales field operations:
- **WhatsApp Webhook (`src/webhook.js`)**:
  - Sender phone numbers are looked up against the `employees` table.
  - If the resolved employee has role `procurement_person` or `procurement_manager`, the webhook sends an automated reply:
    `"WhatsApp bot access is restricted to sales personnel. Please use the web portal to manage inquiries and base prices."`
  - The webhook immediately returns HTTP 200 and halts further processing without initiating LLM prompts, catalog flows, state machines, or DB mutations.
- **WebChat Endpoint (`src/api/webChat.js`)**:
  - Verifies JWT and checks employee role.
  - Requests from `procurement_person` and `procurement_manager` are rejected with HTTP `403 Forbidden`.
- **Bot Sales Scoping (`src/supabase.js`)**:
  - `getAccessibleSalespersonPhonesForBot` returns an empty array for procurement roles, ensuring fail-closed protection.
  - The procurement check runs before any `role.includes('manager')` test.
  - New inquiries saved by the bot start with `pricing_status = awaiting_price`, a unique `procurement_number`, and the procurement person assigned to that salesperson when one is set.

Bigin import/sync aliases and web-chat API-key/JWT checks are sensitive route boundaries. Do not add privileged unauthenticated routes or assume all aliases have the same protection.
