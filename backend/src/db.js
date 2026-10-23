import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// PostgreSQL returns NUMERIC and BIGINT as strings; the app works with numbers.
types.setTypeParser(1700, value => (value === null ? null : Number(value))); // numeric
types.setTypeParser(20, value => (value === null ? null : Number(value))); // int8 (counts)
types.setTypeParser(1082, value => value); // date -> 'YYYY-MM-DD' (no timezone shift)

export const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  ssl: config.ssl,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: config.connectionTimeoutMs,
  statement_timeout: config.statementTimeoutMs,
  application_name: 'posi-api',
});

pool.on('error', error => {
  console.error('[posi-api] idle database client error:', error.message);
});

export const query = (text, params) => pool.query(text, params);

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      /* the connection is already gone */
    }
    throw error;
  } finally {
    client.release();
  }
}

let healthCache = { at: 0, value: null };

export async function databaseHealth({ force = false } = {}) {
  if (!config.databaseUrl) {
    return { ok: false, error: 'DATABASE_URL is not configured', latencyMs: null, version: null };
  }
  const now = Date.now();
  if (!force && healthCache.value && now - healthCache.at < 10_000) return healthCache.value;

  const started = Date.now();
  try {
    const { rows } = await pool.query('select current_setting($1, true) as version', ['server_version']);
    const value = {
      ok: true,
      error: null,
      latencyMs: Date.now() - started,
      version: rows[0]?.version || null,
    };
    healthCache = { at: now, value };
    return value;
  } catch (error) {
    const value = {
      ok: false,
      error: error.message,
      latencyMs: Date.now() - started,
      version: null,
    };
    healthCache = { at: now, value };
    return value;
  }
}

export async function closePool() {
  await pool.end();
}
