# 💻 Enlight Metals Web Dashboard (Frontend) — Easy Setup Guide

Welcome! This is the **Web Dashboard App** for Enlight Metals. It provides an intuitive, executive-grade web browser interface for Admins and Sales Executives to track deals, view performance analytics, manage rate sheets, and sync data with Zoho Bigin.

---

## 🎯 Main Features & Tabs

1. 🏠 **Home Tab (`/`)**: Daily sales metrics overview, monthly revenue trend charts, and top active customer accounts.
2. 🛡️ **Admin Overview (`/admin`)**: Executive management dashboard with date range filters, SKU demand distribution, AI review queue, leaderboard scores, and **Push/Pull Bigin Sync** buttons.
3. 🔲 **Sales Pipeline (`/pipeline`)**: Drag-and-drop Kanban deal pipeline (*New Inquiry $\rightarrow$ Qualified $\rightarrow$ Quoted $\rightarrow$ Negotiation $\rightarrow$ Won*).
4. 🛍️ **Orders & Invoices (`/orders`)**: Confirmed won sales orders with printable official metal sales quotations & invoices.
5. 🏷️ **Pricing Management (`/pricing`)**: Master metal rate sheet editor and floor margin controls.
6. 📈 **Reports & Exports (`/reports`)**: Downloadable KRA Excel and PDF reports (KRA 1 to KRA 9).

---

## 🚀 How to Run the Web Dashboard (Step-by-Step)

### Step 1: Open Terminal in the `frontend` folder

```bash
cd frontend
```

### Step 2: Install Dependencies (First Time Only)

```bash
npm install
```

### Step 3: Start the Development Web Server

```bash
npm run dev
```

✅ **What Success Looks Like:**
You will see output in the terminal:
`Local: http://localhost:5173/`

Open your web browser (Google Chrome, Microsoft Edge, or Safari) and go to **`http://localhost:5173`** to log in and start using your dashboard!

---

## 🔑 Environment Settings (`.env` File)

The frontend uses a simple `.env` file in the `frontend/` directory.

Essential settings inside `.env`:
- `VITE_BACKEND_URL` = Your backend server URL (e.g. `http://localhost:3001` or your live Railway URL)

*(If `.env` is missing, copy `.env.example` to `.env`.)*

---

## 🛠️ Handy Commands

- `npm run dev` — Starts the local web app for daily use.
- `npm run build` — Builds the final production bundle for deployment.
- `npm run preview` — Previews the built production app locally.

---

## ❓ Simple Troubleshooting

- **Issue:** Webpage shows blank screen or cannot connect to backend
  - **Solution:** Make sure your backend server (`npm run start:dev` inside `backend/`) is running on port 3001.
- **Issue:** Browser shows login page repeatedly
  - **Solution:** Clear browser session storage or re-enter valid admin credentials.

---

*Powered by React, Vite, TailwindCSS, and Enlight Sales OS.*
