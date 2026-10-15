# Assistant and intelligence

`AssistantPage.tsx` sends text/image/GPS payloads with `chatbotApi`. The paperclip offers Upload from device for an optional document and Capture an image, which uses the visit camera, stamps the GPS, and rejects a photo without coordinates. `IntelligencePage.tsx` presents business intelligence. Intelligence shows Sync Bigin only for a signed-in admin or salesperson. The backend client uses a 120-second assistant timeout. Interactive chat components may call bot-focused paths depending on deployment configuration.

Keep retries idempotent for mutation-capable messages, avoid logging prompt/image contents, and render model output with the existing markdown safety components rather than raw HTML.
