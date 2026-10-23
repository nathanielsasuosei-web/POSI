-- ---------------------------------------------------------------------------
-- POSI — pharmacy operations schema (PostgreSQL / Supabase compatible)
-- Applied by `npm run migrate` (backend). Safe to run more than once.
-- ---------------------------------------------------------------------------

create table if not exists schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- People ---------------------------------------------------------------------

create table if not exists employees (
  id         text primary key,
  name       text not null,
  role       text not null default 'cashier' check (role in ('owner', 'cashier')),
  phone      text not null default '',
  email      text not null default '',
  shift      text not null default '',
  status     text not null default 'On shift',
  salary     numeric(12, 2) not null default 0,
  initials   text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id          text primary key,
  name        text not null,
  phone       text not null default '',
  email       text not null default '',
  address     text not null default '',
  balance     numeric(12, 2) not null default 0,
  total_spent numeric(12, 2) not null default 0,
  visits      integer not null default 0,
  is_walk_in  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists customer_payments (
  id          text primary key,
  customer_id text not null references customers(id) on delete cascade,
  amount      numeric(12, 2) not null check (amount > 0),
  received_by text not null default '',
  note        text not null default '',
  created_at  timestamptz not null default now()
);

-- Catalogue ------------------------------------------------------------------

create table if not exists products (
  id           text primary key,
  name         text not null,
  sku          text unique,
  barcode      text not null default '',
  category     text not null default 'Other',
  brand        text not null default '',
  supplier     text not null default '',
  price        numeric(12, 2) not null default 0 check (price >= 0),
  cost         numeric(12, 2) not null default 0 check (cost >= 0),
  stock        integer not null default 0 check (stock >= 0),
  low_stock_at integer not null default 5 check (low_stock_at >= 0),
  color        text not null default 'mint',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists products_category_idx on products (category);
create index if not exists products_low_stock_idx on products (stock);

-- Sales ----------------------------------------------------------------------

create table if not exists sales (
  id             text primary key,
  invoice_number text not null unique,
  sale_date      date not null default current_date,
  sale_time      text not null default '',
  cashier_id     text references employees(id) on delete set null,
  cashier_name   text not null default '',
  customer_id    text references customers(id) on delete set null,
  customer_name  text not null default '',
  subtotal       numeric(12, 2) not null default 0,
  discount       numeric(12, 2) not null default 0,
  tax            numeric(12, 2) not null default 0,
  total          numeric(12, 2) not null default 0,
  payment        text not null default 'Cash' check (payment in ('Cash', 'MoMo', 'Gift')),
  payment_detail jsonb not null default '{}'::jsonb,
  item_count     integer not null default 0,
  status         text not null default 'paid',
  created_at     timestamptz not null default now()
);

create index if not exists sales_date_idx on sales (sale_date desc, created_at desc);
create index if not exists sales_cashier_idx on sales (cashier_id);

create table if not exists sale_items (
  id         text primary key,
  sale_id    text not null references sales(id) on delete cascade,
  product_id text references products(id) on delete set null,
  name       text not null,
  qty        integer not null check (qty > 0),
  unit_price numeric(12, 2) not null default 0,
  unit_cost  numeric(12, 2) not null default 0,
  line_total numeric(12, 2) not null default 0,
  position   integer not null default 0
);

create index if not exists sale_items_sale_idx on sale_items (sale_id);

-- Inventory movement log -----------------------------------------------------

create table if not exists stock_moves (
  id           text primary key,
  product_id   text references products(id) on delete set null,
  product_name text not null default '',
  move_type    text not null check (move_type in ('sale', 'restock', 'adjustment')),
  qty          integer not null,
  move_date    date not null default current_date,
  move_time    text not null default '',
  created_by   text not null default '',
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists stock_moves_date_idx on stock_moves (move_date desc, created_at desc);
create index if not exists stock_moves_product_idx on stock_moves (product_id);

-- Money ----------------------------------------------------------------------

create table if not exists expenses (
  id            text primary key,
  expense_date  date not null default current_date,
  category      text not null default 'Other',
  amount        numeric(12, 2) not null check (amount >= 0),
  payment       text not null default 'Cash',
  note          text not null default '',
  created_by    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists expenses_date_idx on expenses (expense_date desc);

create table if not exists gift_cards (
  id            text primary key,
  code          text not null unique,
  balance       numeric(12, 2) not null default 0 check (balance >= 0),
  original      numeric(12, 2) not null default 0 check (original >= 0),
  customer_id   text references customers(id) on delete set null,
  customer_name text not null default '',
  expiry        date,
  status        text not null default 'active' check (status in ('active', 'used', 'expired')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Communication --------------------------------------------------------------

create table if not exists messages (
  id         text primary key,
  sender     text not null default '',
  sender_id  text references employees(id) on delete set null,
  recipient  text not null default 'all',
  to_name    text not null default 'All Staff',
  subject    text not null default '',
  body       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists messages_created_idx on messages (created_at desc);

create table if not exists message_reads (
  message_id  text not null references messages(id) on delete cascade,
  employee_id text not null references employees(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, employee_id)
);

create table if not exists activities (
  id         text primary key,
  kind       text not null default 'event',
  title      text not null default '',
  detail     text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activities_created_idx on activities (created_at desc);

-- Attendance -----------------------------------------------------------------

create table if not exists attendance (
  id          text primary key,
  employee_id text references employees(id) on delete cascade,
  name        text not null default '',
  work_date   date not null default current_date,
  clock_in    text,
  clock_out   text,
  hours       numeric(6, 2),
  created_at  timestamptz not null default now(),
  unique (employee_id, work_date)
);

create index if not exists attendance_date_idx on attendance (work_date desc);

-- updated_at triggers --------------------------------------------------------

drop trigger if exists products_touch on products;
create trigger products_touch before update on products
  for each row execute function set_updated_at();

drop trigger if exists customers_touch on customers;
create trigger customers_touch before update on customers
  for each row execute function set_updated_at();

drop trigger if exists employees_touch on employees;
create trigger employees_touch before update on employees
  for each row execute function set_updated_at();

drop trigger if exists expenses_touch on expenses;
create trigger expenses_touch before update on expenses
  for each row execute function set_updated_at();

drop trigger if exists gift_cards_touch on gift_cards;
create trigger gift_cards_touch before update on gift_cards
  for each row execute function set_updated_at();

-- Reporting views ------------------------------------------------------------

create or replace view v_low_stock as
  select
    p.*,
    (p.low_stock_at - p.stock) as units_to_reorder
  from products p
  where p.stock <= p.low_stock_at
  order by p.stock asc;

create or replace view v_stock_value as
  select
    count(*)                              as product_count,
    coalesce(sum(stock * cost), 0)        as stock_value_cost,
    coalesce(sum(stock * price), 0)       as stock_value_retail,
    coalesce(sum(case when stock = 0 then 1 else 0 end), 0) as out_of_stock,
    coalesce(sum(case when stock <= low_stock_at then 1 else 0 end), 0) as low_stock
  from products;

create or replace view v_sales_overview as
  select
    s.id,
    s.invoice_number,
    s.sale_date,
    s.sale_time,
    s.cashier_id,
    s.cashier_name,
    s.customer_id,
    s.customer_name,
    s.payment,
    s.total,
    s.item_count,
    coalesce(sum(si.qty * si.unit_cost), 0) as cogs,
    s.total - coalesce(sum(si.qty * si.unit_cost), 0) as gross_profit
  from sales s
  left join sale_items si on si.sale_id = s.id
  group by s.id;

create or replace view v_daily_revenue_vs_expenses as
  with days as (
    select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day
  )
  select
    d.day,
    coalesce((select sum(s.total) from sales s where s.sale_date = d.day), 0) as revenue,
    coalesce((select sum(e.amount) from expenses e where e.expense_date = d.day), 0) as expenses,
    coalesce((select count(*) from sales s where s.sale_date = d.day), 0) as sales_count
  from days d
  order by d.day;
