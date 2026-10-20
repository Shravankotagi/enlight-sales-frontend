# Complaints

`ComplaintsPage.tsx` shows Sync Bigin only for a signed-in admin or salesperson, then reloads the complaint list. It uses `complaintsApi` under `/kra/complaints`, including attachments and status/resolution updates. The bot complaint agent can create the same data. The log-complaint company list is only customers assigned to a salesperson, using the same phone scope as inquiries. A complaint cannot be saved for a company that is not in that list. The log and view complaint dialogs are `max-w-7xl`.

Maintain attachment ordering, product/context information, status values, and allowed edit restrictions. Do not put image payloads into browser console output.
