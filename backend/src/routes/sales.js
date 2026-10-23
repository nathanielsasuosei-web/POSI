import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { saleItemOut, saleOut } from '../mappers.js';
import {
  arrayOf, badRequest, dateKey, int, notFound, num, oneOf, requiredStr, route, str, timeKey,
} from '../http.js';
import { newId } from '../lib/activity.js';

const router = Router();

async function attachItems(client, saleRows) {
  if (!saleRows.length) return [];
  const ids = saleRows.map(row => row.id);
  const { rows: itemRows } = await client.query(
    `select * from sale_items where sale_id = any($1::text[]) order by position asc, id asc`,
    [ids],
  );
  const grouped = new Map(ids.map(id => [id, []]));
  for (const item of itemRows) grouped.get(item.sale_id)?.push(saleItemOut(item));
  return saleRows.map(row => saleOut(row, grouped.get(row.id) || []));
}

router.get('/', route(async (req, res) => {
  const limit = Math.min(int(req.query.limit, { fallback: 500, min: 1, max: 5000 }), 5000);
  const filters = [];
  const params = [];
  if (req.query.cashierId) {
    params.push(String(req.query.cashierId));
    filters.push(`cashier_id = $${params.length}`);
  }
  if (req.query.payment) {
    params.push(String(req.query.payment));
    filters.push(`payment = $${params.length}`);
  }
  if (req.query.from) {
    params.push(dateKey(req.query.from, { field: 'from' }));
    filters.push(`sale_date >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(dateKey(req.query.to, { field: 'to' }));
    filters.push(`sale_date <= $${params.length}`);
  }
  params.push(limit);
  const where = filters.length ? `where ${filters.join(' and ')}` : '';
  const { rows } = await query(
    `select * from sales ${where} order by sale_date desc, created_at desc limit $${params.length}`,
    params,
  );
  const sales = await attachItems({ query }, rows);
  res.json(sales);
}));

router.get('/:id', route(async (req, res) => {
  const { rows } = await query('select * from sales where id = $1', [req.params.id]);
  if (!rows.length) throw notFound('Sale not found');
  const [sale] = await attachItems({ query }, rows);
  res.json(sale);
}));

/**
 * Record a sale. Everything a sale touches happens in one transaction so the
 * books can never half-update: sale, line items, stock, movement log, customer
 * totals, gift card balance and the activity feed.
 *
 * Re-posting the same sale id returns the stored sale unchanged (safe retries).
 */
router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = requiredStr(body.id, 'id', { max: 64 });
  const items = arrayOf(body.items, 'items');
  if (!items.length) throw badRequest('A sale needs at least one item');

  const result = await withTransaction(async client => {
    const existing = await client.query('select * from sales where id = $1', [id]);
    if (existing.rowCount) {
      const [sale] = await attachItems(client, existing.rows);
      return { sale, created: false };
    }

    const saleDate = dateKey(body.date, { fallback: new Date().toISOString().slice(0, 10), field: 'date' });
    const now = new Date();
    const fallbackTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const saleTime = timeKey(body.time, { fallback: fallbackTime });
    const payment = oneOf(body.payment, ['Cash', 'MoMo', 'Gift'], 'payment', 'Cash');
    const invoiceNumber = str(body.invoiceNumber, { max: 64 }) || id.replace('POS', 'INV');
    const paymentDetail = body.paymentDetail && typeof body.paymentDetail === 'object' ? body.paymentDetail : {};

    // Normalise + price the lines against the catalogue.
    const lines = [];
    for (const [index, raw] of items.entries()) {
      const productId = requiredStr(raw.productId || raw.id, `items[${index}].productId`, { max: 64 });
      const qty = int(raw.qty, { field: `items[${index}].qty`, min: 1, max: 100_000 });
      const product = await client.query('select * from products where id = $1 for update', [productId]);
      if (!product.rowCount) throw badRequest(`Unknown product ${productId}`);
      const row = product.rows[0];
      if (row.stock < qty) {
        throw badRequest(`Not enough stock for ${row.name} (${row.stock} left)`, { productId, available: row.stock });
      }
      const unitPrice = raw.unitPrice === undefined ? Number(row.price) : num(raw.unitPrice, { field: `items[${index}].unitPrice`, min: 0 });
      lines.push({
        id: `${id}-i${index + 1}`,
        productId,
        name: str(raw.name, { max: 200 }) || row.name,
        qty,
        unitPrice,
        unitCost: Number(row.cost),
        lineTotal: Number((unitPrice * qty).toFixed(2)),
      });
    }

    const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    const discount = num(body.discount, { field: 'discount', min: 0, max: subtotal });
    const tax = num(body.tax, { field: 'tax', min: 0 });
    const total = Number((subtotal - discount + tax).toFixed(2));

    // Gift cards are debited inside the same transaction.
    if (payment === 'Gift') {
      const code = str(paymentDetail.code, { max: 64 });
      if (!code) throw badRequest('Gift card code is required');
      const card = await client.query('select * from gift_cards where code = $1 for update', [code]);
      if (!card.rowCount) throw badRequest('Invalid gift card');
      const gift = card.rows[0];
      if (gift.status !== 'active') throw badRequest('Gift card is not active');
      if (Number(gift.balance) < total) throw badRequest(`Gift card balance is GH₵ ${Number(gift.balance).toFixed(2)}`);
      const remaining = Number((Number(gift.balance) - total).toFixed(2));
      await client.query(
        `update gift_cards set balance = $2, status = $3 where id = $1`,
        [gift.id, Math.max(0, remaining), remaining <= 0.01 ? 'used' : 'active'],
      );
    }

    const saleRow = await client.query(
      `insert into sales (id, invoice_number, sale_date, sale_time, cashier_id, cashier_name,
                          customer_id, customer_name, subtotal, discount, tax, total, payment,
                          payment_detail, item_count, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,'paid')
       returning *`,
      [
        id, invoiceNumber, saleDate, saleTime,
        body.cashierId || null, str(body.cashier, { max: 120 }) || 'Cashier',
        body.customerId || null, str(body.customerName, { max: 200 }) || 'Walk-in customer',
        subtotal, discount, tax, total, payment, JSON.stringify(paymentDetail),
        lines.reduce((sum, line) => sum + line.qty, 0),
      ],
    );

    for (const [index, line] of lines.entries()) {
      await client.query(
        `insert into sale_items (id, sale_id, product_id, name, qty, unit_price, unit_cost, line_total, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [line.id, id, line.productId, line.name, line.qty, line.unitPrice, line.unitCost, line.lineTotal, index],
      );
      await client.query('update products set stock = greatest(0, stock - $2) where id = $1', [line.productId, line.qty]);
      await client.query(
        `insert into stock_moves (id, product_id, product_name, move_type, qty, move_date, move_time, created_by, note)
         values ($1,$2,$3,'sale',$4,$5,$6,$7,$8)`,
        [`sm-${id}-${index + 1}`, line.productId, line.name, -line.qty, saleDate, saleTime, str(body.cashier, { max: 120 }), id],
      );
    }

    // Walk-in customers do not accumulate spend.
    if (body.customerId) {
      const customer = await client.query('select * from customers where id = $1', [body.customerId]);
      if (customer.rowCount && !customer.rows[0].is_walk_in) {
        await client.query(
          `update customers
              set total_spent = total_spent + $2,
                  visits = visits + 1
            where id = $1`,
          [body.customerId, total],
        );
      }
    }

    await client.query(
      `insert into activities (id, kind, title, detail) values ($1, 'sale', $2, $3)`,
      [newId('act'), `${str(body.cashier, { max: 120 }) || 'Cashier'} completed a sale`, `GH₵ ${total.toFixed(2)} · ${payment}`],
    );

    const [sale] = await attachItems(client, saleRow.rows);
    return { sale, created: true };
  });

  res.status(result.created ? 201 : 200).json(result.sale);
}));

export default router;
