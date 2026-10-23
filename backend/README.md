# POSI backend (Express + PostgreSQL)

REST API and PostgreSQL schema behind the POSI pharmacy operations app.

- **Runtime:** Node.js 20+
- **Database:** PostgreSQL 14+ (Supabase works out of the box)
- **Framework:** Express 4, `pg` connection pool
- **No ORM:** plain SQL, one transaction per write, schema in [`src/schema.sql`](src/schema.sql)

## Quick start

```bash
cd backend
npm install
cp .env.example .env        # then set DATABASE_URL
npm run migrate             # create tables, views and triggers
npm run seed                # load the demo pharmacy dataset (optional)
npm run dev                 # http://localhost:8787
```

The Vite dev server proxies `/api` to `http://localhost:8787`, so the browser
only ever talks to its own origin (no CORS, no mixed content).

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL / Supabase connection string (required) |
| `PORT` | `8787` | API port |
| `DB_SSL` | auto | `true` forces TLS, `false` disables it. Remote hosts use TLS automatically |
| `DB_SSL_STRICT` | `false` | Verify the server certificate against a CA |
| `CORS_ORIGINS` | — | Comma separated browser origins allowed to call the API |
| `AUTO_MIGRATE` | `true` | Apply `schema.sql` on boot |
| `SEED_ON_EMPTY` | `true` | Insert demo data when the catalogue is empty |
| `DB_STATEMENT_TIMEOUT_MS` | `15000` | Per-query timeout |
| `STATE_SALES_LIMIT` | `2000` | Max sales returned by `GET /api/state` |

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the API (no watch) |
| `npm run dev` | Start with `node --watch` |
| `npm run migrate` | Apply the schema (idempotent) |
| `npm run migrate -- --reset` | Drop all POSI tables first |
| `npm run seed` | Load the demo dataset (skips existing rows) |
| `npm run reset` | Reset + reseed |
| `npm run check:db` | Step-by-step connection diagnosis (DNS, IPv6/IPv4, TCP, auth, schema) |
| `npm test` | API test suite (`node:test`) against `TEST_DATABASE_URL` |

## Troubleshooting the connection

Run `npm run check:db`. It reports each step and prints a fix, for example:

```
Target: db.viiyewnyqizuktwrlray.supabase.co:5432/postgres
✓ DNS resolves — IPv6 2a05:d01c:...
✗ TCP reachable — ENETUNREACH

This host has only IPv6 records and this machine has no working IPv6 route.
Use the pooler instead:
  postgresql://postgres.viiyewnyqizuktwrlray:...@aws-0-<region>.pooler.supabase.com:5432/postgres
```

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ENETUNREACH` / `EHOSTUNREACH` | `db.<ref>.supabase.co` publishes only an IPv6 address and the machine has no IPv6 route | Use the **Session pooler** URI (user `postgres.<ref>`) |
| `Tenant or user not found` | Pooler used with the plain `postgres` user | Pooler users are `postgres.<project-ref>` |
| `password authentication failed` | Wrong password, or special characters not URL-encoded | Reset the database password in Supabase and percent-encode it |
| `self signed certificate` / TLS errors | Strict TLS against a host without a CA bundle | Leave `DB_SSL` unset (TLS without CA verification) or set `DB_SSL=false` |
| `relation "products" does not exist` | Schema not applied | `npm run migrate` |
| Works locally, fails deployed | Host firewall blocks outbound 5432 | Allow outbound TCP 5432, or connect through the pooler |

## API

All responses are JSON. Errors use `{ "error": { "message": "...", "code": "..." } }`.

### Health & bootstrap

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | DB reachability, latency, server version — never leaks the URL |
| `GET` | `/api/state` | Everything the workspace needs in one round trip |
| `GET` | `/api/reports/summary?range=today\|week\|month\|all` | Revenue, COGS, gross/net profit, payment mix, top products, stock value |

### Resources

| Resource | Endpoints |
| --- | --- |
| Products | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/:id`, `POST /api/products/:id/stock` |
| Stock log | `GET /api/stock-moves`, `POST /api/stock-moves` |
| Sales | `GET /api/sales`, `GET /api/sales/:id`, `POST /api/sales` |
| Customers | `GET/POST /api/customers`, `PUT /api/customers/:id`, `POST /api/customers/:id/payments` |
| Employees | `GET/POST /api/employees`, `PUT /api/employees/:id` |
| Attendance | `GET /api/attendance`, `POST /api/attendance` (upsert by employee + date) |
| Expenses | `GET/POST /api/expenses`, `PUT/DELETE /api/expenses/:id` |
| Gift cards | `GET/POST /api/gift-cards`, `PATCH /api/gift-cards/:id` |
| Messages | `GET/POST /api/messages`, `POST /api/messages/:id/read` |
| Activity feed | `GET/POST /api/activities` |

### Write semantics

- Client generated IDs are accepted, and creates are **upserts**, so a retried
  request (for example a queued offline sale) cannot duplicate rows.
- `POST /api/sales` runs in a single transaction: sale + line items + stock
  deduction + stock movements + customer totals + gift card balance + activity.
  Re-posting the same sale ID is a no-op that returns the stored sale.
- Stock never goes below zero (`stock >= 0` constraint, `greatest(0, …)` updates).
- `unit_cost` is snapshotted on every line item so COGS stays correct after
  supplier prices change.

## Security notes

- `backend/.env` is gitignored. Credentials never belong in code or commits.
- The demo `staff sign-in` is not authentication: this API trusts the
  `cashierId` sent by the client. Put real auth (Supabase Auth, JWT, sessions)
  and per-role authorisation in front of it before production use.
- Rotate the database password if it has ever been pasted into a chat, ticket or
  screenshot, and prefer the Supabase pooler host with a dedicated role.
