import { Router } from 'express';
import { query } from '../db.js';
import { stockMoveOut } from '../mappers.js';
import {
  dateKey, int, num, oneOf, route, str, timeKey,
} from '../http.js';
import { newId } from '../lib/activity.js';

const router = Router();

router.get('/', route(async (req, res) => {
  const limit = int(req.query.limit, { fallback: 300, min: 1, max: 5000 });
  const { rows } = await query(
    `select * from stock_moves order by move_date desc, created_at desc limit $1`,
    [limit],
  );
  res.json(rows.map(stockMoveOut));
}));

/** Append a movement to the audit log (stock itself is moved via products). */
router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = str(body.id, { max: 80 }) || newId('sm');
  const qty = Math.round(num(body.qty, { field: 'qty', max: 1_000_000 }));
  const { rows } = await query(
    `insert into stock_moves (id, product_id, product_name, move_type, qty, move_date, move_time, created_by, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (id) do nothing
     returning *`,
    [
      id,
      body.productId || null,
      str(body.productName || body.name, { max: 200 }),
      oneOf(body.type, ['sale', 'restock', 'adjustment'], 'type', 'adjustment'),
      qty,
      dateKey(body.date, { fallback: new Date().toISOString().slice(0, 10), field: 'date' }),
      timeKey(body.time, { fallback: '' }),
      str(body.by || body.actor, { max: 120 }),
      str(body.note, { max: 400 }),
    ],
  );
  if (!rows.length) return res.status(200).json({ id, duplicate: true });
  res.status(201).json(stockMoveOut(rows[0]));
}));

export default router;
