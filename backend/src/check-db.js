#!/usr/bin/env node
// Diagnoses a DATABASE_URL step by step: DNS, IPv4/IPv6 reachability, TCP,
// TLS + authentication, and the schema. Prints an actionable hint when the
// usual Supabase pitfalls (IPv6-only direct host, pooler user format) apply.
//
//   npm run db:check            # uses backend/.env
//   DATABASE_URL=... npm run db:check
import dns from 'node:dns/promises';
import net from 'node:net';
import { config, databaseConfigured, safeDatabaseLabel } from './config.js';
import { closePool, databaseHealth } from './db.js';
import { supabaseHint } from './lib/hints.js';

const step = (ok, label, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
]);

async function main() {
  if (!databaseConfigured) {
    console.error('✗ DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
    process.exitCode = 1;
    return;
  }

  console.log(`Target: ${safeDatabaseLabel}`);
  const url = (() => {
    try {
      return new URL(config.databaseUrl);
    } catch {
      return null;
    }
  })();

  // Unix socket or a DSN without a host: skip straight to the real query.
  if (!url || !url.hostname) {
    const health = await databaseHealth({ force: true });
    step(health.ok, `PostgreSQL query${health.latencyMs !== null ? ` (${health.latencyMs}ms)` : ''}`, health.ok ? `server ${health.version}` : health.error);
    process.exitCode = health.ok ? 0 : 1;
    return;
  }

  const host = url.hostname;
  const port = Number(url.port || 5432);
  const user = decodeURIComponent(url.username || 'postgres');
  const projectRef = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1];

  // 1. DNS
  const [v4, v6] = await Promise.all([
    dns.resolve4(host).catch(() => []),
    dns.resolve6(host).catch(() => []),
  ]);
  const dnsOk = v4.length > 0 || v6.length > 0;
  step(dnsOk, 'DNS resolves', [v4.length ? `IPv4 ${v4.join(', ')}` : '', v6.length ? `IPv6 ${v6.join(', ')}` : ''].filter(Boolean).join(' · ') || 'no A/AAAA records');
  if (!dnsOk) {
    console.log('\nThe host does not exist or DNS is blocked. Check the project ref and your connection string.');
    process.exitCode = 1;
    return;
  }

  // 2. TCP
  const tcp = await new Promise(resolve => {
    const socket = net.connect({ host, port });
    const done = (ok, detail) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ok, detail });
    };
    socket.setTimeout(8000, () => done(false, 'timed out after 8s'));
    socket.on('connect', () => done(true, `connected to ${host}:${port}`));
    socket.on('error', error => done(false, `${error.code || error.message}`));
  });
  step(tcp.ok, 'TCP reachable', tcp.detail);

  if (!tcp.ok && v4.length === 0 && v6.length > 0) {
    console.log('\nThis host has only IPv6 records and this machine has no working IPv6 route.');
    console.log(supabaseHint(config.databaseUrl));
    process.exitCode = 1;
    return;
  }

  if (!tcp.ok) {
    console.log('\nNothing is listening on that host/port from here. Check the port (5432), the project status, and any firewall or IP allow-list.');
    process.exitCode = 1;
    return;
  }

  // 3. TLS + authentication + a real query.
  const health = await withTimeout(databaseHealth({ force: true }), 15000, 'query timed out');
  step(health.ok, `Authenticated query${health.latencyMs !== null ? ` (${health.latencyMs}ms)` : ''}`, health.ok ? `PostgreSQL ${health.version}` : health.error);

  if (!health.ok && projectRef && !user.includes('.')) {
    console.log(`\nHint: pooler connections use the user "postgres.${projectRef}", not "postgres".`);
    console.log('If the error was "Tenant or user not found", switch to the pooler connection string from the Supabase dashboard.');
  }
  if (health.ok && projectRef) {
    console.log('\nDirect Supabase connection works from this machine.');
  }

  // 4. Schema
  if (health.ok) {
    const { rows } = await import('./db.js').then(module => module.query(
      `select
         (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('products','sales','employees'))::int as posi_tables`,
    ).catch(() => ({ rows: [{ posi_tables: -1 }] })));
    const tables = Number(rows[0]?.posi_tables ?? -1);
    if (tables === 3) step(true, 'POSI schema present');
    else if (tables <= 0) {
      step(false, 'POSI schema missing');
      console.log('\nRun the migrations: npm run db:migrate (then optionally npm run db:seed).');
      process.exitCode = 1;
    } else {
      step(false, 'POSI schema incomplete');
      console.log('\nRun npm run db:migrate to finish creating the tables.');
      process.exitCode = 1;
    }
  } else {
    process.exitCode = 1;
  }
}

main()
  .catch(error => {
    console.error('✗ check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
