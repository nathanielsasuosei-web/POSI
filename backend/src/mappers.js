// Database row -> JSON shapes the POSI client already understands.

const isoDate = value => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const isoTime = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const productOut = row => ({
  id: row.id,
  name: row.name,
  sku: row.sku || '',
  barcode: row.barcode || '',
  category: row.category,
  brand: row.brand || '',
  supplier: row.supplier || '',
  price: Number(row.price),
  cost: Number(row.cost),
  stock: Number(row.stock),
  lowStockAt: Number(row.low_stock_at),
  color: row.color || 'mint',
});

export const employeeOut = row => ({
  id: row.id,
  name: row.name,
  role: row.role,
  phone: row.phone || '',
  email: row.email || '',
  shift: row.shift || '',
  status: row.status || 'On shift',
  salary: Number(row.salary),
  initials: row.initials || row.name.slice(0, 2).toUpperCase(),
});

export const customerOut = row => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  email: row.email || '',
  address: row.address || '',
  balance: Number(row.balance),
  totalSpent: Number(row.total_spent),
  visits: Number(row.visits),
  isWalkIn: Boolean(row.is_walk_in),
});

export const giftCardOut = row => ({
  id: row.id,
  code: row.code,
  balance: Number(row.balance),
  original: Number(row.original),
  customerId: row.customer_id || '',
  customerName: row.customer_name || '',
  expiry: isoDate(row.expiry),
  status: row.status,
});

export const expenseOut = row => ({
  id: row.id,
  date: isoDate(row.expense_date),
  category: row.category,
  amount: Number(row.amount),
  payment: row.payment,
  note: row.note || '',
  by: row.created_by || '',
});

export const stockMoveOut = row => ({
  id: row.id,
  productId: row.product_id || '',
  productName: row.product_name,
  type: row.move_type,
  qty: Number(row.qty),
  date: isoDate(row.move_date),
  time: row.move_time || '',
  by: row.created_by || '',
  note: row.note || '',
});

export const messageOut = (row, readBy = []) => ({
  id: row.id,
  from: row.sender,
  fromId: row.sender_id || '',
  to: row.recipient,
  toName: row.to_name,
  subject: row.subject,
  body: row.body,
  date: isoDate(row.created_at),
  time: isoTime(row.created_at),
  readBy,
});

export const attendanceOut = row => ({
  id: row.id,
  employeeId: row.employee_id || '',
  name: row.name,
  date: isoDate(row.work_date),
  in: row.clock_in || null,
  out: row.clock_out || null,
  hours: row.hours === null ? null : Number(row.hours),
});

export const activityOut = row => ({
  id: row.id,
  type: row.kind,
  title: row.title,
  detail: row.detail,
  time: isoTime(row.created_at),
  at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

export const saleItemOut = row => ({
  id: row.id,
  productId: row.product_id || '',
  name: row.name,
  qty: Number(row.qty),
  unitPrice: Number(row.unit_price),
  unitCost: Number(row.unit_cost),
  lineTotal: Number(row.line_total),
});

export const saleOut = (row, items = []) => ({
  id: row.id,
  invoiceNumber: row.invoice_number,
  date: isoDate(row.sale_date),
  time: row.sale_time || '',
  cashier: row.cashier_name,
  cashierId: row.cashier_id || '',
  customerId: row.customer_id || '',
  customerName: row.customer_name,
  items,
  subtotal: Number(row.subtotal),
  discount: Number(row.discount),
  tax: Number(row.tax),
  total: Number(row.total),
  payment: row.payment,
  paymentDetail: row.payment_detail || {},
  itemCount: Number(row.item_count),
  status: row.status,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

export { isoDate, isoTime };
