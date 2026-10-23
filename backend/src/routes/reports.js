import { Router } from 'express';
import { query } from '../db.js';
import { oneOf, route } from '../http.js';

const router = Router();

const RANGE_START = {
  today: 'current_date',
  week: "current_date - interval '6 days'",
  month: "date_trunc('month', current_date)::date",
  all: "'1970-01-01'::date",
};

const money = value => Number(Number(value || 0).toFixed(2));

router.get('/summary', route(async (req, res) => {
  const range = oneOf(req.query.range, Object.keys(RANGE_START), 'range', 'week');
  const start = RANGE_START[range];

  const [totals, payments, topProducts, expenseCats, daily, stock, lowStock] = await Promise.all([
    query(
      `select count(*)::int as sales_count,
              coalesce(sum(s.total), 0) as revenue,
              coalesce(sum(si.cost), 0) as cogs,
              coalesce(sum(s.item_count), 0)::int as items_sold
         from sales s
         left join (select sale_id, sum(qty * unit_cost) as cost from sale_items group by sale_id) si on si.sale_id = s.id
        where s.sale_date >= ${start}`,
    ),
    query(
      `select payment, count(*)::int as count, coalesce(sum(total), 0) as total
         from sales where sale_date >= ${start}
        group by payment order by total desc`,
    ),
    query(
      `select si.name,
              sum(si.qty)::int as qty,
              coalesce(sum(si.line_total), 0) as revenue
         from sale_items si
         join sales s on s.id = si.sale_id
        where s.sale_date >= ${start}
        group by si.name order by qty desc limit 5`,
    ),
    query(
      `select category, coalesce(sum(amount), 0) as total, count(*)::int as count
         from expenses where expense_date >= ${start}
        group by category order by total desc`,
    ),
    query(
      `select to_char(day, 'YYYY-MM-DD') as date, revenue, expenses
         from v_daily_revenue_vs_expenses
        where day >= current_date - interval '6 days'
        order by day asc`,
    ),
    query('select * from v_stock_value'),
    query('select id, name, stock, low_stock_at, price, cost from v_low_stock order by stock asc limit 50'),
  ]);

  const expenses = await query(
    `select coalesce(sum(amount), 0) as total from expenses where expense_date >= ${start}`,
  );

  const revenue = money(totals.rows[0].revenue);
  const cogs = money(totals.rows[0].cogs);
  const expenseTotal = money(expenses.rows[0].total);
  const grossProfit = money(revenue - cogs);
  const salesCount = Number(totals.rows[0].sales_count);

  res.json({
    range,
    revenue,
    cogs,
    grossProfit,
    expenses: expenseTotal,
    netProfit: money(grossProfit - expenseTotal),
    salesCount,
    itemsSold: Number(totals.rows[0].items_sold),
    averageSale: salesCount ? money(revenue / salesCount) : 0,
    paymentBreakdown: payments.rows.map(row => ({ payment: row.payment, count: Number(row.count), total: money(row.total) })),
    topProducts: topProducts.rows.map(row => ({ name: row.name, qty: Number(row.qty), revenue: money(row.revenue) })),
    expensesByCategory: expenseCats.rows.map(row => ({ category: row.category, count: Number(row.count), total: money(row.total) })),
    daily: daily.rows.map(row => ({ date: row.date, revenue: money(row.revenue), expenses: money(row.expenses) })),
    stockValue: {
      productCount: Number(stock.rows[0]?.product_count || 0),
      cost: money(stock.rows[0]?.stock_value_cost),
      retail: money(stock.rows[0]?.stock_value_retail),
      outOfStock: Number(stock.rows[0]?.out_of_stock || 0),
      lowStock: Number(stock.rows[0]?.low_stock || 0),
    },
    lowStock: lowStock.rows.map(row => ({
      id: row.id,
      name: row.name,
      stock: Number(row.stock),
      lowStockAt: Number(row.low_stock_at),
      unitsToReorder: Number(row.units_to_reorder),
    })),
  });
}));

export default router;
