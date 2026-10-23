import { Router } from 'express';
import { query } from '../db.js';
import {
  activityOut, attendanceOut, customerOut, employeeOut, expenseOut,
  giftCardOut, messageOut, productOut, saleItemOut, saleOut, stockMoveOut,
} from '../mappers.js';
import { config } from '../config.js';
import { route } from '../http.js';

const router = Router();

/** One round trip that hydrates the whole workspace. */
export async function loadState() {
  const salesLimit = config.salesLimit;
  const [
    products, employees, customers, giftCards, expenses,
    stockMoves, attendance, activities, messages, sales,
  ] = await Promise.all([
    query('select * from products order by name asc'),
    query(`select * from employees order by case when role = 'owner' then 0 else 1 end, name asc`),
    query('select * from customers order by name asc'),
    query('select * from gift_cards order by created_at desc'),
    query('select * from expenses order by expense_date desc, created_at desc'),
    query('select * from stock_moves order by move_date desc, created_at desc limit 300'),
    query('select * from attendance order by work_date desc, clock_in asc nulls last'),
    query('select * from activities order by created_at desc limit 40'),
    query(`select m.*, coalesce(array_agg(mr.employee_id) filter (where mr.employee_id is not null), '{}') as read_by
             from messages m
             left join message_reads mr on mr.message_id = m.id
            group by m.id
            order by m.created_at desc`),
    query(`select * from sales order by sale_date desc, created_at desc limit $1`, [salesLimit]),
  ]);

  let saleItems = [];
  if (sales.rows.length) {
    const ids = sales.rows.map(row => row.id);
    const { rows } = await query(
      `select * from sale_items where sale_id = any($1::text[]) order by position asc`,
      [ids],
    );
    saleItems = rows;
  }
  const itemsBySale = new Map();
  for (const item of saleItems) {
    if (!itemsBySale.has(item.sale_id)) itemsBySale.set(item.sale_id, []);
    itemsBySale.get(item.sale_id).push(saleItemOut(item));
  }

  return {
    shop: config.shop,
    syncedAt: new Date().toISOString(),
    products: products.rows.map(productOut),
    employees: employees.rows.map(employeeOut),
    customers: customers.rows.map(customerOut),
    giftCards: giftCards.rows.map(giftCardOut),
    expenses: expenses.rows.map(expenseOut),
    stockMoves: stockMoves.rows.map(stockMoveOut),
    attendance: attendance.rows.map(attendanceOut),
    activities: activities.rows.map(activityOut),
    messages: messages.rows.map(row => messageOut(row, row.read_by || [])),
    sales: sales.rows.map(row => saleOut(row, itemsBySale.get(row.id) || [])),
  };
}

router.get('/', route(async (req, res) => {
  res.json(await loadState());
}));

export default router;
