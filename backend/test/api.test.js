import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// These tests point the API at a throwaway database and RESET it, so they only
// run when TEST_DATABASE_URL is set explicitly.
//
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/posi_test npm test
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('POSI API', { skip: testDatabaseUrl ? false : 'set TEST_DATABASE_URL to run the API tests' }, async t => {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = 'test';

  const { migrate } = await import('../src/migrate.js');
  const { seedIfEmpty } = await import('../src/seed.js');
  const { createApp } = await import('../src/app.js');
  const { closePool } = await import('../src/db.js');

  await migrate({ reset: true, silent: true });
  await seedIfEmpty();

  const server = createServer(createApp());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const api = async (method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    return { status: response.status, body: payload };
  };

  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await closePool();
  });

  await t.test('health reports a reachable database', async () => {
    const { status, body } = await api('GET', '/health');
    assert.equal(status, 200);
    assert.equal(body.database.ok, true);
    assert.equal(typeof body.database.target, 'string');
    assert.equal(body.database.target.length > 0, true);
    assert.equal(JSON.stringify(body).includes(testDatabaseUrl), false, 'health must never leak credentials');
  });

  await t.test('state returns the full workspace', async () => {
    const { status, body } = await api('GET', '/state');
    assert.equal(status, 200);
    assert.equal(body.products.length, 12);
    assert.equal(body.sales.length, 4);
    assert.equal(body.sales[0].items.length >= 1, true);
    assert.equal(typeof body.shop.name, 'string');
  });

  await t.test('a sale updates stock, movements, customer totals and gift balance', async () => {
    const sale = {
      id: 'POS-TEST-100',
      invoiceNumber: 'INV-TEST-100',
      cashier: 'Ama Boateng',
      cashierId: 'e2',
      customerId: 'c2',
      customerName: 'Akosua Boateng',
      items: [
        { productId: 'p1', name: 'Paracetamol 500mg', qty: 2, unitPrice: 12.5 },
        { productId: 'p2', name: 'Ibuprofen 400mg', qty: 1, unitPrice: 18 },
      ],
      discount: 2,
      payment: 'Cash',
      paymentDetail: { tendered: 50 },
    };

    const created = await api('POST', '/sales', sale);
    assert.equal(created.status, 201);
    assert.equal(created.body.total, 41);
    assert.equal(created.body.itemCount, 3);
    assert.equal(created.body.items.length, 2);

    const state = await api('GET', '/state');
    const paracetamol = state.body.products.find(p => p.id === 'p1');
    assert.equal(paracetamol.stock, 48 - 2, 'stock is deducted');

    const customer = state.body.customers.find(c => c.id === 'c2');
    assert.equal(customer.totalSpent, 1250 + 41);
    assert.equal(customer.visits, 19);

    const movements = state.body.stockMoves.filter(m => m.note === 'POS-TEST-100');
    assert.equal(movements.length, 2);
    assert.equal(movements.every(m => m.type === 'sale' && m.qty < 0), true);
  });

  await t.test('replaying the same sale is idempotent', async () => {
    const before = await api('GET', '/products/p1');
    const replay = await api('POST', '/sales', {
      id: 'POS-TEST-100',
      items: [{ productId: 'p1', qty: 2, unitPrice: 12.5 }],
      payment: 'Cash',
    });
    assert.equal(replay.status, 200);
    const after = await api('GET', '/products/p1');
    assert.equal(after.body.stock, before.body.stock, 'stock is not deducted twice');
  });

  await t.test('a sale is rejected when stock is insufficient', async () => {
    const { status, body } = await api('POST', '/sales', {
      id: 'POS-TEST-101',
      items: [{ productId: 'p10', qty: 999 }],
      payment: 'Cash',
    });
    assert.equal(status, 400);
    assert.match(body.error.message, /stock/i);
  });

  await t.test('gift card payments debit the card', async () => {
    const before = await api('GET', '/state');
    const card = before.body.giftCards.find(g => g.code === 'GIFT-100-001');

    const sale = await api('POST', '/sales', {
      id: 'POS-TEST-102',
      items: [{ productId: 'p6', qty: 2, unitPrice: 6 }],
      payment: 'Gift',
      paymentDetail: { code: card.code },
      customerId: 'c1',
      customerName: 'Walk-in customer',
    });
    assert.equal(sale.status, 201);

    const after = await api('GET', '/state');
    const updated = after.body.giftCards.find(g => g.code === card.code);
    assert.equal(updated.balance, card.balance - 12);
  });

  await t.test('restocking is idempotent per move id', async () => {
    const first = await api('POST', '/products/p10/stock', { mode: 'restock', qty: 5, moveId: 'sm-test-1', by: 'Abena Mensah' });
    assert.equal(first.status, 201);
    assert.equal(first.body.product.stock, 8);

    const replay = await api('POST', '/products/p10/stock', { mode: 'restock', qty: 5, moveId: 'sm-test-1' });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);

    const product = await api('GET', '/products/p10');
    assert.equal(product.body.stock, 8, 'stock is not applied twice');
  });

  await t.test('validation errors are friendly 400s', async () => {
    const missing = await api('POST', '/products', { id: 'p-test', name: '' });
    assert.equal(missing.status, 400);
    assert.match(missing.body.error.message, /name/);

    const badCategory = await api('POST', '/products', { id: 'p-test', name: 'Test', category: 'Cars', price: 1 });
    assert.equal(badCategory.status, 400);

    const badExpense = await api('POST', '/expenses', { id: 'x-test', amount: -5, category: 'Supplies' });
    assert.equal(badExpense.status, 400);
  });

  await t.test('editing a customer keeps sale totals intact', async () => {
    const state = await api('GET', '/state');
    const customer = state.body.customers.find(c => c.id === 'c3');
    const updated = await api('PUT', '/customers/c3', { ...customer, name: 'Kwame Asare Jnr', totalSpent: 0, visits: 0 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.name, 'Kwame Asare Jnr');
    assert.equal(updated.body.totalSpent, customer.totalSpent);
    assert.equal(updated.body.visits, customer.visits);
  });

  await t.test('account payments reduce the balance once', async () => {
    const payment = { id: 'pay-test-1', amount: 20, by: 'Abena Mensah' };
    const first = await api('POST', '/customers/c5/payments', payment);
    assert.equal(first.status, 201);
    assert.equal(first.body.customer.balance, 25.5);

    const replay = await api('POST', '/customers/c5/payments', payment);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.applied, false);
    assert.equal(replay.body.customer.balance, 25.5);
  });

  await t.test('messages record reads per employee', async () => {
    const read = await api('POST', '/messages/m1/read', { employeeId: 'e2' });
    assert.deepEqual(read.body.readBy, ['e2']);
    const again = await api('POST', '/messages/m1/read', { employeeId: 'e2' });
    assert.deepEqual(again.body.readBy, ['e2']);
  });

  await t.test('reports summarise revenue, cogs and expenses', async () => {
    const { status, body } = await api('GET', '/reports/summary?range=week');
    assert.equal(status, 200);
    assert.equal(body.revenue > 0, true);
    assert.equal(body.cogs > 0, true);
    assert.equal(typeof body.grossProfit, 'number');
    assert.equal(Array.isArray(body.paymentBreakdown), true);
    assert.equal(body.daily.length, 7);
    assert.equal(body.stockValue.productCount, 12);
  });

  await t.test('unknown routes answer a JSON 404', async () => {
    const { status, body } = await api('GET', '/nope');
    assert.equal(status, 404);
    assert.equal(body.error.code, 'not_found');
  });
});
