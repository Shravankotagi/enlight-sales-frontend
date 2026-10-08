# Backend guide

`em-os-backend` is NestJS 10 running on Express. `src/main.ts` bootstraps 50 MB request limits, CORS, validation, Swagger/configuration, global filters/interceptors; `src/app.module.ts` composes all modules. Business modules generally expose REST controllers backed by services using `SupabaseService`. `CommonModule` supplies guards, decorators, pagination, generic admin helpers, response transform, error filter, and logging.

Two identity systems coexist: Supabase Auth for legacy/onboarding admin routes and employee OTP JWTs for the Sales OS. Do not apply a guard pattern from one system to an endpoint of the other without checking its controller.

## Module map
- Commercial: [deals](deals.md), [inquiries](inquiries.md), [products](products.md), [pricing](pricing.md), [customers](customers.md)
- Operational: [KRA](kra.md), [reports](reports.md), [employees](employees.md), [activity logs](activity-logs.md), [Zoho](zoho.md)
- AI/assistant: [chatbot](chatbot.md)
- Identity/configuration: [auth and OTP](auth-and-otp.md), [template modules](template-modules.md)
- Cross-cutting: [common and infrastructure](common-and-infrastructure.md), [scripts](scripts.md)

The frontend’s exact public client contract is [../../src/lib/api.ts](../../src/lib/api.ts). Update it deliberately when the REST shape changes.
