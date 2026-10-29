# Procurement test cases

Manual script for the procurement module on the dashboard and in WhatsApp. Record Pass or Fail for each case. A case fails when the expected result does not happen, even if a nearby case passes.

The shorter role pass is [procurement-manual-test-suite.md](procurement-manual-test-suite.md). Automated coverage is listed in [test-inventory.md](test-inventory.md).

Do not run this against production customer data. Do not write phone numbers, tokens, or raw inquiry text into the result notes.

## Setup

Apply these backend SQL files before the first case:

- `supabase-procurement-acl.sql`
- `supabase-inquiry-line-pricing.sql`
- `supabase-inquiry-line-credit.sql`
- `supabase-procurement-routing.sql`
- `supabase-pricing-status-preserve.sql`
- `supabase-procurement-tonnage-review.sql`

Use four accounts:

- **Person:** a procurement person who reports to the manager below.
- **Manager:** that procurement manager.
- **Sales:** a salesperson routed to Person.
- **Other:** a second procurement person who does not report to Manager.
- **Admin:** only for assignment and ACL cases.

Prepare two inquiries for Sales, each with two product lines, a quantity, a unit, and a delivery location. One delivery is in Maharashtra. The other is outside Maharashtra. Leave Sales unrouted at the start, so neither inquiry has a procurement owner. Note each `PR-` number after it appears. Call them Inquiry A (Maharashtra) and Inquiry B (other state).

## 1. Navigation and anonymity

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| N1 | Person | Person is logged in | Open the app and look at the sidebar | Only Inquiries is available. Dashboard, Orders, Customers, Visits, Complaints, Intelligence, Reports, and Logs are absent | |
| N2 | Person | On any other route | Open `/procurement` | The browser lands on `/inquiries` | |
| N3 | Manager | Manager is logged in | Open the sidebar | Only Inquiries is available, same as Person | |
| N4 | Person | Inquiry A is visible | Read the list row and open the drawer | Customer name, phone, email, and raw inquiry text are absent. Salesperson, products, quantity, unit, and delivery location are present. The `PR-` number and the inquiry id are both shown and they are different | |
| N5 | Sales | Same inquiry | Open the inquiries list and the drawer | Customer name and the inquiry text are visible. The `PR-` number is still shown | |
| N6 | Person | On Inquiries | Click Kanban View | The pipeline opens on the first click | |
| N7 | Person | On the list | Search by the `PR-` number, then by the salesperson name, then by a product | Each search returns Inquiry A. A customer name search does not | |
| N8 | Person | Header of Inquiries | Look beside Refresh | Sync Bigin, View Confirmed Orders, and Log New Inquiry are hidden. Refresh remains | |

## 2. Scope

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| C1 | Person | Sales is not routed to Person, and no inquiry is stamped to Person | Open Inquiries | Inquiry A and Inquiry B are absent. Rows stamped to someone else are absent | |
| C2 | Admin | Sales is not yet routed to Person | In the control panel, assign Sales to Person and save | The save succeeds. A new inquiry from Sales is stamped to Person without a manual assign | |
| C3 | Person | After C2, refresh | Open Inquiries | Inquiry A and Inquiry B appear stamped to Person, with `PR-` numbers. Neither row says Unassigned | |
| C4 | Other | Other is a different procurement person | Open Inquiries | Inquiry A and Inquiry B are absent | |
| C5 | Manager | Person reports to Manager, and Sales is routed to Person | Open Inquiries | Manager sees Inquiry A and Inquiry B stamped to Person, and inquiries stamped to Manager. A row with no procurement owner is absent | |
| C6 | Manager | An inquiry belongs to a salesperson who is not routed to anyone | Look for that row | It is absent. It is not labeled as a queue. After that salesperson is routed, the row is stamped and then appears | |
| C7 | Admin | An inquiry is already stamped to Person | Route its salesperson to Other | The existing row stays with Person. Only a new inquiry for that salesperson goes to Other | |
| C8 | Person | An Awaiting Price inquiry of Sales, known from the sender or the customer owner, still has no procurement owner | Open it and save a base price | The row is stamped to Person and the save succeeds. A row already owned by someone else stays denied | |

