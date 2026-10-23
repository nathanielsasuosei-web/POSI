import { Router } from 'express';
import { query } from '../db.js';
import { employeeOut } from '../mappers.js';
import {
  notFound, num, oneOf, requiredStr, route, str,
} from '../http.js';

const router = Router();

const UPSERT_SQL = `
  insert into employees (id, name, role, phone, email, shift, status, salary, initials)
  values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  on conflict (id) do update set
    name = excluded.name,
    role = excluded.role,
    phone = excluded.phone,
    email = excluded.email,
    shift = excluded.shift,
    status = excluded.status,
    salary = excluded.salary,
    initials = excluded.initials
  returning *
`;

function employeeFields(body) {
  const name = requiredStr(body.name, 'name', { max: 160 });
  return {
    name,
    role: oneOf(body.role, ['owner', 'cashier'], 'role', 'cashier'),
    phone: str(body.phone, { max: 40 }),
    email: str(body.email, { max: 200 }),
    shift: str(body.shift, { max: 60 }),
    status: str(body.status, { max: 40 }) || 'On shift',
    salary: num(body.salary, { field: 'salary', min: 0 }),
    initials: str(body.initials, { max: 4 }) || name.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase(),
  };
}

router.get('/', route(async (req, res) => {
  const { rows } = await query(`select * from employees order by case when role = 'owner' then 0 else 1 end, name asc`);
  res.json(rows.map(employeeOut));
}));

router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const id = requiredStr(body.id, 'id', { max: 64 });
  const f = employeeFields(body);
  const { rows } = await query(UPSERT_SQL, [id, f.name, f.role, f.phone, f.email, f.shift, f.status, f.salary, f.initials]);
  res.status(201).json(employeeOut(rows[0]));
}));

router.put('/:id', route(async (req, res) => {
  const body = req.body || {};
  const f = employeeFields(body);
  const { rows } = await query(UPSERT_SQL, [req.params.id, f.name, f.role, f.phone, f.email, f.shift, f.status, f.salary, f.initials]);
  if (!rows.length) throw notFound('Employee not found');
  res.json(employeeOut(rows[0]));
}));

export default router;
