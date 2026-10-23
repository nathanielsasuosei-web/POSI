import 'dotenv/config';

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const list = (value) => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const databaseUrl = process.env.DATABASE_URL || '';

const isLocalHost = (() => {
  try {
    const { hostname, host } = new URL(databaseUrl);
    const name = hostname || host;
    return ['localhost', '127.0.0.1', '::1', ''].includes(name) || name.endsWith('.local');
  } catch {
    return true;
  }
})();

// Supabase terminates TLS with a certificate that Node does not ship a CA for,
// so remote hosts are verified as encrypted but not against a CA bundle unless
// DB_SSL_STRICT=true is set.
const ssl = (() => {
  if (!databaseUrl) return false;
  const envValue = process.env.DB_SSL;
  if (envValue !== undefined && envValue !== '') {
    return bool(envValue, false) ? { rejectUnauthorized: bool(process.env.DB_SSL_STRICT, false) } : false;
  }
  if (/[?&]sslmode=disable/.test(databaseUrl)) return false;
  return isLocalHost ? false : { rejectUnauthorized: bool(process.env.DB_SSL_STRICT, false) };
})();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8787),
  databaseUrl,
  ssl,
  statementTimeoutMs: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 15000),
  connectionTimeoutMs: Number(process.env.DB_CONNECT_TIMEOUT_MS || 8000),
  autoMigrate: bool(process.env.AUTO_MIGRATE, true),
  seedOnEmpty: bool(process.env.SEED_ON_EMPTY, true),
  corsOrigins: list(process.env.CORS_ORIGINS),
  salesLimit: Number(process.env.STATE_SALES_LIMIT || 2000),
  shop: {
    name: process.env.SHOP_NAME || 'Green Cross Drug Store',
    address: process.env.SHOP_ADDRESS || '12 Oxford Street, Osu, Accra',
    phone: process.env.SHOP_PHONE || '030 274 1122',
  },
};

export const databaseConfigured = Boolean(config.databaseUrl);

if (!databaseConfigured) {
  console.warn('[posi-api] DATABASE_URL is not set. Copy backend/.env.example to backend/.env and add your connection string.');
}

// Never log the raw connection string: it carries the database password.
export const safeDatabaseLabel = (() => {
  if (!databaseConfigured) return 'not configured';
  try {
    if (databaseUrl.includes('://') && /[?&]host=/.test(databaseUrl)) {
      const socket = decodeURIComponent(databaseUrl.match(/[?&]host=([^&]*)/)[1]);
      return `unix socket ${socket}`;
    }
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || 5432}${url.pathname}`;
  } catch {
    return 'unparseable DATABASE_URL';
  }
})();
