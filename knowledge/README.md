# Enlight Metals OS knowledge base

Use this as the entry point before changing code. It is an implementation map, not a substitute for reading the referenced code.

## Find the right guide
- System boundaries, runtime setup, business terms: [00-overview/](00-overview/)
- NestJS API and data services: [backend/README.md](backend/README.md)
- WhatsApp/web-chat assistant and its agents: [bot/README.md](bot/README.md)
- React dashboard and pages: [frontend/README.md](frontend/README.md)
- Requests crossing project boundaries: [flows/](flows/)
- What to test: [qa/](qa/)

## Non-negotiable rules
1. The operational business database is Supabase, not the limited Prisma schema.
2. Keep duplicated pricing, HSN, image compression, and KB fixtures aligned across apps.
3. Never put credentials, JWTs, full phone numbers, raw images, or full prompts in docs or logs.
4. Read the relevant Cursor skill before modifying a feature.
