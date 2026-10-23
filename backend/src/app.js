import express from 'express';
import { config } from './config.js';
import { databaseHealth } from './db.js';
import { HttpError } from './http.js';
import healthRoutes from './routes/health.js';
import stateRoutes from './routes/state.js';
import reportsRoutes from './routes/reports.js';
import productRoutes from './routes/products.js';
import saleRoutes from './routes/sales.js';
import customerRoutes from './routes/customers.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import expenseRoutes from './routes/expenses.js';
import giftCardRoutes from './routes/gift-cards.js';
import messageRoutes from './routes/messages.js';
import activityRoutes from './routes/activities.js';
import stockMoveRoutes from './routes/stock-moves.js';

const PG_ERRORS = {
  '23505': [409, 'A record with these details already exists'],
  '23503': [409, 'A related record is missing or still in use'],
  '23514': [400, 'A value violates a data rule'],
  '22P02': [400, 'A value has the wrong format'],
  '22003': [400, 'A number is out of range'],
  '57014': [504, 'The database query timed out'],
  '42P01': [500, 'The database schema is not initialised — run npm run migrate'],
};

const connectionError = error => ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH']
  .includes(error.code);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(express.json({ limit: '1mb' }));

  // Only needed when the browser calls the API from a different origin.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    const allowed = config.corsOrigins.includes('*') || config.corsOrigins.includes(origin);
    if (!allowed) return next();
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  });

  if (process.env.LOG_REQUESTS === 'true') {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`;
        if (res.statusCode >= 500) console.error(`[posi-api] ${line}`);
        else console.log(`[posi-api] ${line}`);
      });
      next();
    });
  }

  app.get('/', (req, res) => {
    res.json({
      service: 'POSI API',
      docs: 'See backend/README.md',
      endpoints: ['/api/health', '/api/state', '/api/reports/summary'],
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/state', stateRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/gift-cards', giftCardRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/stock-moves', stockMoveRoutes);

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { message: `No API route for ${req.method} ${req.originalUrl}`, code: 'not_found' } });
  });

  // Anything that is not the API is handled by the Vite dev server / static host.
  app.use((req, res) => {
    res.status(404).json({ error: { message: 'Not found', code: 'not_found' } });
  });

  // eslint-disable-next-line no-unused-vars
  app.use(async (error, req, res, next) => {
    if (error instanceof HttpError) {
      return res.status(error.status).json({
        error: { message: error.message, code: error.status === 400 ? 'bad_request' : 'error', details: error.details },
      });
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { message: 'Request body is not valid JSON', code: 'bad_request' } });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: { message: 'Request body is too large', code: 'too_large' } });
    }

    const [status, message] = PG_ERRORS[error.code] || [];
    if (status) {
      console.warn(`[posi-api] database error ${error.code}: ${error.message}`);
      return res.status(status).json({ error: { message, code: 'database_error', detail: error.detail || undefined } });
    }

    if (connectionError(error)) {
      const health = await databaseHealth({ force: true });
      console.error(`[posi-api] database unreachable: ${health.error}`);
      return res.status(503).json({
        error: {
          message: 'The database is unreachable. Check DATABASE_URL and that this host allows outbound PostgreSQL connections.',
          code: 'database_unreachable',
        },
      });
    }

    console.error('[posi-api] unhandled error:', error);
    return res.status(500).json({ error: { message: 'Something went wrong on the server', code: 'internal_error' } });
  });

  return app;
}
