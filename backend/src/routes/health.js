import { Router } from 'express';
import { databaseHealth } from '../db.js';
import { safeDatabaseLabel } from '../config.js';
import { route } from '../http.js';

const router = Router();

router.get('/', route(async (req, res) => {
  const database = await databaseHealth({ force: req.query.force === '1' });
  const status = database.ok ? 'ok' : 'degraded';
  res.status(database.ok ? 200 : 503).json({
    status,
    service: 'posi-api',
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      ...database,
      target: safeDatabaseLabel,
    },
    time: new Date().toISOString(),
  });
}));

export default router;
