# Authentication and RBAC flow

1. Frontend requests/verifies OTP with the backend.
2. It stores the issued token and selected employee viewing context in session storage.
3. Axios adds `Authorization` and a salesperson/mode filter to requests.
4. Backend guards/decorators validate identity and roles; service queries enforce accessible salesperson scope.
5. Bot separately resolves user scope by sender phone before running tools.

Client filters are a convenience; server and bot scope checks are the authorization boundary. Test salesperson, manager, and admin cases for every new query/mutation.

Procurement roles (`procurement_person`, `procurement_manager`) are limited by `JwtAuthGuard` to inquiries plus read-only products, pricing, and `GET /employees`. Pricing is saved on the inquiry, so it stays inside that allowed surface. The dashboard AI assistant (`/chat`, `/chat/kb`) is rejected there, with no chatbot code change. WhatsApp and the web assistant reply that procurement access is not enabled yet. Check `isProcurementRole()` before any `role.includes('manager')` test, because `procurement_manager` contains "manager".
