import { Router } from 'express';
import { query } from '../db.js';
import { expenseOut } from '../mappers.js';
import {
  dateKey, notFound, num, oneOf, requiredStr, route, str,
} from '../http.js';
import { logActivity } from '../lib/activity.js';

const router = Router();

const CATEGORIES = ['Rent', 'Utilities', 'Supplies', 'Transport', 'Salaries', 'Maintenance', 'Marketing', 'Other'];
const METHODS = ['Cash', 'MoMo', 'Bank', 'Gift'];

function expenseFields(body) {
  return {
    date: dateKey(body.date, { fallback: new Date().toISOString().slice(0, 10), field: 'date' }),
    category: oneOf(body.category, CATEGORIES, 'category', 'Other'),
    amount: num(body.amount, { field: 'amount', min: 0, max: 10_000_000 }),
    payment: oneOf(body.payment, METHODS, 'payment', 'Cash'),
    note: str(body.note, { max: 400 }),
    by: str(body.by || body.actor, { max: 120 }),
  };
}

const UPSERT_SQL = `
  insert into expenses (id, expense_date, category, amount, payment, note, created_by)
  values ($1,$2,$3,$4,$5,$6,$7)
  on conflict (id) do update set
    expense_date = excluded.expense_date,
    category = excluded.category,
    amount = excluded.amount,
    payment = excluded.payment,
    note = excluded.note,
    created_by = excluded.created_by
  returning *
`;

router.get('/', route(async (req, res) => {
  const filters = [];
  const params = [];
  if (req.query.from) {
    params.push(dateKey(req.query.from, { field: 'from' }));
    filters.push(`expense_date >= $${params.length}`);
  }
  if (req.query.to) {
    params.push(dateKey(req.query.to, { field: 'to' }));
    filters.push(`expense_date <= $${params.length}`);
  }
  const where = filters.length ? `where ${filters.join(' and ')}` : '';
  const { rows } = await query(`select * from expenses ${where} order by expense_date desc, created_at desc`, params);
  res.json(rows.map(expenseOut));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = requiredStr(body.id, 'id', { max: 64 });
  const f = expenseFields(body);
  const { rows } = await query(UPSERT_SQL, [id, f.date, f.category, f.amount, f.payment, f.note, f.by]);
  await logActivity({ type: 'expense', title: `${f.by || 'Staff'} recorded expense`, detail: `GH₵ ${f.amount.toFixed(2)} · ${f.category}` });
  res.status(201).json(expenseOut(rows[0]));
}));

router.put('/:id', route(async (req, res) => {
  const f = expenseFields(req.body || {});
  const { rows } = await query(UPSERT_SQL, [req.params.id, f.date, f.category, f.amount, f.payment, f.note, f.by]);
  res.json(expenseOut(rows[0]));
}));

router.delete('/:id', route(async (req, res) => {
  const { rowCount } = await query('delete from expenses where id = $1', [req.params.id]);
  if (!rowCount) throw notFound('Expense not found');
  res.json({ ok: true, id: req.params.id });
}));

export default router;
