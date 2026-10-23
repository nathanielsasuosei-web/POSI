import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { pool, withTransaction } from './db.js';
import { databaseConfigured } from './config.js';
import { seedData } from './seed-data.js';

async function insertSeedData() {
  const data = seedData();

  await withTransaction(async client => {
    for (const e of data.employees) {
      await client.query(
        `insert into employees (id, name, role, phone, email, shift, status, salary, initials)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
        [e.id, e.name, e.role, e.phone, e.email, e.shift, e.status, e.salary, e.initials],
      );
    }

    for (const c of data.customers) {
      await client.query(
        `insert into customers (id, name, phone, email, address, balance, total_spent, visits, is_walk_in)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
        [c.id, c.name, c.phone, c.email, c.address, c.balance, c.totalSpent, c.visits, Boolean(c.isWalkIn)],
      );
    }

    for (const p of data.products) {
      await client.query(
        `insert into products (id, name, sku, barcode, category, brand, supplier, price, cost, stock, low_stock_at, color)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (id) do nothing`,
        [p.id, p.name, p.sku, p.barcode, p.category, p.brand, p.supplier, p.price, p.cost, p.stock, p.lowStockAt, p.color],
      );
    }

    for (const g of data.giftCards) {
      await client.query(
        `insert into gift_cards (id, code, balance, original, customer_id, customer_name, expiry, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
        [g.id, g.code, g.balance, g.original, g.customerId, g.customerName, g.expiry, g.status],
      );
    }

    for (const s of data.sales) {
      await client.query(
        `insert into sales (id, invoice_number, sale_date, sale_time, cashier_id, cashier_name,
                            customer_id, customer_name, subtotal, discount, tax, total, payment,
                            payment_detail, item_count, status, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16, ($3::date::text || ' ' || $4::text)::timestamptz)
         on conflict (id) do nothing`,
        [
          s.id, s.invoiceNumber, s.date, s.time, s.cashierId, s.cashier,
          s.customerId, s.customerName, s.subtotal, s.discount, s.tax, s.total, s.payment,
          JSON.stringify(s.paymentDetail || {}), s.itemCount, s.status,
        ],
      );
      for (const [index, item] of s.items.entries()) {
        const cost = data.products.find(p => p.id === item.productId)?.cost ?? 0;
        await client.query(
          `insert into sale_items (id, sale_id, product_id, name, qty, unit_price, unit_cost, line_total, position)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
          [`${s.id}-i${index + 1}`, s.id, item.productId, item.name, item.qty, item.unitPrice, cost, item.lineTotal, index],
        );
      }
    }

    for (const m of data.messages) {
      await client.query(
        `insert into messages (id, sender, sender_id, recipient, to_name, subject, body, created_at)
         values ($1,$2,$3,$4,$5,$6,$7, ($8::date::text || ' ' || $9::text)::timestamptz)
         on conflict (id) do nothing`,
        [m.id, m.from, m.fromId, m.to, m.toName, m.subject, m.body, m.date, m.time],
      );
    }

    for (const x of data.expenses) {
      await client.query(
        `insert into expenses (id, expense_date, category, amount, payment, note, created_by)
         values ($1,$2,$3,$4,$5,$6,$7) on conflict (id) do nothing`,
        [x.id, x.date, x.category, x.amount, x.payment, x.note, x.by],
      );
    }

    for (const sm of data.stockMoves) {
      await client.query(
        `insert into stock_moves (id, product_id, product_name, move_type, qty, move_date, move_time, created_by, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
        [sm.id, sm.productId, sm.productName, sm.type, sm.qty, sm.date, sm.time, sm.by, sm.note],
      );
    }

    for (const a of data.attendance) {
      await client.query(
        `insert into attendance (id, employee_id, name, work_date, clock_in, clock_out, hours)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (employee_id, work_date) do update set
           clock_in = coalesce(attendance.clock_in, excluded.clock_in),
           clock_out = coalesce(attendance.clock_out, excluded.clock_out)`,
        [a.id, a.employeeId, a.name, a.date, a.in, a.out, a.hours],
      );
    }

    for (const act of data.activities) {
      await client.query(
        `insert into activities (id, kind, title, detail, created_at)
         values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
        [act.id, act.type, act.title, act.detail, act.at],
      );
    }
  });

  return true;
}

export async function seedIfEmpty({ force = false } = {}) {
  if (!databaseConfigured) throw new Error('DATABASE_URL is not configured');
  if (!force) {
    const { rows } = await pool.query('select count(*)::int as count from products');
    if (rows[0].count > 0) return false;
  }
  return insertSeedData();
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  seedIfEmpty({ force: process.argv.includes('--force') })
    .then(seeded => {
      console.log(seeded ? '[seed] demo dataset inserted' : '[seed] catalogue already has data — skipped (use --force to insert anyway)');
    })
    .catch(error => {
      console.error('[seed] failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
