# POSI — Drug Store Operations Suite

A local-first React/Vite shop operations app with owner and cashier workspaces, inventory, POS, receipts, expenses, reports, staff attendance, maintenance and an offline rule-based assistant.

## Download for Windows

POSI is also a desktop app for **Windows 7 SP1, 8, 8.1, 10 and 11**, including Windows 8, which current web browsers no longer support.

**[Download the latest version](https://github.com/nathanielsasuosei-web/POSI/releases/latest)** and choose the installer for your computer:

| Your Windows | Download |
| --- | --- |
| 64-bit | `POSI-Setup-<version>-64-bit.exe` |
| 32-bit, or not sure | `POSI-Setup-<version>-32-bit.exe` (also runs on 64-bit Windows) |

To check which one you have, open **Control Panel → System** and look at **System type**.

1. Open the downloaded installer. Windows may say **“Windows protected your PC”** because the app is not code-signed yet: click **More info → Run anyway**.
2. Follow the installer. POSI opens when it finishes and adds shortcuts to the desktop and Start menu.

Good to know:

- The app works fully offline. Its records are saved on that computer (in `%APPDATA%\POSI`), separately from the POSI website: records entered in a browser do not appear in the desktop app, and vice versa.
- To update, run the newer installer. Updating or uninstalling keeps your records.
- Export backups regularly (Settings → Data & security → Export JSON) and keep a copy on a USB drive.
- If the window stays blank on an older PC, right-click the POSI shortcut → **Properties** and add ` --disable-gpu` to the end of **Target**.
- The app is built on Electron 22, the last version that runs on Windows 7 and 8. It no longer receives security updates, so POSI only loads its own bundled files and opens any web links in your normal browser.

Developers: see [desktop/README.md](desktop/README.md) for how the installers are built, tested and released.

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

This is **not a server-backed production system**. All shop records and local password hashes live in this browser on this device (or, in the Windows app, on that computer). Accounts are not shared across browsers or devices. Local sign-in is a convenience access gate, not a server-enforced security boundary; anyone with browser/device storage access can modify records. Passwords use a fixed-prefix SHA-256 hash, with a non-cryptographic fallback on insecure origins—not a production password verifier.

There is no cloud backup, synchronization or password recovery service. Export JSON backups regularly in Settings, retain them securely, and do not clear site data. Backup export is a snapshot download; a restore/import workflow is not currently implemented. The production service worker can cache the app shell for offline use; resetting offline app files does not clear shop records.

MoMo and other payment entries record payment methods but do not process or verify payments. Barcode, dispensing, tax and pharmacy integrations are not connected. Before relying on this for regulated operations, implement secure server authentication, a shared database, tested backup/restore, audit controls, validated payment integrations and applicable dispensing, privacy and tax safeguards.
