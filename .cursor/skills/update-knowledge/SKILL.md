---
name: update-knowledge
description: Maintains Enlight Metals OS agent documentation, architecture maps, module guides, QA docs, and Cursor skills after code or integration changes. Use when interfaces, modules, tables, workflows, tests, or conventions change.
---
# Update knowledge

1. Find the affected module guide via `knowledge/README.md`.
2. Update purpose, key files, data tables, endpoints/functions, dependencies, invariants, and tests only when facts changed.
3. Update a `knowledge/flows/` document for cross-app lifecycle changes.
4. Update `knowledge/00-overview/data-model.md` for table/RLS changes and `knowledge/qa/` for test contract changes.
5. Keep docs concise, link to code instead of copying it, and never record secrets or live customer data.
6. Verify internal markdown links before handoff.
