# POSI — Pharmacy Operations Suite

A responsive, local-first pharmacy POS and operations demo built with React and Vite. It keeps owner and cashier workspaces distinct and adds invoicing, sales reporting, attendance and leave, and lot-level inventory with expiry controls.

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

- **Owner workspace:** overview and cashier activity monitor, shop inventory and expiry watch, all invoices, seven-day sales reports with revenue/payment/product performance, and attendance/leave review.
- **Cashier workspace:** point of sale, inventory, personal invoices, and attendance/leave. Cashiers can clock in/out and submit leave requests; the owner can approve or decline them.
- **Billing:** every confirmed POS payment records a paid invoice with line items, customer, cashier, payment method, totals and invoice number. Invoices can be viewed, printed as full invoices or compact receipts, and exported to CSV; reports also export CSV.
- **Inventory:** create products with an opening quantity, lot number and expiry date; manage multiple batches and quantities per product. Low available stock, expired lots, near-expiry lots (within 90 days), and lots missing expiry dates are flagged. Checkout allocates eligible inventory by FEFO (earliest expiry first); expired or undated stock cannot be sold.
- **Cashier stock assistant:** matches questions against the current local inventory and reports unexpired availability. It is a local matcher, not an external AI integration.
- **Product photos:** existing camera capture and image upload remain available on product records.
- **Offline:** on the first production visit while online, the service worker precaches the built app shell and assets. Inventory, invoices, attendance and leave are stored in this browser, so the app can reopen and continue working offline on that device. An online/offline indicator appears in the workspace.

## Demo limitations and data

The sign-in choices are for demonstration, not secure authentication; they do not require passwords or PINs. Owner and cashier workspaces share demo shop data **only inside this browser on this device**. There is no backend, cross-device synchronization, cloud backup or cross-browser data sharing. Clearing browser data removes the locally stored records. Starter products, sales and staff records are sample data. Barcode scanning, payment processing, tax/dispensing validation and real pharmacy integrations are not connected.

Before using this for a real pharmacy, add secure staff accounts and permissions, a shared database and backups, audit logs, validated payment and receipt integrations, and the applicable dispensing, privacy, safety and tax controls. Confirm current Ghanaian pharmacy requirements before handling prescription sales or customer data.
