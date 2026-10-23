import { Router } from 'express';
import { query } from '../db.js';
import { messageOut } from '../mappers.js';
import { requiredStr, route, str } from '../http.js';

const router = Router();

const SELECT_SQL = `
  select m.*,
         coalesce(array_agg(mr.employee_id) filter (where mr.employee_id is not null), '{}') as read_by
    from messages m
    left join message_reads mr on mr.message_id = m.id
   group by m.id
   order by m.created_at desc
`;

router.get('/', route(async (req, res) => {
  const { rows } = await query(SELECT_SQL);
  res.json(rows.map(row => messageOut(row, row.read_by || [])));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = requiredStr(body.id, 'id', { max: 64 });
  const { rows } = await query(
    `insert into messages (id, sender, sender_id, recipient, to_name, subject, body)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (id) do nothing
     returning *`,
    [
      id,
      str(body.from || body.sender, { max: 160 }) || 'Owner',
      body.fromId || body.senderId || null,
      str(body.to, { max: 64 }) || 'all',
      str(body.toName, { max: 160 }) || 'All Staff',
      requiredStr(body.subject, 'subject', { max: 200 }),
      str(body.body, { max: 5000 }),
    ],
  );
  if (!rows.length) {
    const { rows: existing } = await query(SELECT_SQL);
    const found = existing.find(row => row.id === id);
    return res.status(200).json(messageOut(found, found?.read_by || []));
  }
  res.status(201).json(messageOut(rows[0], []));
}));

router.post('/:id/read', route(async (req, res) => {
  const employeeId = req.body?.employeeId || req.body?.employee_id;
  if (!employeeId) return res.status(400).json({ error: { message: 'employeeId is required', code: 'bad_request' } });
  await query(
    `insert into message_reads (message_id, employee_id) values ($1, $2)
     on conflict (message_id, employee_id) do nothing`,
    [req.params.id, String(employeeId)],
  );
  const { rows } = await query(
    `select employee_id from message_reads where message_id = $1 order by read_at asc`,
    [req.params.id],
  );
  res.json({ id: req.params.id, readBy: rows.map(row => row.employee_id) });
}));

export default router;
