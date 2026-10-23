import { Router } from 'express';
import { query } from '../db.js';
import { giftCardOut } from '../mappers.js';
import {
  dateKey, notFound, num, oneOf, requiredStr, route, str,
} from '../http.js';

const router = Router();

router.get('/', route(async (req, res) => {
  const { rows } = await query('select * from gift_cards order by created_at desc');
  res.json(rows.map(giftCardOut));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = str(body.id, { max: 64 }) || `g-${Date.now()}`;
  const code = requiredStr(body.code, 'code', { max: 64 }).toUpperCase();
  const balance = num(body.balance, { field: 'balance', min: 0 });
  const original = body.original === undefined ? balance : num(body.original, { field: 'original', min: 0 });
  const { rows } = await query(
    `insert into gift_cards (id, code, balance, original, customer_id, customer_name, expiry, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (code) do update set
       balance = excluded.balance,
       original = excluded.original,
       customer_id = excluded.customer_id,
       customer_name = excluded.customer_name,
       expiry = excluded.expiry,
       status = excluded.status
     returning *`,
    [
      id, code, balance, original,
      body.customerId || null, str(body.customerName, { max: 200 }),
      dateKey(body.expiry, { fallback: null, field: 'expiry' }),
      oneOf(body.status, ['active', 'used', 'expired'], 'status', 'active'),
    ],
  );
  res.status(201).json(giftCardOut(rows[0]));
}));

router.patch('/:id', route(async (req, res) => {
  const body = req.body || {};
  const { rows } = await query(
    `update gift_cards set
       balance = coalesce($2::numeric, balance),
       status = coalesce($3::text, status),
       expiry = coalesce($4::date, expiry)
     where id = $1
     returning *`,
    [
      req.params.id,
      body.balance === undefined ? null : num(body.balance, { field: 'balance', min: 0 }),
      body.status === undefined ? null : oneOf(body.status, ['active', 'used', 'expired'], 'status'),
      body.expiry === undefined ? null : dateKey(body.expiry, { field: 'expiry' }),
    ],
  );
  if (!rows.length) {
    const { rows: byCode } = await query('select * from gift_cards where code = $1', [req.params.id]);
    if (!byCode.length) throw notFound('Gift card not found');
    return res.json(giftCardOut(byCode[0]));
  }
  res.json(giftCardOut(rows[0]));
}));

export default router;
