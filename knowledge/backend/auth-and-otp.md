# Authentication and OTP

`AuthModule` exposes OTP request/verification through `auth.controller.ts` and `auth.service.ts`; `OtpModule` owns OTP persistence/lifecycle through `otp_sessions`. The frontend calls `/auth/request-otp` and `/auth/verify-otp`, normalizing Indian phone numbers with the `91` prefix in `src/lib/api.ts`.

Successful auth produces the token consumed by the global frontend Axios interceptor as `Authorization: Bearer …`. OTP employee JWTs are distinct from Supabase Auth tokens used by legacy/admin endpoints. Backend authorization is layered: the relevant token guard, employee identity, and role/scope checks. Do not treat a frontend filter as authorization.

`request-otp` is an externally reachable boundary: never return a development OTP or credentials in production responses/logs.

## Safe modification path
Trace controller → service → Supabase query before changing behavior. Preserve `supabase.guard`, role/scope checks, response envelope, activity/audit side effects, and related frontend `api.ts` contract.
