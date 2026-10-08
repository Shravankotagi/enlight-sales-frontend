# WhatsApp message lifecycle

```mermaid
sequenceDiagram
  participant W as WhatsApp
  participant H as webhook.js
  participant O as Orchestrator
  participant T as Bound tools
  participant DB as Supabase
  W->>H: webhook event
  H->>H: verify and normalize sender/media
  H->>O: message plus phone and metadata
  O->>DB: scope, context, history
  O->>T: Gemini-selected tool work
  T->>DB: scoped read or validated write
  O->>DB: chat history and session records
  O->>H: formatted reply
  H->>W: outbound message
```

Failures must return a user-safe response, log context without sensitive payloads, and not duplicate a mutation when WhatsApp redelivers an event. Trace `webhook.js`, `whatsapp.js`, `core/orchestrator.js`, and `core/tools.js` together.
