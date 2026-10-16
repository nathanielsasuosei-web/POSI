# POSI — Pharmacy Point of Sale

A responsive pharmacy point-of-sale prototype built with React and Vite. It includes separate owner and cashier demo views, product inventory with camera/photo upload, and a cashier activity monitor for the owner.

## Run locally

```bash
npm install
npm run dev
```

## Try the owner and cashier flows

- The app opens in the **Owner** view. The overview shows today's transactions, sales by cashier, recent activity, and low-stock products.
- Use **Viewing as** in the top bar to switch to the **Cashier** view. Add products from Inventory or directly from the register, take or upload a product photo, enter the product name and details, and save it.
- Add products to a sale and confirm payment. The transaction is attributed to the cashier, inventory stock is reduced, and the owner's overview updates.
- Product details, product photos, sales, and activity are saved in this browser using local storage. The starter data is for demonstration only.

## Important prototype limitations

The role switch is a demo, not authentication. Owner and cashier data is shared only within the same browser on the same device; there is no server, database, or real-time sync between separate devices. Product photos are attached to the name entered in the form; the app does not automatically recognize drug names from a photo. Barcode scanning and payment processing are not connected.

Before using this for a real pharmacy, add secure staff accounts and permissions, a shared database and backups, audit logs, real-time inventory synchronization, validated receipt/payment integrations, and appropriate pharmacy controls such as batch and expiry tracking. Confirm applicable Ghanaian pharmacy, privacy, and tax requirements before handling prescription sales or customer data.
