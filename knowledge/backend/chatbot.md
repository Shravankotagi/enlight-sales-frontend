# Backend chatbot and knowledge base

`ChatbotModule` exposes `/chat` features: message/session APIs, knowledge-base document APIs, guardrails, and a WhatsApp channel adapter. `chatbot.service.ts` handles assistant work; `kb/kb.service.ts` stores/retrieves `kb_documents` and `kb_chunks`; `guardrails/guardrails.service.ts` enforces policy; `whatsapp/` connects a channel.

The bot is a separate, more extensive assistant service. The frontend calls backend `/chat/message` with a 120s timeout, while direct web bot routing may use the bot. Clarify which channel is being altered before changing prompts, session storage, or KB semantics.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
