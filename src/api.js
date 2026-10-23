// Thin client for the POSI API.
// In development Vite proxies /api to the backend (see vite.config.js), so the
// browser only ever talks to its own origin.

const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const TIMEOUT_MS = 12000;

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload || null;
  }

  /** 4xx responses are the server rejecting the data; retrying will not help. */
  get permanent() {
    return this.status >= 400 && this.status < 500;
  }
}

async function request(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message = payload?.error?.message || `Request failed (${response.status})`;
      throw new ApiError(message, response.status, payload?.error);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'AbortError') throw new ApiError('The server took too long to respond', 0, { code: 'timeout' });
    throw new ApiError('Cannot reach the POSI server', 0, { code: 'network' });
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  request,
  health: () => request('GET', '/health', undefined),
  state: () => request('GET', '/state', undefined),
  reports: range => request('GET', `/reports/summary?range=${encodeURIComponent(range)}`, undefined),

  createProduct: product => request('POST', '/products', product),
  updateProduct: product => request('PUT', `/products/${encodeURIComponent(product.id)}`, product),
  deleteProduct: id => request('DELETE', `/products/${encodeURIComponent(id)}`, undefined),
  adjustStock: (id, payload) => request('POST', `/products/${encodeURIComponent(id)}/stock`, payload),

  createSale: sale => request('POST', '/sales', sale),

  createCustomer: customer => request('POST', '/customers', customer),
  updateCustomer: customer => request('PUT', `/customers/${encodeURIComponent(customer.id)}`, customer),
  payAccount: (customerId, payload) => request('POST', `/customers/${encodeURIComponent(customerId)}/payments`, payload),

  createEmployee: employee => request('POST', '/employees', employee),
  updateEmployee: employee => request('PUT', `/employees/${encodeURIComponent(employee.id)}`, employee),

  saveAttendance: entry => request('POST', '/attendance', entry),

  createExpense: expense => request('POST', '/expenses', expense),
  updateExpense: expense => request('PUT', `/expenses/${encodeURIComponent(expense.id)}`, expense),
  deleteExpense: id => request('DELETE', `/expenses/${encodeURIComponent(id)}`, undefined),

  createGiftCard: card => request('POST', '/gift-cards', card),
  updateGiftCard: (id, patch) => request('PATCH', `/gift-cards/${encodeURIComponent(id)}`, patch),

  sendMessage: message => request('POST', '/messages', message),
  markMessageRead: (id, employeeId) => request('POST', `/messages/${encodeURIComponent(id)}/read`, { employeeId }),
};
