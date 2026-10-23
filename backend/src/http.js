export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const serviceUnavailable = (message, details) => new HttpError(503, message, details);

/** Wrap an async route handler so rejections reach the error middleware. */
export const route = handler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const str = (value, { max = 500, fallback = '' } = {}) => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length > max ? text.slice(0, max) : text;
};

export const requiredStr = (value, field, { max = 500 } = {}) => {
  const text = str(value, { max });
  if (!text) throw badRequest(`${field} is required`);
  return text;
};

export const num = (value, { field = 'value', fallback = 0, min = -1e12, max = 1e12 } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw badRequest(`${field} must be a number`);
  if (parsed < min || parsed > max) throw badRequest(`${field} must be between ${min} and ${max}`);
  return parsed;
};

export const int = (value, opts = {}) => Math.round(num(value, opts));

export const dateKey = (value, { fallback = null, field = 'date' } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw badRequest(`${field} must be YYYY-MM-DD`);
  return text;
};

export const timeKey = (value, { fallback = null } = {}) => {
  if (value === undefined || value === null || value === '') return fallback;
  const text = String(value).trim();
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(text)) throw badRequest('time must be HH:MM');
  return text.slice(0, 5);
};

export const oneOf = (value, allowed, field, fallback) => {
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw badRequest(`${field} is required`);
  }
  const text = String(value);
  if (!allowed.includes(text)) throw badRequest(`${field} must be one of ${allowed.join(', ')}`);
  return text;
};

export const arrayOf = (value, field) => {
  if (!Array.isArray(value)) throw badRequest(`${field} must be an array`);
  return value;
};

export const idFrom = (...candidates) => {
  for (const candidate of candidates) {
    const text = str(candidate, { max: 64 });
    if (text) return text;
  }
  return null;
};
