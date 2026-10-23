import { createApp } from './app.js';
import { config, databaseConfigured, safeDatabaseLabel } from './config.js';
import { databaseHealth, closePool, pool } from './db.js';
import { migrate } from './migrate.js';
import { seedIfEmpty } from './seed.js';
import { supabaseHint } from './lib/hints.js';

const app = createApp();

async function bootstrap() {
  if (!databaseConfigured) {
    console.warn('[posi-api] running without DATABASE_URL — every data route will answer 503');
  } else {
    console.log(`[posi-api] database target: ${safeDatabaseLabel}`);
    if (config.autoMigrate) {
      try {
        await migrate({ silent: true });
        console.log('[posi-api] schema ready');
      } catch (error) {
        console.error('[posi-api] migration failed:', error.message);
      }
    }
    if (config.seedOnEmpty) {
      try {
        const seeded = await seedIfEmpty();
        if (seeded) console.log('[posi-api] demo dataset inserted');
      } catch (error) {
        console.error('[posi-api] seeding skipped:', error.message);
      }
    }
    const health = await databaseHealth({ force: true });
    if (health.ok) console.log(`[posi-api] database ok (${health.latencyMs}ms)`);
    else {
      console.error(`[posi-api] database not reachable: ${health.error}`);
      const hint = supabaseHint(config.databaseUrl);
      if (hint) console.error(`[posi-api] hint: ${hint}`);
      console.error('[posi-api] run "npm run db:check" in the backend folder for a step-by-step diagnosis.');
    }
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[posi-api] listening on http://0.0.0.0:${config.port}`);
  });

  const shutdown = async signal => {
    console.log(`[posi-api] ${signal} received, shutting down`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', reason => {
    console.error('[posi-api] unhandled rejection:', reason);
  });

  // Keep one idle client warm so the first request is not slowed by a handshake.
  if (databaseConfigured) pool.query('select 1').catch(() => {});
}

bootstrap().catch(error => {
  console.error('[posi-api] failed to start:', error);
  process.exit(1);
});
