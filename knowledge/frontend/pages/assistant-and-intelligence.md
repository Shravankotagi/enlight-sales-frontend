# Assistant and intelligence

`AssistantPage.tsx` sends text/image/GPS payloads with `chatbotApi`. Choosing Log Field Visit starts the same device location watch as the visit form and shows the reading under the composer. The paperclip offers Upload from device for a PDF only, and Capture an image, which opens the visit camera over the whole page, stamps the GPS, and rejects a photo without coordinates. An uploaded image is refused. `IntelligencePage.tsx` presents business intelligence. Accounts Requiring Attention, the reorder queue, and the lost-deals log each show 15 rows per page. Intelligence shows Sync Bigin only for a signed-in admin or salesperson. The backend client uses a 120-second assistant timeout. Interactive chat components may call bot-focused paths depending on deployment configuration.

Keep retries idempotent for mutation-capable messages, avoid logging prompt/image contents, and render model output with the existing markdown safety components rather than raw HTML.
