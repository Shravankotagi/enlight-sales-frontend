---
name: bot-flow-change
description: Safely changes Enlight Metals WhatsApp or web-chat bot routes, tools, agents, catalog flows, LangGraph orchestration, sessions, or conversational state. Use for bot behavior changes.
---
# Bot flow change

Read `knowledge/bot/README.md`, the matching agent/core guide, and affected `knowledge/flows/` guide.

1. Identify channel, orchestrator/tool contract, pending/session state, and database side effect.
2. Make the smallest change compatible with CommonJS conventions and tagged logging.
3. Preserve user scope checks, active/pending flow transitions, direct tool replies, history/session writes, and eight-record output cap.
4. Revalidate database state immediately before mutations; handle delivery retries safely.
5. Run focused bot tests/scripts only after confirming their database effects. Update docs and QA inventory for new paths.
