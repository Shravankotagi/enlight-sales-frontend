# Complaint lifecycle

Complaint intake occurs via `ComplaintsPage` or `complaintAgent`. Persist canonical complaint fields in `complaints`; persist attachment metadata in `complaint_attachments`; support status/resolution progression through the API. Input may include multiple photos or incomplete product information—capture the right context before mutation and keep attachment operations safe/idempotent.