## 3. Base price

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| B1 | Person | Inquiry A is Awaiting Price and Person can fill base prices | Open the drawer | The base price box and the note box are editable. Save Prices is in the sticky footer. Description, HSN, and quantity are read-only. Transport, loading, credit, and margin are hidden | |
| B2 | Person | Inquiry A has two lines | Enter a positive base price on line 1. Leave line 2 blank. Add an optional note on line 2. Click Save Prices | The button shows Saving, then a success toast. Line 1 is available. Line 2 is unavailable. The inquiry becomes Price Ready. The note is kept on the blank line | |
| B3 | Person | Inquiry A is now Price Ready | Open the drawer again | The saved base price is visible. Save Prices is hidden. The price box and note box are read-only | |
| B4 | Person | Inquiry B is Awaiting Price | Save with every base price blank | The inquiry becomes Unavailable. Save Prices is hidden afterward | |
| B5 | Person | A view-only procurement user, including one whose Fill base prices checkbox is still on | Open an Awaiting Price inquiry | The price box and the note box are disabled. Save Prices is absent. Nothing is written if they try to save | |
| B6 | Person | Price Ready inquiry | Try to edit the base price or the note | Both stay read-only | |
| B7 | Person | During a save that the server rejects | Click Save Prices | The toast shows the server error. The status stays Awaiting Price | |
| B8 | Person | A base price is typed but not saved, then the list refreshes | Wait for the list refresh | The in-progress base price is not cleared. A newer status such as Price Ready is not replaced by Awaiting Price | |
| B9 | Person | Inquiry created before 15 Oct 2026 with no saved price | Open it | It keeps its original status. It is not treated as Awaiting Price and cannot be priced | |
| B10 | Manager | A team inquiry is Awaiting Price | Save one positive base price and leave the other blank | Same result as B2. Status becomes Price Ready | |
| B11 | Person | Any inquiry | Try to log a new inquiry, send a quotation, or mark it confirmed, won, or lost | Each action is blocked. Share Quotation and Share Again stay hidden | |

## 4. Amounts and tax

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| T1 | Person | A line whose weight is shown in MT and a base price is entered | Read the line amount before saving | The amount is that MT weight times the per-MT rate. A missing weight makes the amount 0. The drawer shows Sub Total only, without CGST, SGST, IGST, or a grand total | |
| T2 | Sales | Inquiry A is Price Ready, delivery in Maharashtra, one line available | Enter base, transport, loading, credit, and margin. Save prices | Rate equals base + transport + loading + credit + margin. A blank credit is 0. The row shows CGST 9% and SGST 9% | |
| T3 | Sales | Inquiry B is Price Ready, delivery outside Maharashtra | Save prices the same way | The row shows IGST 18% only | |
| T4 | Sales | Two available lines | Use Copy to all for transport, loading, and margin | Those three values copy only to available rows. An unavailable row stays unchanged | |
| T5 | Sales | After T2 | Send the quotation | The quotation uses the saved rate for available lines only. The total matches the rate times the MT weight | |
| T6 | Sales | Every line is unavailable | Open the drawer and Send Decline Email | Send quotation is not the action. The modal names the material, asks for the customer email, and keeps `dj@enlightmetals.com` and `vedant@enlightmetals.com` locked in CC. Sending it records the decline | |
| T7 | Sales | Procurement has saved a base price | Change the working base and save again | The quotation uses the salesperson's base. Procurement's original base is still stored | |
| T8 | Sales | A price was saved | Refresh the inquiry | The saved rate, amount, and GST stay. They are not replaced with zero | |

