# Enlight Metals OS agent guide

Start with [knowledge/README.md](knowledge/README.md). It indexes the architecture, module guides, cross-app flows, data model, QA guidance, and project skills.

## Operating rules
- Read the relevant knowledge module and `.cursor/skills/<skill>/SKILL.md` before changing a domain area.
- Supabase is the active operational data store; Prisma does not model most commercial/CRM tables.
- Backend/bot authorization and salesperson scope are mandatory; frontend filters are not security.
- Preserve duplicate business logic parity across backend, bot, and frontend (pricing, HSN, image helpers, KB fixtures).
- Do not log or document secrets, tokens, OTPs, raw media, full phone numbers, or full LLM context.
- Update `knowledge/` with any changed API, table, integration, workflow, test contract, or engineering convention.
