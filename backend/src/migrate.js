import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { closePool, pool } from './db.js';
import { databaseConfigured } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, 'schema.sql');

const DROP_SQL = `
  drop view if exists v_daily_revenue_vs_expenses;
  drop view if exists v_sales_overview;
  drop view if exists v_stock_value;
  drop view if exists v_low_stock;
  drop table if exists message_reads cascade;
  drop table if exists messages cascade;
  drop table if exists activities cascade;
  drop table if exists attendance cascade;
  drop table if exists sale_items cascade;
  drop table if exists sales cascade;
  drop table if exists stock_moves cascade;
  drop table if exists customer_payments cascade;
  drop table if exists gift_cards cascade;
  drop table if exists expenses cascade;
  drop table if exists products cascade;
  drop table if exists customers cascade;
  drop table if exists employees cascade;
  drop table if exists schema_migrations cascade;
`;

export async function migrate({ reset = false, silent = false } = {}) {
  if (!databaseConfigured) throw new Error('DATABASE_URL is not configured');
  const sql = await readFile(schemaPath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (reset) {
      if (!silent) console.log('[migrate] dropping existing POSI tables');
      await client.query(DROP_SQL);
    }
    await client.query(sql);
    await client.query(
      `insert into schema_migrations (version) values ($1)
       on conflict (version) do nothing`,
      ['001_init'],
    );
    await client.query('commit');
    if (!silent) console.log('[migrate] schema is up to date');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => closePool())
    .catch(async error => {
      console.error('[migrate] failed:', error.message);
      await closePool().catch(() => {});
      process.exitCode = 1;
    });
}
