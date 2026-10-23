import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { productOut, stockMoveOut } from '../mappers.js';
import {
  badRequest, int, notFound, num, oneOf, requiredStr, route, str,
} from '../http.js';
import { newId, logActivity } from '../lib/activity.js';

const router = Router();

const CATEGORIES = ['Pain Relief', 'Cough & Cold', 'Antibiotics', 'Antimalarials', 'Vitamins', 'Baby & Mother', 'Personal Care', 'First Aid', 'Devices', 'Other'];

function productFields(body, { id } = {}) {
  return {
    id: id || requiredStr(body.id, 'id', { max: 64 }),
    name: requiredStr(body.name, 'name', { max: 200 }),
    sku: str(body.sku, { max: 64 }) || null,
    barcode: str(body.barcode, { max: 64 }),
    category: oneOf(body.category, CATEGORIES, 'category', 'Other'),
    brand: str(body.brand, { max: 200 }),
    supplier: str(body.supplier, { max: 200 }),
    price: num(body.price, { field: 'price', min: 0 }),
    cost: num(body.cost, { field: 'cost', min: 0 }),
    stock: int(body.stock, { field: 'stock', min: 0, max: 10_000_000, fallback: 0 }),
    lowStockAt: int(body.lowStockAt, { field: 'lowStockAt', min: 0, max: 100_000, fallback: 5 }),
    color: str(body.color, { max: 20 }) || 'mint',
  };
}

const UPSERT_SQL = `
  insert into products (id, name, sku, barcode, category, brand, supplier, price, cost, stock, low_stock_at, color)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  on conflict (id) do update set
    name = excluded.name,
    sku = excluded.sku,
    barcode = excluded.barcode,
    category = excluded.category,
    brand = excluded.brand,
    supplier = excluded.supplier,
    price = excluded.price,
    cost = excluded.cost,
    stock = excluded.stock,
    low_stock_at = excluded.low_stock_at,
    color = excluded.color
  returning *
`;

const toParams = p => [p.id, p.name, p.sku, p.barcode, p.category, p.brand, p.supplier, p.price, p.cost, p.stock, p.lowStockAt, p.color];

router.get('/', route(async (req, res) => {
  const { rows } = await query('select * from products order by name asc');
  res.json(rows.map(productOut));
}));

router.get('/:id', route(async (req, res) => {
  const { rows } = await query('select * from products where id = $1', [req.params.id]);
  if (!rows.length) throw notFound('Product not found');
  res.json(productOut(rows[0]));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const fields = productFields(body);
  const { rows } = await query(UPSERT_SQL, toParams(fields));
  const action = str(body.actor, { max: 120 });
  if (fields.stock > 0) {
    await query(
      `insert into stock_moves (id, product_id, product_name, move_type, qty, move_time, created_by, note)
       values ($1, $2, $3, 'restock', $4, to_char(now(), 'HH24:MI'), $5, 'Opening stock')
       on conflict (id) do nothing`,
      [newId('sm'), fields.id, fields.name, fields.stock, action],
    );
  }
  await logActivity({ type: 'product', title: `${action || 'Owner'} added product`, detail: `${fields.name} · ${fields.stock} units`, id: req.body?.activityId });
  res.status(201).json(productOut(rows[0]));
}));

router.put('/:id', route(async (req, res) => {
  const body = req.body || {};
  const fields = productFields({ ...body, id: req.params.id }, { id: req.params.id });
  const actor = str(body.actor || body.by, { max: 120 }) || 'Owner';

  const product = await withTransaction(async client => {
    const before = await client.query('select stock from products where id = $1 for update', [req.params.id]);
    const { rows } = await client.query(UPSERT_SQL, toParams(fields));
    const previousStock = before.rowCount ? Number(before.rows[0].stock) : null;
    if (previousStock !== null && previousStock !== fields.stock) {
      await client.query(
        `insert into stock_moves (id, product_id, product_name, move_type, qty, move_time, created_by, note)
         values ($1, $2, $3, 'adjustment', $4, to_char(now(), 'HH24:MI'), $5, 'Edited in product record')`,
        [newId('sm'), fields.id, fields.name, fields.stock - previousStock, actor],
      );
    }
    return rows[0];
  });

  await logActivity({ type: 'product', title: `${actor} updated product`, detail: fields.name });
  res.json(productOut(product));
}));

router.delete('/:id', route(async (req, res) => {
  const { rowCount } = await query('delete from products where id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Product not found');
  res.json({ ok: true, id: req.params.id });
}));

// Restock / adjustment. Idempotent when the client sends a moveId.
router.post('/:id/stock', route(async (req, res) => {
  const body = req.body || {};
  const mode = oneOf(body.mode, ['restock', 'adjustment'], 'mode', 'restock');
  const amount = Math.floor(Math.abs(num(body.qty, { field: 'qty', min: 1, max: 1_000_000 })));
  if (!amount) throw badRequest('qty must be a positive number');
  const moveId = str(body.moveId, { max: 80 }) || newId('sm');
  const actor = str(body.by || body.actor, { max: 120 }) || 'Staff';
  const note = str(body.note, { max: 400 });
  const delta = mode === 'restock' ? amount : -amount;

  const result = await withTransaction(async client => {
    const seen = await client.query('select 1 from stock_moves where id = $1', [moveId]);
    if (seen.rowCount) {
      const existing = await client.query('select * from products where id = $1', [req.params.id]);
      if (!existing.rowCount) throw notFound('Product not found');
      return { product: productOut(existing.rows[0]), move: null, replayed: true };
    }

    const locked = await client.query('select * from products where id = $1 for update', [req.params.id]);
    if (!locked.rowCount) throw notFound('Product not found');
    const product = locked.rows[0];

    const updates = await client.query(
      `update products
          set stock = greatest(0, stock + $2),
              cost = case when $3::numeric is null then cost else $3 end
        where id = $1
        returning *`,
      [product.id, delta, body.cost === undefined || body.cost === '' ? null : num(body.cost, { field: 'cost', min: 0 })],
    );

    const move = await client.query(
      `insert into stock_moves (id, product_id, product_name, move_type, qty, move_time, created_by, note)
       values ($1, $2, $3, $4, $5, to_char(now(), 'HH24:MI'), $6, $7)
       returning *`,
      [moveId, product.id, product.name, mode, delta, actor, note],
    );

    return { product: productOut(updates.rows[0]), move: stockMoveOut(move.rows[0]), replayed: false };
  });

  if (!result.replayed) {
    await query(
      `insert into activities (id, kind, title, detail) values ($1, 'stock', $2, $3)
       on conflict (id) do nothing`,
      [newId('act'), `${actor} ${mode === 'restock' ? 'restocked' : 'adjusted'} ${result.product.name}`, `${delta > 0 ? '+' : ''}${delta} units${note ? ` · ${note}` : ''}`],
    );
  }

  res.status(result.replayed ? 200 : 201).json(result);
}));

export default router;
