# Authentication and RBAC flow

1. Frontend requests/verifies OTP with the backend.
2. It stores the issued token and selected employee viewing context in session storage.
3. Axios adds `Authorization` and a salesperson/mode filter to requests.
4. Backend guards/decorators validate identity and roles; service queries enforce accessible salesperson scope.
5. Bot separately resolves user scope by sender phone before running tools.

Client filters are a convenience; server and bot scope checks are the authorization boundary. Test salesperson, manager, and admin cases for every new query/mutation.
