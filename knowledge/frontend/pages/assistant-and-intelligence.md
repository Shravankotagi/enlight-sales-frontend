# Assistant and intelligence

`AssistantPage.tsx` sends text/image/GPS payloads with `chatbotApi`; `IntelligencePage.tsx` presents business intelligence. The backend client uses a 120-second assistant timeout. Interactive chat components may call bot-focused paths depending on deployment configuration.

Keep retries idempotent for mutation-capable messages, avoid logging prompt/image contents, and render model output with the existing markdown safety components rather than raw HTML.
