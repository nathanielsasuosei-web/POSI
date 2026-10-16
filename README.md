# POSI — Pharmacy Point of Sale

A responsive pharmacy point-of-sale prototype built with React and Vite. It has separate owner and cashier workspaces, product inventory with camera/photo upload, and an owner activity monitor.

## Run locally

```bash
npm install
npm run dev
```

## Try the separate workspaces

- The staff sign-in screen offers an **Owner workspace** and a **Cashier workspace**. The owner opens the shop overview, inventory, and all sales; the cashier opens the register, inventory, and their own sales.
- The cashier demo lets you choose Ama Boateng or Kwame Owusu. To view the other workspace, sign out and sign in again from the staff screen; there is no role switch inside a signed-in workspace.
- Cashiers can ask the **Stock assistant** questions such as “How many Paracetamol are left?” It looks up current quantities, availability, and price from the shop inventory, and can add an in-stock result to the sale.
- Cashiers can add or edit products, take or upload a product photo, enter the product name and details, and save it. On a phone, the photo picker can open the camera.
- Confirming a sale attributes it to the signed-in cashier, reduces stock, and updates the owner's monitor.
- Product details, photos, sales, and activity are saved in this browser using local storage. The session is scoped to this browser tab. Starter records are demo data.

## Important prototype limitations

The separate sign-in choices are a demo, not secure authentication; they do not require passwords or PINs. Business data is shared only within the same browser on the same device, so this does not synchronize separate owner and cashier devices. The stock assistant matches questions against local inventory; no external AI service is connected. Product names must be entered manually; the app does not recognize drug names from photos. Barcode scanning and payment processing are not connected.

Before using this for a real pharmacy, add secure staff accounts and permissions, a shared database and backups, audit logs, real-time inventory synchronization, validated receipt/payment integrations, and appropriate pharmacy controls such as batch and expiry tracking. Confirm applicable Ghanaian pharmacy, privacy, and tax requirements before handling prescription sales or customer data.
