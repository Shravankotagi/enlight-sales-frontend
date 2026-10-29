# Complaints

`ComplaintsPage.tsx` shows Sync Bigin only for a signed-in admin or salesperson, then reloads the complaint list. It uses `complaintsApi` under `/kra/complaints`, including attachments and status/resolution updates. Edit Details and Reopen stay hidden unless `complaints.update` is on, and Mark as Resolved still needs `complaints.resolve`. The bot complaint agent can create the same data. The log-complaint company list is customers on confirmed orders in the same salesperson scope as the Orders page, not every assigned customer. A complaint cannot be saved for a company that is not in that list. The log and view complaint dialogs are `max-w-7xl`.

Maintain attachment ordering, product/context information, status values, and allowed edit restrictions. Do not put image payloads into browser console output.
