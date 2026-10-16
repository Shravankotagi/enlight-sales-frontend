# Bot channels and HTTP boundaries

- `index.js`: Express setup, body limits, route mounting, health, import and Bigin sync routes, scheduler start.
- `src/webhook.js`: WhatsApp webhook verification/inbound event handling and message lifecycle.
- `src/whatsapp.js`: WhatsApp Cloud API outbound formatting/sending.
- `src/api/webChat.js`: browser/web chat HTTP interface.
- `src/assemblyai.js`: voice/audio transcription integration.

Keep webhook acknowledgement latency low. WhatsApp processing acknowledges first and continues asynchronously through a per-phone queue, so mutation handling must tolerate redelivery/overlap. Validate webhook handshake/authentication, normalize sender phone numbers once, retain media MIME/type metadata, and make outbound failure handling idempotent. Images can be large: do not log base64 or raw buffers.

## Procurement and sales on the same bot
WhatsApp (`src/webhook.js`) and the dashboard assistant (`src/api/webChat.js`) share one engine. The employee row decides the conversation. `procurement_manager` contains the word `manager`, so the procurement check runs before any manager test, and the bot receives `procurement_person` or `procurement_manager`.
- A procurement person sees inquiries stamped with their employee id, plus unassigned inquiries for the salespeople routed to them. A manager also sees inquiries stamped to the procurement persons who report to them, and the open unassigned pool. The bot treats `new_inquiry` as open as well, because a WhatsApp log uses that status.
- Replies use the procurement number, salesperson, product, quantity, unit, delivery location, and pricing status. They leave out customer name, phone, email, and the raw inquiry text.
- The procurement menu is the same kind of interactive list the salesperson gets. Pending prices are `awaiting_price`, current inquiries are `price_ready` or `unavailable`, and log a base price opens the waiting inquiries. A manager also gets My team. A person who asks for My team is told it is for a manager. WhatsApp sends that list, and the dashboard assistant renders the same rows as buttons.
- Log a base price shows the first 7 waiting inquiries, newest first. Each line starts with the procurement number so it can be copied or tapped. When more than 7 are waiting, the reply says to view the rest in the Inquiries tab. Sending that number then asks for one rupee-per-MT base price per line.
- A procurement user can ask how many inquiries a salesperson in their scope still has left to price, and the same question works for price-ready and unavailable counts. The answer is the salesperson's name and the count. A salesperson outside that scope is refused. A blank or `unavailable` line can take a short note. One priced line makes the inquiry `price_ready`. Every line blank makes it `unavailable`. That save does not send credit, transport, loading, or margin, so it cannot wipe a sales price already stored. If `credit_per_mt` is not on the table yet, the save is retried without that column.
- Procurement cannot log an inquiry, send a quotation, send a decline email, create an order, or open visits, customers, complaints, or KRA. Photos are not used for base prices.
- A salesperson log no longer asks for a rate. A typed price is kept in the notes as a customer target and is not stored as `rate_per_mt`. The inquiry stays `awaiting_price`, keeps its procurement number, and keeps the procurement person copied from the salesperson. After it is `price_ready`, *Price this inquiry* asks for transport, loading, credit, and margin. A blank credit is 0. The sell rate is base + transport + loading + credit + margin, and the inquiry becomes `sales_priced`. Quoted, Won, and Lost stay closed until then. An all-unavailable inquiry tells the salesperson to send the decline from the dashboard. The bot does not send that email. An order still needs the saved sales rate. A historical inquiry with no `pricing_status` can still be ordered.

## Bot sales scoping
- `getAccessibleSalespersonPhonesForBot` returns an empty array for procurement roles, so they do not fall through into the sales catalog.
- New inquiries saved by the bot start with `pricing_status = awaiting_price`, a unique `procurement_number`, and the procurement person assigned to that salesperson when one is set.

Bigin import/sync aliases and web-chat API-key/JWT checks are sensitive route boundaries. Do not add privileged unauthenticated routes or assume all aliases have the same protection.
