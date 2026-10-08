# Stack, runtime, and environment

## Commands
- Root: `npm run dev:backend`, `npm run dev:bot`, `npm run dev:frontend`.
- Backend: Node 20+, NestJS 10 on Express, TypeScript, Supabase JS, Prisma, Jest. `npm run build`, `npm test`, `npm run lint`.
- Bot: Node/Express, CommonJS, LangChain/LangGraph, Google Gemini. `npm run dev`, `npm test`, `npm run chat`.
- Frontend: React 19, TypeScript, Vite, React Router, TanStack Query, Axios. `npm run build`, `npm run lint`.

## Environment names (names only)

| App | Required integration variables |
|---|---|
| Backend | `PORT`, `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `JWT_SECRET` |
| Bot | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`, `SALES_LEAD_PHONE` |
| Frontend | `VITE_BACKEND_URL`, `VITE_BOT_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Do not copy values from `.env` into documentation, tests, commits, or logs. Use the `.env.example` files as the safe configuration contract.