## 5. Sales follow-through

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| F1 | Sales | The inquiry badge is Price Quote | Open Update Status and choose Lost, then repeat for Negotiation and On Hold on three Price Quote inquiries, or return one inquiry between tries if only one exists | Each move succeeds. The badge becomes Lost, Negotiation, or On Hold | |
| F2 | Sales | The inquiry badge is New Inquiry and it has not been quoted | Choose Lost, Negotiation, or On Hold | The move is blocked. The message says unit rates must be quoted first | |
| F3 | Sales | After procurement pricing | Open Dashboard, Orders, and Customers | Those tabs still open. Inquiries does not trap navigation | |

## 6. Assistant

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| W1 | Person | WhatsApp from Person's number | Send a greeting | The procurement menu opens. Quotation, customer, and pricing tools for a salesperson do not run | |
| W2 | Person | Person can view inquiries | Ask for pending prices | The list is Awaiting Price only. Customer name, phone, and raw text are absent. Each inquiry is one line | |
| W3 | Person | Person can fill base prices | Paste a `PR-` number that is Awaiting Price and save a base price on one line | Only that line is written. The other lines keep their credit, transport, loading, and margin | |
| W4 | Person | The same number is Price Ready | Paste the `PR-` number | The base-price step does not open | |
| W5 | Person | View-only, Fill base prices still checked | Paste an Awaiting Price `PR-` number | The assistant says they cannot enter a base price. Nothing is written | |
| W6 | Person | `inquiries.team_inquiries` is off | Ask for the team | The team list is refused | |
| W7 | Manager | `inquiries.team_inquiries` is on | Ask for all inquiries | The summary covers every status badge, ten at a time | |
| W8 | Other | A `PR-` number stamped to Person | Paste that number | Other cannot read or price it | |

## 7. Tonnage bell

Use Inquiry A after B2, so it is Price Ready and stamped to Person. Note the `PR-` number, the current total weight, and the pipeline stage before each case. Restore Price Ready between cases that reopen the inquiry: Person saves a base price again.

