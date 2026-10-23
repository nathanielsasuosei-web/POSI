import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';

// Local cache + write queue. The cache keeps the workspace usable offline; the
// queue holds writes made while the API was unreachable and replays them in
// order once it is back.

const CACHE_KEY = 'posi-v4-cache';
const QUEUE_KEY = 'posi-v4-queue';

const EMPTY = {
  products: [], sales: [], customers: [], employees: [], giftCards: [],
  messages: [], activities: [], attendance: [], expenses: [], stockMoves: [],
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage disabled — keep working in memory */
  }
};

const normalize = state => ({
  products: state.products || [],
  sales: state.sales || [],
  customers: state.customers || [],
  employees: state.employees || [],
  giftCards: state.giftCards || [],
  messages: state.messages || [],
  activities: state.activities || [],
  attendance: state.attendance || [],
  expenses: state.expenses || [],
  stockMoves: state.stockMoves || [],
});

const prepend = (list, item, limit) => [item, ...(list || [])].slice(0, limit);

const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const today = () => new Date().toISOString().slice(0, 10);

export function usePosiData() {
  const cached = useMemo(() => readJson(CACHE_KEY, null), []);

  const [data, setData] = useState(() => (cached ? normalize(cached) : EMPTY));
  const [status, setStatus] = useState(() => (cached ? 'cached' : 'loading'));
  const [queue, setQueue] = useState(() => readJson(QUEUE_KEY, []));
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(cached?.syncedAt || null);
  const [serverError, setServerError] = useState(null);
  const [syncIssue, setSyncIssue] = useState(null);

  const queueRef = useRef(queue);
  const hydrated = useRef(Boolean(cached));
  const flushing = useRef(false);
  const syncingRef = useRef(false);
  const statusRef = useRef(status);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { syncingRef.current = syncing; }, [syncing]);

  useEffect(() => {
    queueRef.current = queue;
    writeJson(QUEUE_KEY, queue);
  }, [queue]);

  useEffect(() => {
    if (!hydrated.current) return;
    writeJson(CACHE_KEY, { ...data, syncedAt: lastSyncedAt });
  }, [data, lastSyncedAt]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSyncing(true);
    try {
      const state = await api.state();
      hydrated.current = true;
      setData(normalize(state));
      setStatus('ready');
      setServerError(null);
      setLastSyncedAt(state.syncedAt || new Date().toISOString());
      return true;
    } catch (error) {
      hydrated.current = true;
      setStatus(prev => (prev === 'ready' ? 'cached' : (cached || prev === 'cached' ? 'cached' : 'error')));
      setServerError(error.message);
      return false;
    } finally {
      if (!silent) setSyncing(false);
    }
  }, [cached]);

  const enqueue = useCallback(item => {
    const entry = { ...item, id: item.id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, queuedAt: new Date().toISOString() };
    setQueue(prev => [...prev, entry]);
    return entry;
  }, []);

  const flushQueue = useCallback(async () => {
    if (flushing.current) return queueRef.current.length;
    const items = [...queueRef.current];
    if (!items.length) return 0;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return items.length;

    flushing.current = true;
    setSyncing(true);
    const remaining = [];
    const rejected = [];
    let networkDown = false;

    for (const item of items) {
      if (networkDown) {
        remaining.push(item);
        continue;
      }
      try {
        await api.request(item.method, item.path, item.body);
      } catch (error) {
        if (error.permanent) rejected.push({ label: item.label || 'Change', message: error.message });
        else {
          networkDown = true;
          remaining.push(item);
        }
      }
    }

    flushing.current = false;
    setQueue(remaining);
    queueRef.current = remaining;
    setSyncing(false);

    if (rejected.length) {
      setSyncIssue(`${rejected.length} saved change${rejected.length === 1 ? '' : 's'} could not be applied: ${rejected[0].label} — ${rejected[0].message}`);
    } else if (!remaining.length) {
      setSyncIssue(null);
    }

    if (!networkDown) {
      await refresh({ silent: true });
    }
    return remaining.length;
  }, [refresh]);

  /**
   * Apply an optimistic update, then persist it. Permanent (4xx) errors roll the
   * optimistic edit back by reloading server state; network errors stay in the
   * queue so nothing is lost.
   */
  const mutate = useCallback(async ({ request, queueItem, optimistic }) => {
    if (optimistic) setData(prev => optimistic(prev));

    try {
      const result = await request();
      if (statusRef.current !== 'ready') setStatus('ready');
      setServerError(null);
      setLastSyncedAt(new Date().toISOString());
      return { ok: true, queued: false, result };
    } catch (error) {
      if (error.permanent) {
        await refresh({ silent: true });
        setSyncIssue(error.message);
        return { ok: false, queued: false, error };
      }
      enqueue(queueItem);
      setStatus('cached');
      setServerError(error.message);
      return { ok: true, queued: true, error };
    }
  }, [enqueue, refresh]);

  // Boot: pull from the API, then drain anything left from a previous session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) await flushQueue();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onOnline = () => { refresh({ silent: true }).then(() => flushQueue()); };
    window.addEventListener('online', onOnline);
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (queueRef.current.length) flushQueue();
      else if (!syncingRef.current) refresh({ silent: true });
    }, 30000);
    return () => {
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [flushQueue, refresh]);

  const sync = useMemo(() => ({
    status,
    syncing,
    pending: queue.length,
    lastSyncedAt,
    error: serverError,
    issue: syncIssue,
    retry: flushQueue,
    refresh,
    dismissIssue: () => setSyncIssue(null),
  }), [status, syncing, queue.length, lastSyncedAt, serverError, syncIssue, flushQueue, refresh]);

  // ---------------------------------------------------------------- actions

  const saveProduct = useCallback((product, { editing = false, actor } = {}) => {
    const path = editing ? `/products/${product.id}` : '/products';
    const body = { ...product, actor };
    return mutate({
      request: () => (editing ? api.updateProduct(body) : api.createProduct(body)),
      queueItem: { method: editing ? 'PUT' : 'POST', path, body, label: `product “${product.name}”` },
      optimistic: prev => ({
        ...prev,
        products: editing ? prev.products.map(p => (p.id === product.id ? { ...p, ...product } : p)) : [product, ...prev.products],
      }),
    });
  }, [mutate]);

  const deleteProduct = useCallback(id => mutate({
    request: () => api.deleteProduct(id),
    queueItem: { method: 'DELETE', path: `/products/${id}`, label: 'delete product' },
    optimistic: prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }),
  }), [mutate]);

  const adjustStock = useCallback(({ product, mode, qty, cost, note, by, moveId }) => {
    const delta = mode === 'restock' ? Math.abs(qty) : -Math.abs(qty);
    const body = { mode, qty: Math.abs(qty), cost, note, by, moveId };
    return mutate({
      request: () => api.adjustStock(product.id, body),
      queueItem: { method: 'POST', path: `/products/${product.id}/stock`, body, label: `${mode} ${product.name}` },
      optimistic: prev => {
        const moved = prev.products.map(p => (p.id === product.id
          ? { ...p, stock: Math.max(0, p.stock + delta), ...(cost !== undefined && cost !== '' ? { cost: Number(cost) } : {}) }
          : p));
        const move = {
          id: moveId || `sm-local-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          type: mode,
          qty: delta,
          date: today(),
          time: nowTime(),
          by: by || 'Staff',
          note: note || '',
        };
        return {
          ...prev,
          products: moved,
          stockMoves: prepend(prev.stockMoves, move, 300),
          activities: prepend(prev.activities, {
            id: `act-local-${Date.now()}`,
            type: 'stock',
            title: `${by || 'Staff'} ${mode === 'restock' ? 'restocked' : 'adjusted'} ${product.name}`,
            detail: `${delta > 0 ? '+' : ''}${delta} units${note ? ` · ${note}` : ''}`,
            at: new Date().toISOString(),
            time: nowTime(),
          }, 40),
        };
      },
    });
  }, [mutate]);

  const saveCustomer = useCallback((customer, { editing = false } = {}) => mutate({
    request: () => (editing ? api.updateCustomer(customer) : api.createCustomer(customer)),
    queueItem: { method: editing ? 'PUT' : 'POST', path: editing ? `/customers/${customer.id}` : '/customers', body: customer, label: `customer “${customer.name}”` },
    optimistic: prev => ({
      ...prev,
      customers: editing ? prev.customers.map(c => (c.id === customer.id ? { ...c, ...customer } : c)) : [customer, ...prev.customers],
    }),
  }), [mutate]);

  const payAccount = useCallback((customerId, amount, by) => {
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return mutate({
      request: () => api.payAccount(customerId, { id: paymentId, amount, by }),
      queueItem: { method: 'POST', path: `/customers/${customerId}/payments`, body: { id: paymentId, amount, by }, label: 'account payment' },
      optimistic: prev => ({
        ...prev,
        customers: prev.customers.map(c => (c.id === customerId ? { ...c, balance: Math.max(0, Number(c.balance) - Number(amount)) } : c)),
        activities: prepend(prev.activities, {
          id: paymentId,
          type: 'account',
          title: 'Customer payment received',
          detail: `GH₵ ${Number(amount).toFixed(2)} · ${prev.customers.find(c => c.id === customerId)?.name || 'Customer'}`,
          time: nowTime(),
          at: new Date().toISOString(),
        }, 40),
      }),
    });
  }, [mutate]);

  const saveEmployee = useCallback((employee, { editing = false } = {}) => mutate({
    request: () => (editing ? api.updateEmployee(employee) : api.createEmployee(employee)),
    queueItem: { method: editing ? 'PUT' : 'POST', path: editing ? `/employees/${employee.id}` : '/employees', body: employee, label: `staff “${employee.name}”` },
    optimistic: prev => ({
      ...prev,
      employees: editing ? prev.employees.map(e => (e.id === employee.id ? { ...e, ...employee } : e)) : [employee, ...prev.employees],
    }),
  }), [mutate]);

  const saveAttendance = useCallback(entry => mutate({
    request: () => api.saveAttendance(entry),
    queueItem: { method: 'POST', path: '/attendance', body: entry, label: 'attendance' },
    optimistic: prev => {
      const exists = prev.attendance.some(a => a.employeeId === entry.employeeId && a.date === entry.date);
      return {
        ...prev,
        attendance: exists
          ? prev.attendance.map(a => (a.employeeId === entry.employeeId && a.date === entry.date ? { ...a, ...entry } : a))
          : [entry, ...prev.attendance],
      };
    },
  }), [mutate]);

  const saveExpense = useCallback((expense, { editing = false } = {}) => mutate({
    request: () => (editing ? api.updateExpense(expense) : api.createExpense(expense)),
    queueItem: { method: editing ? 'PUT' : 'POST', path: editing ? `/expenses/${expense.id}` : '/expenses', body: expense, label: 'expense' },
    optimistic: prev => ({
      ...prev,
      expenses: editing ? prev.expenses.map(e => (e.id === expense.id ? { ...e, ...expense } : e)) : [expense, ...prev.expenses],
    }),
  }), [mutate]);

  const deleteExpense = useCallback(id => mutate({
    request: () => api.deleteExpense(id),
    queueItem: { method: 'DELETE', path: `/expenses/${id}`, label: 'delete expense' },
    optimistic: prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }),
  }), [mutate]);

  const createGiftCard = useCallback(card => mutate({
    request: () => api.createGiftCard(card),
    queueItem: { method: 'POST', path: '/gift-cards', body: card, label: 'gift card' },
    optimistic: prev => ({ ...prev, giftCards: [card, ...prev.giftCards] }),
  }), [mutate]);

  const sendMessage = useCallback(message => mutate({
    request: () => api.sendMessage(message),
    queueItem: { method: 'POST', path: '/messages', body: message, label: 'message' },
    optimistic: prev => ({ ...prev, messages: [message, ...prev.messages] }),
  }), [mutate]);

  const markRead = useCallback((messageId, employeeId) => mutate({
    request: () => api.markMessageRead(messageId, employeeId),
    queueItem: { method: 'POST', path: `/messages/${messageId}/read`, body: { employeeId }, label: 'mark message read' },
    optimistic: prev => ({
      ...prev,
      messages: prev.messages.map(m => (m.id === messageId && !m.readBy?.includes(employeeId)
        ? { ...m, readBy: [...(m.readBy || []), employeeId] }
        : m)),
    }),
  }), [mutate]);

  const completeSale = useCallback(sale => {
    return mutate({
      request: () => api.createSale(sale),
      queueItem: { method: 'POST', path: '/sales', body: sale, label: `sale ${sale.invoiceNumber}` },
      optimistic: prev => {
        const products = prev.products.map(p => {
          const line = sale.items.find(i => i.productId === p.id);
          return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
        });
        const moves = sale.items.map((line, index) => ({
          id: `sm-${sale.id}-${index + 1}`,
          productId: line.productId,
          productName: line.name,
          type: 'sale',
          qty: -line.qty,
          date: sale.date,
          time: sale.time,
          by: sale.cashier,
          note: sale.id,
        }));
        const customers = prev.customers.map(c => (c.id === sale.customerId && !c.isWalkIn
          ? { ...c, totalSpent: Number(c.totalSpent) + Number(sale.total), visits: (c.visits || 0) + 1 }
          : c));
        const giftCards = sale.payment === 'Gift'
          ? prev.giftCards.map(g => {
            if (g.code !== sale.paymentDetail?.code) return g;
            const balance = Math.max(0, Number(g.balance) - Number(sale.total));
            return { ...g, balance, status: balance <= 0.01 ? 'used' : 'active' };
          })
          : prev.giftCards;
        return {
          ...prev,
          products,
          stockMoves: [...moves, ...prev.stockMoves].slice(0, 300),
          customers,
          giftCards,
          sales: [sale, ...prev.sales],
          activities: prepend(prev.activities, {
            id: `act-${sale.id}`,
            type: 'sale',
            title: `${sale.cashier} completed a sale`,
            detail: `GH₵ ${Number(sale.total).toFixed(2)} · ${sale.payment}`,
            time: sale.time,
            at: new Date().toISOString(),
          }, 40),
        };
      },
    });
  }, [mutate]);

  return {
    ...data,
    sync,
    actions: {
      saveProduct,
      deleteProduct,
      adjustStock,
      saveCustomer,
      payAccount,
      saveEmployee,
      saveAttendance,
      saveExpense,
      deleteExpense,
      createGiftCard,
      sendMessage,
      markRead,
      completeSale,
    },
  };
}
