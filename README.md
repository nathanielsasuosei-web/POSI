# POSI — Drug Store Operations Suite

A local-first React/Vite shop operations app with owner and cashier workspaces, inventory, POS, receipts, expenses, reports, staff attendance, maintenance and an offline rule-based assistant.

## Run

```bash
npm install
npm run dev
```

Production offline shell testing:

```bash
npm run build
npm run preview
```

Service workers require HTTPS (or localhost) and are disabled during development.

## Set up your store

On first launch, enter your store name, optional address and phone, owner name, username and password (at least eight characters). Sign in with the account you created. There are no default passwords or sample staff accounts.

New stores start with no products, sales, expenses, stock movements, gift cards, messages, attendance or maintenance records. A generic Walk-in customer is retained for POS checkout. The default discount is zero. Add your own products and opening stock in Stock & Items; create cashier accounts in Staff Tracking. Store details can be changed in Settings.

## Existing demo installations

The real shop uses separate `posi-live-v1-*` browser storage keys and a separate sign-in session. Old `posi-v3-*` demo records remain untouched, but are not loaded or imported into the new store. Setup appears once for the new shop, and reloads retain its account and records.

## Important device-only limitations

This is **not a server-backed production system**. All shop records and local password hashes live in this browser on this device. Accounts are not shared across browsers or devices. Local sign-in is a convenience access gate, not a server-enforced security boundary; anyone with browser/device storage access can modify records. Passwords use a fixed-prefix SHA-256 hash, with a non-cryptographic fallback on insecure origins—not a production password verifier.

There is no cloud backup, synchronization or password recovery service. Export JSON backups regularly in Settings, retain them securely, and do not clear site data. Backup export is a snapshot download; a restore/import workflow is not currently implemented. The production service worker can cache the app shell for offline use; resetting offline app files does not clear shop records.

MoMo and other payment entries record payment methods but do not process or verify payments. Barcode, dispensing, tax and pharmacy integrations are not connected. Before relying on this for regulated operations, implement secure server authentication, a shared database, tested backup/restore, audit controls, validated payment integrations and applicable dispensing, privacy and tax safeguards.
