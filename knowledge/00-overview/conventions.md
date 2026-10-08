# Engineering conventions and important gotchas

## Boundaries
- Use the backend REST APIs from new dashboard code; do not add direct database writes merely to bypass authorization.
- Bot actions are tool-driven. Preserve the tool contracts and state/session side effects when changing agent routing.
- The operational schema is implemented in Supabase SQL files and code, not fully in `em-os-backend/prisma/schema.prisma`.

## Duplicated logic
These implementations should be reviewed together when business rules change:
- `pricingEngine`: backend pricing module, bot `src/utils/pricingEngine.js`, frontend `src/utils/pricingEngine.ts`.
- `hsnDetector`: backend utility, bot utility, frontend utility.
- `imageCompressor`: backend utility and bot utility.
- `sample-kb-documents`: backend and frontend fixture copies.

## Conventions
- Backend uses controller → service → Supabase, Nest guards/decorators, response transform/filter/interceptor plumbing.
- Bot uses CommonJS and tagged logs such as `[Orchestrator]`.
- Frontend access goes through `src/lib/api.ts`; it injects the JWT plus salesperson filter. Existing callers use both `response.data` and `response.data.data`, so normalize response envelopes consciously when adding an endpoint.
- Use stable IDs, phone normalization, and canonical table names; do not introduce near-duplicate fields or stage names.

See `.cursor/skills/adding-logs/SKILL.md` and `.cursor/skills/update-knowledge/SKILL.md` before relevant changes.
