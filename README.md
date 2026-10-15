# POSI — Pharmacy Point of Sale

A responsive pharmacy POS prototype built with React and Vite. The current build is a front-end demo using sample products and in-memory state; it does not yet connect to a database, payment provider, barcode scanner, or live inventory system.

## Run locally

```bash
npm install
npm run dev
```

## Included in this prototype

- Searchable product catalogue with category filters and stock indicators
- Sale cart with quantity controls, customer selection, discount toggle, and totals
- Cash, Mobile Money, and card payment selection with a payment confirmation flow
- Responsive desktop and mobile layouts
- Ghana cedi (GH₵) sample pricing and pharmacy-oriented product details

## Next production steps

Add authenticated staff accounts, a persistent inventory and sales database, configurable tax and receipt settings, expiry/lot tracking, audit logs, and integrations for the actual payment and barcode hardware used by the shop. Confirm local pharmacy and tax requirements before handling prescription sales or collecting payments in production.
