# Bot channels and HTTP boundaries

- `index.js`: Express setup, body limits, route mounting, health, import and Bigin sync routes, scheduler start.
- `src/webhook.js`: WhatsApp webhook verification/inbound event handling and message lifecycle.
- `src/whatsapp.js`: WhatsApp Cloud API outbound formatting/sending.
- `src/api/webChat.js`: browser/web chat HTTP interface.
- `src/assemblyai.js`: voice/audio transcription integration.

Keep webhook acknowledgement latency low. WhatsApp processing acknowledges first and continues asynchronously through a per-phone queue, so mutation handling must tolerate redelivery/overlap. Validate webhook handshake/authentication, normalize sender phone numbers once, retain media MIME/type metadata, and make outbound failure handling idempotent. Images can be large: do not log base64 or raw buffers.

A procurement sender is stopped in `webhook.js` and `webChat.js` before any catalog flow or assistant run, with a short message pointing them at the dashboard Inquiries page. `getAccessibleSalespersonPhonesForBot` returns no phones for those roles, and that check runs before `role.includes('manager')`. New inquiries saved by the bot start with `pricing_status = awaiting_price`, a unique `procurement_number`, and the procurement person assigned to that salesperson when one is set.

Bigin import/sync aliases and web-chat API-key/JWT checks are sensitive route boundaries. Do not add privileged unauthenticated routes or assume all aliases have the same protection.
