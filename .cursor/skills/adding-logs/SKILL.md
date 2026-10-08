---
name: adding-logs
description: Adds safe, useful diagnostic or business audit logging in Enlight Metals OS. Use when adding logs, telemetry, tracing, activity records, debugging output, or error instrumentation.
---
# Adding logs

Read `knowledge/00-overview/conventions.md` and the affected module guide first. Distinguish diagnostic logging from business audit activity.

## Choose the right destination
- Backend diagnostics: Nest `Logger` or `CustomLoggerService` with metadata. Existing HTTP lifecycle logging is in `common/interceptors/logging.interceptor.ts`.
- Bot diagnostics: `console.log`, `console.warn`, or `console.error` with a stable `[ModuleTag]` prefix.
- Business events: bot `logBotActivity` from `src/utils/activityLogger.js` or the established backend activity-log path. It is fire-and-forget and must never block or make a customer action fail.
- Frontend: use concise development diagnostics sparingly; provide user-visible failures via established UI/toast behavior, not console logs alone.

## Required fields and safety
Use only relevant structured metadata: `requestId`, `module`, `entityId`, `action`, `durationMs`, `statusCode`, and a masked phone (`***1234`) where needed.

Never log secrets/tokens, authorization headers, OTPs, full phones, raw images/base64/PDF contents, full LLM prompts/history, or unbounded API responses. Log error message/type and safe identifiers, not full sensitive payloads.

## Patterns
```ts
this.logger.log('Deal stage updated', { action: 'deal.stage.update', entityId: dealId, userId, duration });
this.logger.error('Deal stage update failed', { action: 'deal.stage.update', entityId: dealId, error });
```
```js
console.warn('[CatalogFlow] PO reservation conflict', { dealId, message: err.message });
logBotActivity({ module: 'Orders', action_type: 'update', entity_id: dealId, entity_type: 'deal', description: 'Order stage updated' });
```

## Review
- Log once at a boundary/outcome, not once per loop/item.
- Use consistent event names and existing module tags.
- Ensure failures in audit logging are swallowed/non-blocking where intended.
- Run the relevant QA checks and update knowledge if a new operational event is introduced.
