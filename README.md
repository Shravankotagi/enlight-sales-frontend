# 💻 Enlight Metals Web Dashboard — User & Operations Manual

Welcome! This is the **Web Dashboard App** (Frontend) of Enlight Metals Sales OS.

> 📖 **Complete System Architecture & Setup Guide**:  
> For full step-by-step local setup instructions across all modules, environment keys, and database connections, see **[Root Master Setup Guide (README.md)](../README.md)**.

---

## 🎯 Main Dashboard Pages

- 🏠 **Home (`/`)**: Daily sales metrics, revenue trend charts, and top customer accounts.
- 🛡️ **Admin Overview (`/admin`)**: Executive management dashboard with date range filters, SKU demand distribution, leaderboard scores, and **Push/Pull Bigin Sync** buttons.
- 🔲 **Pipeline (`/pipeline`)**: Interactive Kanban deal board.
- 🛍️ **Orders (`/orders`)**: Confirmed won sales orders & printable Metal Quotations/Invoices.
- 🏷️ **Pricing (`/pricing`)**: Master metal rate sheet manager and floor margin controls.
- 📈 **Reports (`/reports`)**: Downloadable KRA Excel & PDF reports.

---

## 🚀 Quick Start (Local Launch)

```bash
cd frontend
npm install
npm run dev
```

- Local web app runs on `http://localhost:5173`.
- For complete `.env` configuration details, see **[Root Master Setup Guide (README.md)](../README.md)**.

---

*Powered by React, Vite, TailwindCSS, and Enlight Sales OS.*
