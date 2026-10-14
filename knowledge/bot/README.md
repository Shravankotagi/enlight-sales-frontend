# Bot guide

`em-os-bot` is a CommonJS Express service. `index.js` sets 25 MB JSON limits, mounts `/webhook` and `/chat/web`, exposes import/sync/health routes, and starts the scheduler. Its main assistant path is channel → `runOrchestrator` → LangGraph agent/tool loop → Supabase/CRM/AI → persisted history → formatted reply.

Read [channels.md](channels.md) for transport, [orchestrator-and-state.md](orchestrator-and-state.md) for tool execution, [catalog-flow.md](catalog-flow.md) for deterministic commercial flows, and [agents/](agents/) for specialized actions.

This repository contains large, stateful files. Make minimal scoped changes and test the exact conversation branch; do not refactor call contracts casually.
