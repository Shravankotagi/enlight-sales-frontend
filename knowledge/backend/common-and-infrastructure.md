# Common and infrastructure

## Purpose
Centralizes auth, standard API behavior, cross-cutting logging, and database clients.

## Key files
- `src/common/guards/{supabase,role,roles,jwt}.guard.ts`: request authentication and role enforcement (`JwtAuthGuard` enforces perimeter allowlists for procurement roles).
- `src/common/decorators/{current-employee,roles}.decorator.ts`: controller metadata/access to identity.
- `src/common/interceptors/{logging,transform}.interceptor.ts`: request telemetry and response envelope.
- `src/common/filters/http-exception.filter.ts`: standardized errors.
- `src/common/services/{logger,pagination,generic-admin}.service.ts`.
- `src/infrastructure/{supabase,prisma}/`: database clients.

## Invariants
`CustomLoggerService` formats metadata and creates request identifiers; `LoggingInterceptor` records duration/status. Use `SupabaseService` for operational tables. Prisma's schema does not represent most production commercial/CRM tables. Guards must execute before a service acts on a user-supplied salesperson phone or entity ID.

`JwtAuthGuard` acts as an early perimeter firewall: tokens with role `procurement_person` or `procurement_manager` may use `/inquiries/*`, `GET` and `POST` on `/chat/message` and `/chat/sessions`, and read-only `GET` on `/products*`, `/pricing*`, and `/employees`. `/chat/kb` and every other route return `403 Forbidden` before reaching business controllers.

Most operational services use an admin/service-role Supabase client, bypassing database RLS. Enforce employee JWT/phone scope in service/controller code. Treat `x-bot-secret` and unauthenticated webhook/chat endpoints as sensitive integration boundaries; validate external callers before expanding their capabilities.
