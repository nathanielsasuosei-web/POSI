import { Router } from 'express';
import { query } from '../db.js';
import { activityOut } from '../mappers.js';
import { int, route, str } from '../http.js';
import { newId } from '../lib/activity.js';

const router = Router();

router.get('/', route(async (req, res) => {
  const limit = int(req.query.limit, { fallback: 40, min: 1, max: 500 });
  const { rows } = await query('select * from activities order by created_at desc limit $1', [limit]);
  res.json(rows.map(activityOut));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = str(body.id, { max: 80 }) || newId('act');
  const { rows } = await query(
    `insert into activities (id, kind, title, detail) values ($1,$2,$3,$4)
     on conflict (id) do nothing
     returning *`,
    [id, str(body.type || body.kind, { max: 40 }) || 'event', str(body.title, { max: 200 }), str(body.detail, { max: 300 })],
  );
  if (!rows.length) return res.status(200).json({ id, duplicate: true });
  res.status(201).json(activityOut(rows[0]));
}));

export default router;
