# Enlight Metals OS agent guide

Start with [em-os-frontend/knowledge/README.md](em-os-frontend/knowledge/README.md). It indexes the architecture, module guides, cross-app flows, data model, QA guidance, and project skills.

## Operating rules
- Read the relevant knowledge module and `em-os-frontend/.cursor/skills/<skill>/SKILL.md` before changing a domain area.
- Supabase is the active operational data store; Prisma does not model most commercial/CRM tables.
- Backend/bot authorization and salesperson scope are mandatory; frontend filters are not security.
- Preserve duplicate business logic parity across backend, bot, and frontend (pricing, HSN, image helpers, KB fixtures).
- Do not log or document secrets, tokens, OTPs, raw media, full phone numbers, or full LLM context.
- Update `em-os-frontend/knowledge` with any changed API, table, integration, workflow, test contract, or engineering convention.
- Every bug fix adds a regression test in the repo's regression folder (`em-os-bot/test/regression/`, `em-os-backend/src/__regression__/`, `em-os-frontend/src/test/regression/`), named `issue-<n>-<slug>`. Write it failing first, then fix. See [knowledge/qa/test-inventory.md](em-os-frontend/knowledge/qa/test-inventory.md).
- Tests must stay offline: mock Supabase, Prisma, and LLM clients with the per-repo helpers; never point tests at a real database.
- CI (`.github/workflows/ci.yml`, required check `ci`) must pass before merging to `main`. See [knowledge/qa/ci-and-branch-protection.md](em-os-frontend/knowledge/qa/ci-and-branch-protection.md).
- When changing pricing/HSN logic, update all three `pricing-parity.json` fixture copies together.
