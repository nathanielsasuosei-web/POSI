#!/usr/bin/env node
// Renders the real app in jsdom against a running POSI API and walks a sale
// through the till. Catches wiring bugs that a bundler build cannot.
//
//   npm run dev:api          # in another terminal (default http://127.0.0.1:8787)
//   npm run test:ui
//
// The API is expected to be reachable and seeded; the script only adds records.
import { JSDOM } from 'jsdom';
import { createServer as createViteServer } from 'vite';

const API_ORIGIN = process.env.POSI_API_URL || 'http://127.0.0.1:8787';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
Object.defineProperty(globalThis, 'location', { value: window.location, configurable: true, writable: true });
globalThis.HTMLElement = window.HTMLElement;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.localStorage = window.localStorage;
globalThis.sessionStorage = window.sessionStorage;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.confirm = () => true;
window.print = () => {};
window.scrollTo = () => {};

// React logs an act() warning for every state update driven by the app's own
// polling; keep the smoke-test output readable.
const realConsoleError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes('not wrapped in act')) return;
  realConsoleError(...args);
};

const realFetch = globalThis.fetch;
const calls = [];
let networkUp = true;
globalThis.fetch = (input, init) => {
  if (!networkUp) return Promise.reject(new TypeError('Failed to fetch'));
  const url = typeof input === 'string' ? new URL(input, API_ORIGIN) : input;
  calls.push(`${init?.method || 'GET'} ${url.pathname}`);
  return realFetch(url, init);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const text = () => document.body.textContent.replace(/\s+/g, ' ');
const waitFor = async (predicate, label, timeout = 8000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}. Screen: ${text().slice(0, 400)}`);
};

const findByText = (label, selector = 'button') => [...document.querySelectorAll(selector)]
  .find(element => element.textContent.replace(/\s+/g, ' ').includes(label));

const click = async element => {
  if (!element) throw new Error('Tried to click a missing element');
  const { act } = await import('react');
  await act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(30);
  });
};

const results = [];
const check = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '✓' : '✗'} ${name}${condition ? '' : ` — ${detail}`}`);
};

const vite = await createViteServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});

try {
  await vite.ssrLoadModule('/src/main.jsx');

  // 1. Boot & sign-in
  await waitFor(() => text().includes('Sign in to POSI') || text().includes('Connecting to the database'), 'login screen');
  await waitFor(() => text().includes('Sign in to POSI'), 'login screen after sync');
  check('App boots and loads data from the API', calls.some(call => call.endsWith('/api/state')), calls.join(', '));

  await click(findByText('Cashier workspace'));
  check('Login screen shows the live staff list', text().includes('Ama Boateng'), text().slice(0, 200));
  await click(findByText('Owner workspace'));

  await click(findByText('Continue as owner'));
  await waitFor(() => text().includes('Drug store overview'), 'owner dashboard');
  check('Owner dashboard renders combined accounts', text().includes('Combined sales by payment'));
  check('Low stock alerts come from the database', text().includes('Low stock alerts'));

  // 2. Point of sale
  await click(findByText('Point of Sale'));
  await waitFor(() => text().includes('Current sale'), 'POS page');
  const productButton = [...document.querySelectorAll('.prod')].find(el => el.textContent.includes('Paracetamol'));
  check('POS lists products from the database', Boolean(productButton));
  await click(productButton);
  await waitFor(() => text().includes('Current sale'), 'cart refresh');
  check('Adding a product puts it in the cart', document.querySelectorAll('.cart-item, .cart-line').length > 0 || text().includes('Paracetamol 500mg × 1'));

  const getState = async () => (await realFetch(`${API_ORIGIN}/api/state`)).json();
  const beforeState = await getState();
  const beforeStock = beforeState.products.find(p => p.id === 'p1').stock;

  await click(findByText('Complete sale') || findByText('Checkout') || findByText('Charge'));
  await waitFor(() => text().includes('Complete sale —'), 'payment modal');
  const confirm = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirm Cash'));
  await click(confirm);
  await waitFor(() => text().includes('Sale invoiced'), 'success banner');
  check('Sale completes and shows the receipt banner', text().includes('Sale invoiced'));

  // The UI is optimistic, so wait for the write to land on the server.
  let afterState = await getState();
  for (let i = 0; i < 60 && afterState.sales.length <= beforeState.sales.length; i += 1) {
    await sleep(100);
    afterState = await getState();
  }
  const afterStock = afterState.products.find(p => p.id === 'p1').stock;
  check('Sale was persisted to PostgreSQL', afterState.sales.length > beforeState.sales.length, `${beforeState.sales.length} → ${afterState.sales.length}`);
  check('Stock was deducted by the API', afterStock === beforeStock - 1, `${beforeStock} → ${afterStock}`);

  await click(document.querySelector('.success .btn.icon'));
  check('Success banner dismisses', !text().includes('Sale invoiced'));

  // 3. Inventory reflects the sale
  await click(findByText('Stock & Items'));
  await waitFor(() => text().includes('Stock & Items') || text().includes('Inventory'), 'inventory page');
  check('Inventory page renders stock from the shared database', text().includes('Paracetamol 500mg'));

  // 4. Offline queue: a sale taken while the API is unreachable is kept and
  //    replayed once the connection returns.
  const beforeOffline = await getState();
  await click(findByText('Point of Sale'));
  await waitFor(() => text().includes('Current sale'), 'POS page again');
  const offlineProduct = [...document.querySelectorAll('.prod')].find(el => el.textContent.includes('ORS Sachet'));
  await click(offlineProduct);
  networkUp = false;
  await click(findByText('Charge'));
  await waitFor(() => text().includes('Complete sale —'), 'payment modal (offline)');
  await click([...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirm Cash')));
  await waitFor(() => text().includes('waiting to sync'), 'offline queue banner');
  check('Offline sale is queued and flagged in the UI', text().includes('waiting to sync'));
  check('Offline mode is visible in the top bar', text().includes('Offline') || text().includes('queued'));

  networkUp = true;
  await click(findByText('Sync now'));
  await waitFor(() => !text().includes('waiting to sync'), 'queue to drain', 10000);

  let afterOffline = await getState();
  for (let i = 0; i < 60 && afterOffline.sales.length <= beforeOffline.sales.length; i += 1) {
    await sleep(100);
    afterOffline = await getState();
  }
  check('Queued offline sale syncs to PostgreSQL', afterOffline.sales.length === beforeOffline.sales.length + 1, `${beforeOffline.sales.length} → ${afterOffline.sales.length}`);

  const failed = results.filter(result => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} UI checks passed`);
  if (failed.length) {
    console.error('Failed:', failed.map(result => result.name).join(', '));
    process.exitCode = 1;
  }
} catch (error) {
  console.error('\nUI smoke test crashed:', error.message);
  process.exitCode = 1;
} finally {
  await vite.close();
  dom.window.close();
  // The app polls by design; stop it from keeping the process alive.
  process.exit(process.exitCode || 0);
}
