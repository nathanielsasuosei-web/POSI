# POSI — Drug Store Operations Suite

A responsive, local-first **drug store** POS and operations demo built with React and Vite. It keeps owner and cashier workspaces distinct and adds invoicing and printable receipts, sales and stock management with low-stock alerts, expenses, business reports, and staff attendance tracking.

## Run locally

```bash
npm install
npm run dev
```

To test the **production offline shell** locally, build and run Vite's preview server (service workers are intentionally disabled in the development server):

```bash
npm run build
npm run preview
```

Production deployments must use HTTPS (or localhost) for service workers.

## Workspaces and workflows

- **Owner workspace:** overview with low-stock alerts and expense metrics, point of sale, stock & item management, customers, sales & receipts, expenses, gift cards & money owed, staff tracking, business reports, and messages. **Only the owner** can send messages to staff and create employee accounts. The owner sees **every employee's sales history** — via the Sales History employee filter, or per staff member from Staff Tracking → Sales history.
- **Cashier workspace:** point of sale, items, customers, personal sales history and messages (read-only — cashiers cannot send messages). Cashiers can also clock in and out from the top bar.
- **Sales & receipts:** payments are **Cash, MoMo and Gift card** (Check and Account are removed). Every confirmed POS payment records a paid invoice with line items, customer, seller, payment method, totals and invoice number. Each sale can be **printed as a receipt** — the receipt shows the shop address, **seller name**, customer, **date and time**, payment method and **total amount**, and printing outputs only the receipt (or invoice) on the page. Invoices and receipts can also be exported to CSV from sales history.
- **Stock management:** product records carry SKU, barcode, supplier, cost/price, stock quantity and a reorder level. Owners can restock (stock in) or record adjustments for damage, loss or count corrections; every unit in or out is written to a stock movement log (sales, restocks, adjustments) with who did it and when. Checkout deducts stock automatically and logs each sale movement.
- **Low stock alerts:** items at or below their reorder level raise alerts — a badge on the Stock & Items menu, a bell dropdown in the top bar with one-click restock, a dashboard alerts card, a low/out-of-stock filter in inventory, and a warning after any sale that pushes an item to its reorder level.
- **Expenses:** record business spending (rent, utilities, supplies, transport, salaries, maintenance, marketing) with date, payment method and notes. Entries can be edited, deleted, filtered by date range or category, and exported to CSV, with a spending-by-category breakdown.
- **Business reports:** revenue, cost of goods sold, gross profit, expenses and net profit for today/week/month/all, a seven-day revenue-vs-expenses chart, payment-method breakdown, expenses-by-category breakdown, top products, net position and full CSV export.
- **Staff tracking:** the owner creates staff accounts; clock in/clock out from the top bar with automatic hours calculation, an attendance log with status and export, per-staff performance (sales count, total to owner, items sold, hours worked), a per-employee sales history, and a monthly payroll summary.
- **Offline:** on the first production visit while online, the service worker precaches the built app shell and assets. Inventory, invoices, expenses, attendance and stock movements are stored in this browser, so the app can reopen and continue working offline on that device. An online/offline indicator appears in the workspace.

## Demo limitations and data

The sign-in choices are for demonstration, not secure authentication; they do not require passwords or PINs. Owner and cashier workspaces share demo shop data **only inside this browser on this device**. There is no backend, cross-device synchronization, cloud backup or cross-browser data sharing. Clearing browser data removes the locally stored records. Starter products, sales, staff, expense and stock-movement records are sample data. Barcode scanning, payment processing, tax/dispensing validation and real pharmacy integrations are not connected.

Before using this for a real pharmacy, add secure staff accounts and permissions, a shared database and backups, audit logs, validated payment and receipt integrations, and the applicable dispensing, privacy, safety and tax controls. Confirm current Ghanaian pharmacy requirements before handling prescription sales or customer data.
