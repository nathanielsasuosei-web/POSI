# POSI — Drug Store Operations Suite

A responsive **drug store** POS and operations suite: React + Vite on the front end, an Express + PostgreSQL API on the back, with invoicing, printable receipts, stock management, expenses, business reports and staff attendance.

Owner and cashier workspaces stay separate, but every device now shares **one PostgreSQL database** — sales, stock, customers, expenses and attendance are no longer trapped in a single browser.

```
POSI/
├─ src/                  React app (POS, inventory, reports, staff…)
│  ├─ api.js             fetch client for the REST API
│  └─ usePosiData.js     shared state, offline cache and write queue
├─ backend/              Express API + PostgreSQL schema
│  ├─ src/schema.sql     tables, views, triggers
│  ├─ src/routes/        REST resources
│  └─ src/migrate.js     schema migrations (idempotent)
└─ scripts/              dev runner + UI smoke test
```

## Run locally

Requirements: Node 20+ and a PostgreSQL 14+ database (a Supabase project works as-is).

```bash
# 1. Front end
npm install

# 2. Backend
npm run backend:install
cp backend/.env.example backend/.env    # then set DATABASE_URL
npm run db:migrate                      # create tables, views and triggers
npm run db:seed                         # optional demo dataset

# 3. Run both (API on 8787, app on 5173)
npm run dev:all
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to the
backend, so the browser only ever talks to its own origin — no CORS setup and no
mixed-content problems. `npm run dev` and `npm run dev:api` start the two halves
separately if you prefer two terminals.

### Connecting to Supabase

1. Supabase → **Project settings → Database → Connection string → URI**.
2. Copy it into `backend/.env` as `DATABASE_URL`.
3. Start the API — `AUTO_MIGRATE=true` creates the schema automatically, and
   `SEED_ON_EMPTY=true` loads the demo catalogue into an empty project.

> **IPv6 note.** Direct hosts (`db.<project>.supabase.co`) are IPv6-only. If your
> network has no IPv6 route, use the **Session pooler** URI instead, whose user is
> `postgres.<project-ref>` (e.g.
> `postgresql://postgres.viiyewnyqizuktwrlray:…@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`).
> The API prints this hint automatically when the direct host cannot be reached.

### Production build

```bash
npm run build            # static files in dist/
npm run preview          # local preview with the same /api proxy
```

Host `dist/` behind the same domain as the API (for example `/api` → the
Express service). If the API lives on another domain, set `VITE_API_BASE` in the
front end and `CORS_ORIGINS` on the backend to that site's origin.

## Workspaces and workflows

- **Owner workspace:** overview with low-stock alerts and expense metrics, point of sale, stock & item management, customers, sales & receipts, expenses, gift cards & money owed, staff tracking, business reports, and messages. **Only the owner** can send messages to staff and create employee accounts. The owner sees **every employee's sales history** — via the Sales History employee filter, or per staff member from Staff Tracking → Sales history.
- **Cashier workspace:** point of sale, items, customers, personal sales history and messages (read-only — cashiers cannot send messages). Cashiers can also clock in and out from the top bar. **Only the owner** sees low-stock alerts, reorder levels, cost/price margins, stock value and the stock movement log; cashiers get a read-only item list with price and availability.
- **Sales & receipts:** payments are **Cash, MoMo and Gift card**. Every confirmed POS payment records a paid invoice with line items, customer, seller, payment method, totals and invoice number. Each sale can be **printed as a receipt** — the receipt shows the shop address, **seller name**, customer, **date and time**, payment method and **total amount**, and printing outputs only the receipt (or invoice) on the page. Invoices and receipts can also be exported to CSV from sales history.
- **Stock management (owner only):** product records carry SKU, barcode, supplier, cost/price, stock quantity and a reorder level. Owners can restock (stock in) or record adjustments for damage, loss or count corrections; every unit in or out is written to a stock movement log (sales, restocks, adjustments) with who did it and when. Checkout deducts stock automatically and logs each sale movement. Cost, profit margin and stock value are hidden from cashiers.
- **Low stock alerts (owner only):** items at or below their reorder level raise alerts — a badge on the Stock & Items menu, a bell dropdown in the top bar with one-click restock, a dashboard alerts card, a low/out-of-stock filter in inventory, and a warning after any sale that pushes an item to its reorder level.
- **Expenses:** record business spending (rent, utilities, supplies, transport, salaries, maintenance, marketing) with date, payment method and notes. Entries can be edited, deleted, filtered by date range or category, and exported to CSV, with a spending-by-category breakdown.
- **Business reports:** revenue, cost of goods sold, gross profit, expenses and net profit for today/week/month/all, a seven-day revenue-vs-expenses chart, payment-method breakdown, expenses-by-category breakdown, top products, net position and full CSV export.
- **Staff tracking:** the owner creates staff accounts; clock in/clock out from the top bar with automatic hours calculation, an attendance log with status and export, per-staff performance (sales count, total to owner, items sold, hours worked), a per-employee sales history, and a monthly payroll summary.
- **Shared data:** every write goes through the API. A second device (or a second browser) sees the same products, sales and balances.

## Data, offline behaviour and limits

- **Source of truth:** PostgreSQL. The API owns stock levels, invoice totals, gift-card balances and the stock movement log. Sales are written in a single transaction, so a sale cannot half-apply.
- **Offline-first on the till:** the app caches the last snapshot in `localStorage` and keeps a queue of writes made while the API is unreachable. An offline sale still prints a receipt; it is pushed automatically when the connection returns (a "Sync now" button and a status chip show the state). Writes are idempotent, so retries never double-charge stock or gift cards.
- **Schema and migrations:** `backend/src/schema.sql`, applied with `npm run db:migrate` (also on boot when `AUTO_MIGRATE=true`). Reporting views live in the same file.
- **Sample data:** `npm run db:seed` loads the demo shop (12 products, staff, customers, gift cards, sales, expenses, attendance). Skip it in production.
- **Not production authentication.** Sign-in is still a demo role picker; the API trusts the `cashierId` the client sends. Add real authentication (Supabase Auth, sessions or JWT) and server-side role checks before handling real customer or prescription data.
- Barcode scanning, payment processing, tax/dispensing validation and real pharmacy integrations are still not connected.

Before using this for a real pharmacy, add secure staff accounts and permissions, backups, audit logs, validated payment and receipt integrations, and the applicable dispensing, privacy, safety and tax controls. Confirm current Ghanaian pharmacy requirements before handling prescription sales or customer data.

## Tests

```bash
npm run test:ui                                            # renders the real app in jsdom and walks a sale through the till
cd backend && TEST_DATABASE_URL=… npm test                 # API + transaction tests (resets that database)
```

The UI smoke test expects the API and app dependencies to be installed and the
API to be running on `http://127.0.0.1:8787` with seeded data.
