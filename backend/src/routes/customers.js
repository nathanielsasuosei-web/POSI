import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { customerOut } from '../mappers.js';
import {
  badRequest, notFound, num, requiredStr, route, str,
} from '../http.js';
import { logActivity, newId } from '../lib/activity.js';

const router = Router();

const toParams = (c, id) => [
  id, c.name, c.phone, c.email, c.address, c.balance, c.totalSpent, c.visits, c.isWalkIn,
];

const UPSERT_SQL = `
  insert into customers (id, name, phone, email, address, balance, total_spent, visits, is_walk_in)
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    email = excluded.email,
    address = excluded.address,
    balance = excluded.balance,
    total_spent = excluded.total_spent,
    visits = excluded.visits,
    is_walk_in = excluded.is_walk_in
  returning *
`;

function customerFields(body) {
  return {
    name: requiredStr(body.name, 'name', { max: 200 }),
    phone: str(body.phone, { max: 40 }),
    email: str(body.email, { max: 200 }),
    address: str(body.address, { max: 300 }),
    balance: num(body.balance, { field: 'balance', min: 0 }),
    totalSpent: num(body.totalSpent, { field: 'totalSpent', min: 0 }),
    visits: num(body.visits, { field: 'visits', min: 0 }),
    isWalkIn: Boolean(body.isWalkIn),
  };
}

router.get('/', route(async (req, res) => {
  const { rows } = await query('select * from customers order by name asc');
  res.json(rows.map(customerOut));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = requiredStr(body.id, 'id', { max: 64 });
  const fields = customerFields(body);
  const { rows } = await query(UPSERT_SQL, toParams(fields, id));
  res.status(201).json(customerOut(rows[0]));
}));

router.put('/:id', route(async (req, res) => {
  const body = req.body || {};
  const fields = customerFields(body);
  // Balance, spend and visits are maintained by sales and payments; an edit
  // here only changes the customer's profile details.
  const { rows } = await query(
    `insert into customers (id, name, phone, email, address, balance, total_spent, visits, is_walk_in)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (id) do update set
       name = excluded.name,
       phone = excluded.phone,
       email = excluded.email,
       address = excluded.address,
       is_walk_in = excluded.is_walk_in
     returning *`,
    toParams(fields, req.params.id),
  );
  res.json(customerOut(rows[0]));
}));

/**
 * Money paid against an account balance. Sending an id makes it idempotent so a
 * queued offline payment cannot be applied twice.
 */
router.post('/:id/payments', route(async (req, res) => {
  const body = req.body || {};
  const amount = num(body.amount, { field: 'amount', min: 0.01, max: 1_000_000 });
  const paymentId = str(body.id, { max: 80 }) || newId('pay');
  const receivedBy = str(body.by || body.actor, { max: 120 }) || 'Staff';
  const note = str(body.note, { max: 300 });

  const result = await withTransaction(async client => {
    const seen = await client.query('select 1 from customer_payments where id = $1', [paymentId]);
    if (seen.rowCount) {
      const existing = await client.query('select * from customers where id = $1', [req.params.id]);
      if (!existing.rowCount) throw notFound('Customer not found');
      return { customer: customerOut(existing.rows[0]), applied: false };
    }
    const locked = await client.query('select * from customers where id = $1 for update', [req.params.id]);
    if (!locked.rowCount) throw notFound('Customer not found');
    if (Number(locked.rows[0].balance) <= 0) throw badRequest('This customer has no outstanding balance');

    const applied = Math.min(Number(locked.rows[0].balance), amount);
    const updated = await client.query(
      'update customers set balance = greatest(0, balance - $2) where id = $1 returning *',
      [req.params.id, applied],
    );
    await client.query(
      `insert into customer_payments (id, customer_id, amount, received_by, note)
       values ($1,$2,$3,$4,$5)`,
      [paymentId, req.params.id, applied, receivedBy, note],
    );
    return { customer: customerOut(updated.rows[0]), applied: true, amount: applied };
  });

  if (result.applied) {
    await logActivity({
      type: 'account',
      title: 'Customer payment received',
      detail: `GH₵ ${Number(result.amount).toFixed(2)} · ${result.customer.name}`,
    });
  }
  res.status(result.applied ? 201 : 200).json(result);
}));

export default router;
