# Visits

`VisitsPage.tsx` uses `visitsApi` (`/kra/visits`) for create/update/delete and follow-up completion. A new visit requires every field except Add Document. The contact phone is verified with a 6-digit WhatsApp code that expires in 5 minutes, can be resent after 60 seconds, and locks after 5 wrong attempts. The city is read from the device and stays locked; if GPS is unavailable the city can be typed and is stored as `location_source: manual`. The visit photo is taken with the device camera and must include GPS coordinates. Preferred brand allows multiple choices from TATA, JSW, AM/NS India, SAIL, NMDC, Apollo, and Others. Payment terms are a fixed list. Updates of existing visits do not repeat this check. Its data mirrors bot visit-agent writes into `customer_visits` and potentially follow-up/KRA data.

Preserve date and follow-up field formats. Exercise personal/manager filtering and create/edit/complete transitions when changing this page.
