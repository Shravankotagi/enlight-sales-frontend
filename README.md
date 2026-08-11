# 💻 Enlight Metals Web Dashboard — Comprehensive Setup & User Manual

This is the official documentation for the **Web Dashboard App** (Frontend) of Enlight Metals Sales OS. Built with **React**, **TypeScript**, **Vite**, and **TailwindCSS**, this application provides a modern executive browser interface for tracking deals, managing metal pricing, reviewing AI inquiries, downloading reports, and triggering Zoho Bigin CRM syncs.

---

## 🎯 Navigation & Feature Pages Overview

The web dashboard is organized into intuitive side navigation tabs:

| Tab Name | Route | Key Functionality |
| :--- | :--- | :--- |
| **Home** | `/` | Daily executive overview, monthly sales revenue growth chart, top active accounts, and priority action items. |
| **Admin Overview** | `/admin` | Executive management dashboard featuring date range filters (*This Month*, *Last 7 Days*, *Last 15 Days*, *Custom Date Range*), SKU demand distribution, AI review queue, salesperson leaderboards, and **Push/Pull Bigin Sync** buttons. |
| **Pipeline** | `/pipeline` | Interactive Kanban deal board (*New Inquiry $\rightarrow$ Qualified $\rightarrow$ Quoted $\rightarrow$ Negotiation $\rightarrow$ Won $\rightarrow$ Lost*). |
| **Inquiries** | `/inquiries` | Review queue for raw customer product inquiries received via WhatsApp. |
| **Orders** | `/orders` | Confirmed won orders, purchase orders, and printable Official Metal Sales Quotations & Invoices. |
| **Customers** | `/customers` | Registered customer directory, GSTIN details, and customer churn risk indicators. |
| **Visits** | `/visits` | Salesperson field visit logs, on-site meeting notes, and follow-ups. |
| **Complaints** | `/complaints` | Quality complaints log, SLA breach tracking, and resolution status. |
| **Intelligence** | `/intelligence` | AI-driven sales insights and recommendations. |
| **Pricing** | `/pricing` | Master metal rate sheet manager (*HR Coil*, *CR Sheet*, *TMT Bar*, *MS Plate*) and margin floor controls. |
| **Dashboard & Reports**| `/reports` | KRA score cards and downloadable Excel/PDF reports (KRA 1 to KRA 9). |

---

## 🛠️ Step-by-Step Local Setup Instructions

### Step 1: Open Terminal in the `frontend` Folder
```bash
cd frontend
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables (`.env`)
Create a `.env` file inside the `frontend/` folder:

```env
# Backend API Base URL
VITE_BACKEND_URL=http://localhost:3001
```

### Step 4: Run the Local Development Web Server

```bash
npm run dev
```

✅ **Verification**: Look for this terminal output:
`Local: http://localhost:5173/`

Open your web browser (Google Chrome, Edge, or Safari) and go to:
**`http://localhost:5173`**

---

## 🛠️ Build & Deployment Commands

- `npm run dev` — Launches local dev server with Hot Module Replacement (HMR).
- `npm run build` — Compiles and minifies the web app into the `dist/` folder for production deployment.
- `npm run preview` — Previews the built production site locally on port 4173.

---

## ❓ Frequently Asked Questions & Solutions

- **Q: How do I test the Push & Pull Zoho Bigin Sync buttons?**
  - **A:** Go to the **Admin Overview** page (`/admin`). Look at the header bar next to the filter dropdowns:
    - Click **`Push DB → Bigin`** to push local deals up to Zoho Bigin.
    - Click **`Pull Bigin → DB`** to import contacts and deals from Zoho Bigin into the local database.

- **Q: How do I switch views to see a specific salesperson's data?**
  - **A:** At the bottom-left of the sidebar, click **`Salesperson Selection`** and choose any salesperson from the dropdown list.

---

*Enlight Metals OS — Executive Web Dashboard App.*