| ID | Role | Precondition | Steps | Expected result | Result |
|---|---|---|---|---|---|
| TB1 | Person | No open tonnage review | Look immediately left of Refresh | The bell is there. It has no badge | |
| TB2 | Person | No open tonnage review | Open the bell | The title is Tonnage updates. The panel says there are no tonnage updates | |
| TB3 | Sales | On Inquiries | Look beside Refresh | The bell is absent | |
| TB4 | Manager | On Inquiries | Look beside Refresh | The bell is present | |
| TB5 | Sales | Inquiry A is Price Ready. Note the pipeline stage | Change the quantity so the commercial weight changes, for example 12 MT to 18 MT. Save the inquiry | The inquiry returns to Awaiting Price. The previous base prices are still on the lines. The pipeline stage is unchanged. The inquiry does not become Price Quote | |
| TB6 | Person | After TB5 | Open the bell | The badge count includes Inquiry A. The row shows the `PR-` number, the salesperson, the product, and the weight change such as 12 MT → 18 MT, plus when it changed. Customer name, phone, email, and raw text are absent | |
| TB7 | Person | The bell is open on TB6 | Close the bell without saving a price, then open it again | The row is still there. Opening the bell does not clear it | |
| TB8 | Person | Inquiry A is outside the current date filter, or the filter hides it | Click the bell row | The panel closes and that inquiry drawer opens. A banner shows the same from/to weight. Save Prices is available because the status is Awaiting Price | |
| TB9 | Person | Drawer from TB8 | Save a positive base price on one line | The inquiry becomes Price Ready. Inquiry A leaves the bell. The badge drops, and the bell remains with no badge when nothing else is open | |
| TB10 | Sales | A different Price Ready inquiry stamped to Person | Change the weight, then Person saves with every base price blank | The inquiry becomes Unavailable and leaves the bell | |
| TB11 | Sales | Inquiry A is Price Ready at 1 MT | Change the line from 1 MT to 1000 KG, or from 1000 KG to 1 MT, without another weight change. Save | The inquiry stays Price Ready. The bell does not gain a row | |
| TB12 | Sales | Inquiry A is Price Ready | Change only the rate, a note, the delivery location, or the payment terms. Save | The inquiry stays Price Ready. The bell does not gain a row | |
| TB13 | Sales | A KG line is Price Ready, for example 5000 KG shown as 5 MT | Change only the Wt field to 8 MT. Leave the KG quantity as it is. Save | The inquiry returns to Awaiting Price. The bell shows 5 MT → 8 MT | |
| TB14 | Sales | Price Ready, one line | Add a line with weight, or remove a line that has weight. Save | The bell lists the line that changed, with its from and to weight | |
| TB15 | Sales | A review is already open, original weight 12 MT, current weight 18 MT | Change the weight again to 20 MT and save | The bell still says the weight was 12 MT. The new side is 20 MT | |
| TB16 | Sales | Inquiry is Unavailable | Change the weight and save | It stays Unavailable. No bell row is added | |
| TB17 | Sales | Inquiry is Sales Priced (Price Quote) | Change the weight and save | It does not return to Awaiting Price. No bell row is added | |
| TB18 | Other | A review is open on Inquiry A | Open the bell | Inquiry A is absent | |
| TB19 | Manager | The same review is open | Open the bell | Inquiry A is listed, because Manager sees Person's team | |
| TB20 | Person | The page date filter excludes Inquiry A | Open the bell without clearing the filter | Inquiry A is still listed. The bell is not limited to the date filter | |
| TB21 | Sales | A review is open and the inquiry is Awaiting Price again | Enter sales prices and send the quotation | Sales can still quote. The bell row stays until Person saves a base price | |
| TB22 | Person | Click Refresh while a review is open | Click Refresh | The list and the bell both reload. The open row is still there | |
| TB23 | Sales | Price Ready inquiry, change the weight from the assistant or WhatsApp rather than the dashboard. The salesperson may be stored only as the sender or the customer owner | Update the quantity in the assistant or on WhatsApp, including by typing the `INQ-` code | The inquiry is listed and the code opens it. It returns to Awaiting Price and the dashboard bell lists it, with the same MT rules as TB11. The deal does not become Price Quote | |
| TB24 | Person | One awaiting-price inquiry has an open review and another does not | In WhatsApp, list awaiting prices | The open review includes the line Tonnage updated. The other inquiry does not | |
| TB25 | Person | An inquiry created before 15 Oct 2026 that was Price Ready, then had its weight changed | Open the list and the bell | The badge is Awaiting Price, not blank and not Price Quote. The bell still lists the review | |

## Result log

| Area | Passed | Failed | Notes |
|---|---|---|---|
| Navigation and anonymity | | | |
| Scope | | | |
| Base price | | | |
| Amounts and tax | | | |
| Sales follow-through | | | |
| Assistant | | | |
| Tonnage bell | | | |

## Update Inquiry status and pricing

Verify that Update Inquiry shows Awaiting Price, Price Ready, Unavailable, or the canonical pipeline stage exactly as the dashboard does. Open a detail and verify the procurement number plus Base, Transport, Loading, Credit, Margin, and Rate per MT on every material. Change transport on a Price Quote inquiry and confirm the procurement base stays, the rate is recomputed, and the same breakdown is shown after save. A Won inquiry and a Lost inquiry still refuse the price change. A rate below the other components asks which component to change. Pasted `INQ-... | ...` and `PR-... | INQ-... |` list lines must select the inquiry without invoking general retrieval.

Verify Update Inquiry shows seven inquiries per page in the same newest-first order as the dashboard, with `PR-` then `INQ-` from the first six characters of the inquiry id. Next reveals the following seven. Won/Lost rows remain visible but cannot change price or stage. A purchase order or a blank inquiry type that the dashboard lists is on the chatbot list too.
