import { Router } from 'express';
import { query } from '../db.js';
import { attendanceOut } from '../mappers.js';
import {
  dateKey, num, requiredStr, route, str, timeKey,
} from '../http.js';
import { newId } from '../lib/activity.js';

const router = Router();

router.get('/', route(async (req, res) => {
  const { rows } = await query(
    `select * from attendance order by work_date desc, clock_in asc nulls last`,
  );
  res.json(rows.map(attendanceOut));
}));

/**
 * Upsert one attendance row. The client sends the final clock in / clock out
 * values, so replaying a queued offline shift cannot flip the shift state.
 */
router.post('/', route(async (req, res) => {
  const body = req.body || {};
  const employeeId = requiredStr(body.employeeId || body.employee_id, 'employeeId', { max: 64 });
  const workDate = dateKey(body.date || body.workDate, { fallback: new Date().toISOString().slice(0, 10), field: 'date' });
  const id = str(body.id, { max: 64 }) || newId('at');
  const clockIn = timeKey(body.in ?? body.clockIn, { fallback: null });
  const clockOut = timeKey(body.out ?? body.clockOut, { fallback: null });
  const hours = body.hours === undefined || body.hours === null || body.hours === ''
    ? null
    : num(body.hours, { field: 'hours', min: 0, max: 24 });

  const { rows } = await query(
    `insert into attendance (id, employee_id, name, work_date, clock_in, clock_out, hours)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (employee_id, work_date) do update set
       name = excluded.name,
       clock_in = coalesce(excluded.clock_in, attendance.clock_in),
       clock_out = coalesce(excluded.clock_out, attendance.clock_out),
       hours = coalesce(excluded.hours, attendance.hours)
     returning *`,
    [id, employeeId, str(body.name, { max: 160 }), workDate, clockIn, clockOut, hours],
  );
  res.status(201).json(attendanceOut(rows[0]));
}));

export default router;
