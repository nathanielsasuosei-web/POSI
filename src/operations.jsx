import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3,
  Coins, Database, Download, Edit2, FileText, HardDriveDownload, History, KeyRound,
  Mail, MapPin, Package, Phone, Plus, Receipt, Repeat2, Search, Settings as SettingsIcon,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, Trash2, TrendingUp, UserRound,
  Users, Wallet, Wrench, X
} from 'lucide-react';

const selectOnEnter = (e)=>{ if(e.key==='Enter'){ e.preventDefault(); e.currentTarget.select() } };


const format = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const addDaysTo = (date, n) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
};
const readableDate = (v) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const dayLabel = (v) => v === todayKey() ? 'Today' : readableDate(v);
const uid = (p = 'id') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const initials = (name = '') => name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const csvCell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
const downloadCsv = (name, rows) => {
  const url = URL.createObjectURL(new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const DEFAULT_SETTINGS = {
  shopName: 'Your store',
  address: '',
  phone: '',
  email: '',
  invoicePrefix: 'INV',
  discountPercent: 0,
  defaultLowStock: 5,
  receiptFooter: 'Thank you for shopping with us. Please keep your receipt.',
};

export const DEFAULT_MAINTENANCE = [];

const eventTypeMeta = {
  sale: { label: 'Sale', icon: ShoppingCart },
  stock: { label: 'Stock', icon: Package },
  expense: { label: 'Expense', icon: Coins },
  staff: { label: 'Staff', icon: Users },
  maintenance: { label: 'Maintenance', icon: Wrench },
  activity: { label: 'Activity', icon: Activity },
};

export function TimelinePage({ activities, sales, stockMoves, expenses, maintenance, messages }) {
  const [range, setRange] = useState('30');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');

  const events = useMemo(() => {
    const list = [];
    sales.forEach(s => list.push({
      id: `sale-${s.id}`, type: 'sale', date: s.date, time: s.time || '00:00',
      title: `${s.invoiceNumber || s.id} · ${s.customerName}`,
      detail: `${s.itemCount || 0} items · ${s.payment} · sold by ${s.cashier || 'Staff'}`,
      amount: Number(s.total || 0), ref: s.id,
    }));
    stockMoves.forEach(m => list.push({
      id: `stock-${m.id}`, type: 'stock', date: m.date, time: m.time || '00:00',
      title: `${m.productName} · ${m.type === 'restock' ? 'stock in' : m.type === 'sale' ? 'sold' : 'stock adjustment'}`,
      detail: `${m.qty > 0 ? '+' : ''}${m.qty} units${m.note ? ` · ${m.note}` : ''} · ${m.by || 'Staff'}`,
    }));
    expenses.forEach(e => list.push({
      id: `expense-${e.id}`, type: 'expense', date: e.date, time: e.time || '12:00',
      title: `${e.category} expense${e.note ? ` · ${e.note}` : ''}`,
      detail: `${e.payment || 'Payment'} · recorded by ${e.by || 'Staff'}`,
      amount: -Number(e.amount || 0),
    }));
    activities.filter(a => !['sale', 'stock', 'expense', 'maintenance'].includes(a.type)).forEach(a => list.push({
      id: `activity-${a.id}`, type: a.type === 'staff' ? 'staff' : a.type === 'product' ? 'stock' : 'activity',
      date: a.date || todayKey(), time: a.time || '00:00', title: a.title, detail: a.detail || '',
    }));
    maintenance.forEach(m => {
      if (m.status === 'completed' && m.completedDate) {
        list.push({
          id: `maintenance-complete-${m.id}`, type: 'maintenance', date: m.completedDate, time: '12:00',
          title: `${m.asset} · service completed`, detail: `${m.title} · ${m.vendor || 'In-house'}`,
          amount: m.actualCost ? -Number(m.actualCost) : undefined,
        });
      } else {
        list.push({
          id: `maintenance-due-${m.id}`, type: 'maintenance', date: m.dueDate, time: '09:00',
          title: `${m.asset} · maintenance due`, detail: `${m.title} · ${m.vendor || 'In-house'}`,
        });
      }
    });
    messages.forEach(m => list.push({
      id: `message-${m.id}`, type: 'activity', date: m.date, time: m.time || '00:00',
      title: `Message · ${m.subject}`, detail: `${m.from} → ${m.toName}`,
    }));
    return list.sort((a, b) => `${b.date || ''}T${b.time || ''}`.localeCompare(`${a.date || ''}T${a.time || ''}`));
  }, [activities, sales, stockMoves, expenses, maintenance, messages]);

  const filtered = events.filter(e => {
    if (range === 'today' && e.date !== todayKey()) return false;
    if (range === '7' && (!e.date || e.date < daysAgo(6))) return false;
    if (range === '30' && (!e.date || e.date < daysAgo(29))) return false;
    if (type !== 'all' && e.type !== type) return false;
    const q = query.trim().toLowerCase();
    return !q || `${e.title} ${e.detail} ${e.ref || ''}`.toLowerCase().includes(q);
  });

  const groups = filtered.reduce((acc, event) => {
    const key = event.date || 'No date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
  const salesTotal = filtered.filter(e => e.type === 'sale').reduce((s, e) => s + Number(e.amount || 0), 0);
  const expenseTotal = Math.abs(filtered.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0));

  const exportTimeline = () => downloadCsv(`activity-timeline-${todayKey()}.csv`, [
    ['Date', 'Time', 'Type', 'Event', 'Details', 'Amount (GH₵)'],
    ...filtered.map(e => [e.date, e.time, eventTypeMeta[e.type]?.label || 'Activity', e.title, e.detail, e.amount ?? '']),
  ]);

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow"><History size={12}/> SHOP TIMELINE</div><h1>Everything that happened, in order</h1></div>
        <button className="btn" onClick={exportTimeline} disabled={!filtered.length}><Download size={15}/> Export timeline</button>
      </div>

      <div className="kpi-row" style={{ marginBottom: '12px' }}>
        <span className="kpi"><Activity size={14}/><b>{filtered.length}</b> events</span>
        <span className="kpi"><ShoppingCart size={14}/> Sales <b>{format(salesTotal)}</b></span>
        <span className="kpi"><Coins size={14}/> Expenses <b>{format(expenseTotal)}</b></span>
        <span className="kpi"><Clock3 size={14}/>{range === 'all' ? 'All recorded activity' : range === 'today' ? 'Today' : `Last ${range} days`}</span>
      </div>

      <div className="card timeline-card">
        <div className="toolbar timeline-toolbar">
          <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={selectOnEnter} placeholder="Search invoice, product, staff or event…"/></div>
          <select aria-label="Filter timeline by type" value={type} onChange={e => setType(e.target.value)} className="select-control">
            <option value="all">All event types</option><option value="sale">Sales</option><option value="stock">Stock</option>
            <option value="expense">Expenses</option><option value="staff">Staff</option><option value="maintenance">Maintenance</option><option value="activity">Other activity</option>
          </select>
          <div className="chips">{[['today', 'Today'], ['7', '7 days'], ['30', '30 days'], ['all', 'All time']].map(([id, label]) => <button key={id} className={`chip-btn ${range === id ? 'active' : ''}`} onClick={() => setRange(id)}>{label}</button>)}</div>
        </div>

        {Object.keys(groups).length ? <div className="timeline-list">
          {Object.entries(groups).map(([date, dayEvents]) => (
            <section className="timeline-day" key={date}>
              <div className="timeline-date"><b>{dayLabel(date)}</b><small>{dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}</small></div>
              <div className="timeline-events">
                {dayEvents.map(event => {
                  const meta = eventTypeMeta[event.type] || eventTypeMeta.activity;
                  const Icon = meta.icon;
                  return <article className="timeline-event" key={event.id}>
                    <span className={`timeline-icon ${event.type}`}><Icon size={16}/></span>
                    <div className="timeline-copy"><div><span className="timeline-type">{meta.label}</span><small>{event.time || '—'}</small></div><b>{event.title}</b><p>{event.detail || 'No additional details'}</p></div>
                    {event.amount !== undefined && <strong className={event.amount < 0 ? 'negative' : 'positive'}>{event.amount < 0 ? '−' : '+'}{format(Math.abs(event.amount))}</strong>}
                  </article>;
                })}
              </div>
            </section>
          ))}
        </div> : <div className="empty-state"><History size={22}/><b>No activity in this view</b><small>Try another date range, event type or search term.</small></div>}
      </div>
    </div>
  );
}

export function LeadsPage({ customers, sales, products, onStartSale }) {
  const [range, setRange] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('value');

  const periodSales = useMemo(() => sales.filter(s => {
    if (range === '30') return s.date >= daysAgo(29);
    if (range === '90') return s.date >= daysAgo(89);
    return true;
  }), [sales, range]);

  const leads = useMemo(() => customers.filter(c => !c.isWalkIn).map(customer => {
    const allCustomerSales = sales.filter(s => s.customerId === customer.id);
    const customerSales = periodSales.filter(s => s.customerId === customer.id);
    const productMap = new Map();
    customerSales.forEach(s => (s.items || []).forEach(item => {
      const key = item.productId || item.name;
      const product = products.find(p => p.id === item.productId);
      const current = productMap.get(key) || { name: item.name, category: product?.category || 'Other', qty: 0, revenue: 0, orders: 0 };
      current.qty += Number(item.qty || 0);
      current.revenue += Number(item.lineTotal ?? Number(item.unitPrice || 0) * Number(item.qty || 0));
      current.orders += 1;
      productMap.set(key, current);
    }));
    const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
    const periodSpend = customerSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const spend = range === 'all' ? Math.max(Number(customer.totalSpent || 0), periodSpend) : periodSpend;
    const visits = range === 'all' ? Math.max(Number(customer.visits || 0), allCustomerSales.length) : customerSales.length;
    const lastSale = [...allCustomerSales].sort((a, b) => `${b.date}T${b.time || ''}`.localeCompare(`${a.date}T${a.time || ''}`))[0];
    const daysSince = lastSale ? Math.max(0, Math.floor((Date.now() - new Date(`${lastSale.date}T12:00:00`).getTime()) / 86400000)) : null;
    const segment = !allCustomerSales.length ? 'New lead' : daysSince > 30 ? 'Follow up' : (visits >= 10 || spend >= 1000) ? 'Key account' : visits > 1 ? 'Repeat buyer' : 'Active';
    return { customer, customerSales, topProducts, spend, visits, lastSale, daysSince, segment };
  }), [customers, sales, periodSales, products, range]);

  const visibleLeads = leads.filter(lead => {
    const q = query.trim().toLowerCase();
    return !q || `${lead.customer.name} ${lead.customer.phone} ${lead.customer.email} ${lead.topProducts.map(p => `${p.name} ${p.category}`).join(' ')}`.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sort === 'recent') return (b.lastSale?.date || '').localeCompare(a.lastSale?.date || '');
    if (sort === 'frequency') return b.visits - a.visits || b.spend - a.spend;
    if (sort === 'name') return a.customer.name.localeCompare(b.customer.name);
    return b.spend - a.spend;
  });

  const popularMap = new Map();
  periodSales.filter(s => s.customerId && s.customerId !== 'c1').forEach(s => (s.items || []).forEach(item => {
    const current = popularMap.get(item.name) || { name: item.name, qty: 0, revenue: 0, customers: new Set() };
    current.qty += Number(item.qty || 0);
    current.revenue += Number(item.lineTotal || 0);
    current.customers.add(s.customerId);
    popularMap.set(item.name, current);
  }));
  const popular = [...popularMap.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 6);
  const maxPopular = Math.max(1, ...popular.map(p => p.qty));
  const followUps = leads.filter(l => l.segment === 'Follow up' || l.segment === 'New lead');
  const trackedValue = leads.reduce((sum, l) => sum + l.spend, 0);

  const exportLeads = () => downloadCsv(`customer-leads-${todayKey()}.csv`, [
    ['Customer', 'Phone', 'Segment', 'Most purchased item', 'Units', 'Other favourites', 'Visits', 'Spend (GH₵)', 'Last purchase'],
    ...visibleLeads.map(l => [l.customer.name, l.customer.phone, l.segment, l.topProducts[0]?.name || '', l.topProducts[0]?.qty || 0, l.topProducts.slice(1, 3).map(p => p.name).join('; '), l.visits, l.spend.toFixed(2), l.lastSale?.date || '']),
  ]);

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow"><TrendingUp size={12}/> CUSTOMER PURCHASE LEADS</div><h1>Know what every customer mostly buys</h1></div>
        <button className="btn" onClick={exportLeads} disabled={!visibleLeads.length}><Download size={15}/> Export leads</button>
      </div>

      <div className="grid metrics lead-metrics" style={{ marginBottom: '14px' }}>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><Users size={16}/></div></div><div className="metric-label">Customers with purchase leads</div><div className="metric-value">{leads.filter(l => l.topProducts.length).length}</div><div className="metric-note">{leads.length} named customers tracked</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon blue"><Repeat2 size={16}/></div></div><div className="metric-label">Repeat & key customers</div><div className="metric-value">{leads.filter(l => ['Repeat buyer', 'Key account'].includes(l.segment)).length}</div><div className="metric-note">Prioritise these for repeat offers</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon amber"><Clock3 size={16}/></div></div><div className="metric-label">Follow-up opportunities</div><div className="metric-value">{followUps.length}</div><div className="metric-note">New or inactive for over 30 days</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon violet"><Wallet size={16}/></div></div><div className="metric-label">{range === 'all' ? 'Tracked customer value' : `Spend in selected period`}</div><div className="metric-value">{format(trackedValue)}</div><div className="metric-note">Named customers only</div></div>
      </div>

      <div className="card" style={{ marginBottom: '12px' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={selectOnEnter} placeholder="Search customer or favourite product…"/></div>
          <select className="select-control" aria-label="Lead purchase period" value={range} onChange={e => setRange(e.target.value)}><option value="all">All purchase history</option><option value="90">Last 90 days</option><option value="30">Last 30 days</option></select>
          <select className="select-control" aria-label="Sort customer leads" value={sort} onChange={e => setSort(e.target.value)}><option value="value">Highest value</option><option value="recent">Most recent</option><option value="frequency">Most visits</option><option value="name">Customer name</option></select>
        </div>
      </div>

      <div className="leads-layout">
        <div className="card">
          <div className="section-head"><div><h2>Customer purchase preferences</h2><p className="sub">Ranked by quantity bought, with other favourites alongside</p></div><span className="chip"><Users size={13}/>{visibleLeads.length} leads</span></div>
          <div className="table-wrap"><table className="leads-table"><thead><tr><th>CUSTOMER</th><th>MOSTLY BUYS</th><th>ALSO BUYS</th><th>LAST PURCHASE</th><th>{range === 'all' ? 'VALUE / VISITS' : 'PERIOD VALUE'}</th><th></th></tr></thead><tbody>
            {visibleLeads.map(lead => <tr key={lead.customer.id}>
              <td><div className="lead-customer"><div className="avatar cashier">{initials(lead.customer.name)}</div><div><b>{lead.customer.name}</b><small>{lead.customer.phone || lead.customer.email || 'No contact details'}</small><span className={`lead-segment ${lead.segment.toLowerCase().replaceAll(' ', '-')}`}>{lead.segment}</span></div></div></td>
              <td>{lead.topProducts[0] ? <div className="favourite-product"><b>{lead.topProducts[0].name}</b><small>{lead.topProducts[0].qty} units · {lead.topProducts[0].orders} {lead.topProducts[0].orders === 1 ? 'order' : 'orders'}</small></div> : <span className="muted-copy">No purchase recorded</span>}</td>
              <td>{lead.topProducts.length > 1 ? <div className="also-buys">{lead.topProducts.slice(1, 3).map(p => <span key={p.name}>{p.name} <b>×{p.qty}</b></span>)}</div> : <span className="muted-copy">—</span>}</td>
              <td>{lead.lastSale ? <><b className="table-primary">{dayLabel(lead.lastSale.date)}</b><small className="table-secondary">{lead.daysSince === 0 ? 'Purchased today' : `${lead.daysSince} days ago`}</small></> : <span className="muted-copy">Not yet</span>}</td>
              <td><b className="table-primary">{format(lead.spend)}</b><small className="table-secondary">{lead.visits} {lead.visits === 1 ? 'visit' : 'visits'}</small></td>
              <td><button className="btn small primary" onClick={() => onStartSale(lead.customer)}><ShoppingCart size={12}/> New sale</button></td>
            </tr>)}
          </tbody>
          {visibleLeads.length > 0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'var(--muted)'}}>{visibleLeads.length} lead{visibleLeads.length === 1 ? '' : 's'} shown</small></td>
            <td style={{color:'var(--muted)'}}>—</td>
            <td style={{color:'var(--muted)'}}>—</td>
            <td style={{color:'var(--muted)'}}>—</td>
            <td><b>{format(visibleLeads.reduce((sum, lead) => sum + Number(lead.spend || 0), 0))}</b><small style={{display:'block',fontSize:'10px',color:'var(--muted)'}}>{visibleLeads.reduce((sum, lead) => sum + Number(lead.visits || 0), 0)} visits</small></td>
            <td></td>
          </tr></tfoot>}
          </table></div>
          {!visibleLeads.length && <div className="empty-state"><Users size={22}/><b>No matching customer leads</b><small>Add named customers at checkout or try another search.</small></div>}
        </div>

        <div className="leads-side">
          <div className="card">
            <div className="section-head"><div><h2>What customers mostly buy</h2><p className="sub">Named-customer demand in this period</p></div><ShoppingBag size={17} color="var(--muted)"/></div>
            {popular.length ? <div className="preference-list">{popular.map((p, index) => <div className="preference-item" key={p.name}><div className="preference-copy"><span><i>{index + 1}</i><b>{p.name}</b></span><small>{p.qty} units · {p.customers.size} {p.customers.size === 1 ? 'customer' : 'customers'}</small></div><div className="preference-track"><i style={{ width: `${p.qty / maxPopular * 100}%` }}/></div><strong>{format(p.revenue)}</strong></div>)}</div> : <div className="empty-state compact"><ShoppingBag size={18}/><b>No purchase pattern yet</b><small>Completed named-customer sales will appear here.</small></div>}
          </div>

          <div className="card followup-card">
            <div className="section-head"><div><h2>Follow-up queue</h2><p className="sub">New leads and customers gone quiet</p></div><Clock3 size={17} color="var(--amber)"/></div>
            {followUps.length ? followUps.slice(0, 5).map(lead => <div className="followup-row" key={lead.customer.id}><div><b>{lead.customer.name}</b><small>{lead.segment === 'New lead' ? 'No recorded purchase yet' : `${lead.daysSince} days since last purchase`}</small></div>{lead.customer.phone && <a className="btn icon small" href={`tel:${lead.customer.phone}`} title={`Call ${lead.customer.name}`}><Phone size={13}/></a>}<button className="btn small" onClick={() => onStartSale(lead.customer)}>Sell</button></div>) : <div className="empty-state compact"><CheckCircle2 size={18}/><b>Everyone is engaged</b><small>No inactive or new leads right now.</small></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

const maintenanceState = (record) => {
  if (record.status === 'completed') return { id: 'completed', label: 'Completed', className: 'ok' };
  if (record.dueDate < todayKey()) return { id: 'overdue', label: 'Overdue', className: 'bad' };
  if (record.dueDate === todayKey()) return { id: 'today', label: 'Due today', className: 'warn' };
  if (record.dueDate <= addDays(7)) return { id: 'soon', label: 'Due soon', className: 'info' };
  return { id: 'scheduled', label: 'Scheduled', className: 'neutral' };
};
const frequencyLabel = (days) => ({ 30: 'Monthly', 90: 'Every 3 months', 180: 'Every 6 months', 365: 'Yearly' }[Number(days)] || `Every ${days} days`);

export function MaintenancePage({ records, onSave, onComplete, onDelete }) {
  const [filter, setFilter] = useState('open');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [completing, setCompleting] = useState(null);

  const filtered = records.filter(record => {
    const state = maintenanceState(record).id;
    if (filter === 'open' && state === 'completed') return false;
    if (filter === 'attention' && !['overdue', 'today', 'soon'].includes(state)) return false;
    if (filter === 'completed' && state !== 'completed') return false;
    if (filter === 'scheduled' && state !== 'scheduled') return false;
    const q = query.trim().toLowerCase();
    return !q || `${record.asset} ${record.title} ${record.category} ${record.vendor} ${record.notes}`.toLowerCase().includes(q);
  }).sort((a, b) => {
    if (a.status === 'completed' && b.status === 'completed') return (b.completedDate || '').localeCompare(a.completedDate || '');
    return (a.dueDate || '').localeCompare(b.dueDate || '');
  });

  const overdue = records.filter(r => maintenanceState(r).id === 'overdue').length;
  const dueSoon = records.filter(r => ['today', 'soon'].includes(maintenanceState(r).id)).length;
  const open = records.filter(r => r.status !== 'completed').length;
  const month = todayKey().slice(0, 7);
  const monthSpend = records.filter(r => r.status === 'completed' && r.completedDate?.startsWith(month)).reduce((sum, r) => sum + Number(r.actualCost || 0), 0);
  const upcoming = records.filter(r => r.status !== 'completed' && r.dueDate >= todayKey()).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);

  const exportRecords = () => downloadCsv(`maintenance-${todayKey()}.csv`, [
    ['Asset', 'Task', 'Category', 'Due date', 'Frequency (days)', 'Vendor', 'Estimated cost', 'Actual cost', 'Status', 'Completed date', 'Notes'],
    ...filtered.map(r => [r.asset, r.title, r.category, r.dueDate, r.frequency, r.vendor, r.cost, r.actualCost || '', maintenanceState(r).label, r.completedDate || '', r.notes]),
  ]);

  return (
    <div>
      <div className="page-head">
        <div><div className="eyebrow"><Wrench size={12}/> MAINTENANCE</div><h1>Equipment care before it becomes downtime</h1></div>
        <div className="dashboard-actions"><button className="btn" onClick={exportRecords} disabled={!filtered.length}><Download size={15}/> Export</button><button className="btn primary" onClick={() => setModal({ record: null })}><Plus size={15}/> Schedule maintenance</button></div>
      </div>

      <div className="grid metrics lead-metrics" style={{ marginBottom: '14px' }}>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon blue"><Wrench size={16}/></div></div><div className="metric-label">Open maintenance tasks</div><div className="metric-value">{open}</div><div className="metric-note">{records.filter(r => r.status === 'completed').length} completed services in history</div></div>
        <div className="card metric-card"><div className="metric-top"><div className={`metric-icon ${overdue ? 'amber' : 'green'}`}><AlertTriangle size={16}/></div></div><div className="metric-label">Overdue</div><div className="metric-value" style={overdue ? { color: 'var(--red)' } : undefined}>{overdue}</div><div className="metric-note">{overdue ? 'Complete or reschedule these tasks' : 'No overdue equipment service'}</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon amber"><CalendarDays size={16}/></div></div><div className="metric-label">Due in the next 7 days</div><div className="metric-value">{dueSoon}</div><div className="metric-note">Includes work due today</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon violet"><Coins size={16}/></div></div><div className="metric-label">Maintenance spend this month</div><div className="metric-value">{format(monthSpend)}</div><div className="metric-note">Actual completed-service costs</div></div>
      </div>

      {overdue > 0 && <div className="maintenance-alert"><AlertTriangle size={18}/><div><b>{overdue} {overdue === 1 ? 'task is' : 'tasks are'} overdue</b><span>Review the affected equipment and complete the service or update its due date.</span></div><button className="btn small" onClick={() => setFilter('attention')}>Show attention list <ArrowRight size={13}/></button></div>}

      <div className="maintenance-layout">
        <div className="card">
          <div className="toolbar">
            <div className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={selectOnEnter} placeholder="Search asset, task or service vendor…"/></div>
            <div className="chips">{[['open', 'Open'], ['attention', 'Needs attention'], ['scheduled', 'Later'], ['completed', 'Completed'], ['all', 'All']].map(([id, label]) => <button key={id} className={`chip-btn ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>{label}</button>)}</div>
          </div>
          <div className="table-wrap"><table><thead><tr><th>DUE / COMPLETED</th><th>ASSET & TASK</th><th>SERVICE DETAILS</th><th>FREQUENCY</th><th>COST</th><th>STATUS</th><th></th></tr></thead><tbody>
            {filtered.map(record => {
              const state = maintenanceState(record);
              return <tr key={record.id}>
                <td><b className="table-primary">{record.status === 'completed' ? dayLabel(record.completedDate) : dayLabel(record.dueDate)}</b><small className="table-secondary">{record.status === 'completed' ? 'Service date' : record.dueDate < todayKey() ? `${Math.floor((new Date(`${todayKey()}T12:00:00`) - new Date(`${record.dueDate}T12:00:00`)) / 86400000)} days late` : 'Scheduled date'}</small></td>
                <td><b className="table-primary">{record.asset}</b><small className="table-secondary wrap-cell">{record.title}</small></td>
                <td><span className="maintenance-category">{record.category}</span><small className="table-secondary">{record.vendor || 'In-house'}</small></td>
                <td>{frequencyLabel(record.frequency)}</td>
                <td><b className="table-primary">{record.status === 'completed' ? format(record.actualCost || 0) : format(record.cost || 0)}</b><small className="table-secondary">{record.status === 'completed' ? 'Actual' : 'Estimated'}</small></td>
                <td><span className={`status ${state.className}`}><i/>{state.label}</span></td>
                <td><div className="row-actions">{record.status !== 'completed' && <button className="btn small primary" onClick={() => setCompleting(record)}><Check size={12}/> Complete</button>}<button className="btn icon small" title="Edit maintenance" onClick={() => setModal({ record })}><Edit2 size={13}/></button><button className="btn icon small danger" title="Delete maintenance record" onClick={() => { if (confirm(`Delete the maintenance record for ${record.asset}?`)) onDelete(record.id); }}><Trash2 size={13}/></button></div></td>
              </tr>;
            })}
          </tbody>
          {filtered.length > 0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'var(--muted)'}}>{filtered.length} record{filtered.length === 1 ? '' : 's'}</small></td>
            <td style={{color:'var(--muted)'}}>—</td>
            <td style={{color:'var(--muted)',fontSize:'10px'}}>{filtered.filter(r => r.status === 'completed').length} completed</td>
            <td style={{color:'var(--muted)'}}>—</td>
            <td><b>{format(filtered.reduce((sum, r) => sum + Number((r.status === 'completed' ? r.actualCost : r.cost) || 0), 0))}</b><small style={{display:'block',fontSize:'10px',color:'var(--muted)'}}>{format(filtered.reduce((sum, r) => sum + Number(r.cost || 0), 0))} estimated</small></td>
            <td style={{fontSize:'10px',color:'var(--muted)'}}>{filtered.filter(r => maintenanceState(r).label === 'Overdue').length} overdue</td>
            <td></td>
          </tr></tfoot>}
          </table></div>
          {!filtered.length && <div className="empty-state"><Wrench size={22}/><b>No maintenance records in this view</b><small>Change the filter or schedule a new equipment service.</small></div>}
        </div>

        <div className="card maintenance-schedule">
          <div className="section-head"><div><h2>Coming up</h2><p className="sub">Your next scheduled services</p></div><CalendarDays size={17} color="var(--muted)"/></div>
          {upcoming.length ? <div className="schedule-list">{upcoming.map(record => <button key={record.id} onClick={() => setModal({ record })}><span className="schedule-date"><b>{new Date(`${record.dueDate}T12:00:00`).toLocaleDateString('en-GH', { day: '2-digit' })}</b><small>{new Date(`${record.dueDate}T12:00:00`).toLocaleDateString('en-GH', { month: 'short' })}</small></span><span><b>{record.asset}</b><small>{record.title}</small></span><ArrowRight size={14}/></button>)}</div> : <div className="empty-state compact"><CheckCircle2 size={18}/><b>Nothing scheduled</b><small>Add a service to build your maintenance plan.</small></div>}
          <div className="maintenance-tip"><ShieldCheck size={15}/><span>Completing a task can automatically schedule its next service and log the actual cost under Maintenance expenses.</span></div>
        </div>
      </div>

      {modal && <MaintenanceModal record={modal.record} onClose={() => setModal(null)} onSave={record => { onSave(record); setModal(null); }}/>} 
      {completing && <CompleteMaintenanceModal record={completing} onClose={() => setCompleting(null)} onComplete={completion => { onComplete(completing, completion); setCompleting(null); }}/>} 
    </div>
  );
}

function MaintenanceModal({ record, onClose, onSave }) {
  const [form, setForm] = useState(record ? { ...record } : {
    title: '', asset: '', category: 'Facilities', dueDate: addDays(7), frequency: 90,
    vendor: '', cost: '', status: 'scheduled', notes: '',
  });
  const [error, setError] = useState('');
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const submit = e => {
    e.preventDefault();
    if (!form.asset.trim() || !form.title.trim() || !form.dueDate) { setError('Asset, service task and due date are required.'); return; }
    if (Number(form.cost || 0) < 0) { setError('Estimated cost cannot be negative.'); return; }
    onSave({
      ...form, id: record?.id || uid('mnt'), asset: form.asset.trim(), title: form.title.trim(),
      vendor: form.vendor.trim(), notes: form.notes.trim(), frequency: Number(form.frequency),
      cost: Number(form.cost || 0), status: record?.status || 'scheduled',
    });
  };
  return <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal wide">
    <div className="modal-head"><div className="modal-symbol amber"><Wrench size={18}/></div><div><h3>{record ? 'Edit maintenance plan' : 'Schedule maintenance'}</h3><p>Set the equipment, service task, due date and recurring interval.</p></div><button className="btn icon small modal-close" onClick={onClose}><X size={14}/></button></div>
    <form onSubmit={submit}><div className="modal-body">
      <div className="field"><label>Equipment or asset *</label><input autoFocus value={form.asset} onChange={e => update('asset', e.target.value)} placeholder="e.g. Pharmaceutical refrigerator" required/></div>
      <div className="field"><label>Service task *</label><input value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Thermostat calibration and seal check" required/></div>
      <div className="two"><div className="field"><label>Category</label><select value={form.category} onChange={e => update('category', e.target.value)}><option>Refrigeration</option><option>POS equipment</option><option>Power</option><option>Facilities</option><option>Security</option><option>Other</option></select></div><div className="field"><label>Service vendor</label><input value={form.vendor} onChange={e => update('vendor', e.target.value)} placeholder="Vendor name or In-house"/></div></div>
      <div className="two"><div className="field"><label>Next due date *</label><input type="date" value={form.dueDate} onChange={e => update('dueDate', e.target.value)} required/></div><div className="field"><label>Repeat frequency</label><select value={form.frequency} onChange={e => update('frequency', e.target.value)}><option value="30">Monthly</option><option value="90">Every 3 months</option><option value="180">Every 6 months</option><option value="365">Yearly</option></select></div></div>
      <div className="field"><label>Estimated cost (GH₵)</label><input type="number" min="0" step="0.01" value={form.cost} onChange={e => update('cost', e.target.value)} placeholder="0.00"/></div>
      <div className="field"><label>Service notes / checklist</label><textarea rows="3" value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="What should the technician check?"/></div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary"><Check size={14}/>{record ? 'Save maintenance' : 'Schedule maintenance'}</button></div></form>
  </div></div>;
}

function CompleteMaintenanceModal({ record, onClose, onComplete }) {
  const [completedDate, setCompletedDate] = useState(todayKey());
  const [actualCost, setActualCost] = useState(String(record.cost || 0));
  const [notes, setNotes] = useState('');
  const [logExpense, setLogExpense] = useState(Number(record.cost || 0) > 0);
  const [scheduleNext, setScheduleNext] = useState(true);
  const nextDate = addDaysTo(completedDate || todayKey(), record.frequency);
  const submit = e => {
    e.preventDefault();
    if (!completedDate || Number(actualCost || 0) < 0) return;
    onComplete({ completedDate, actualCost: Number(actualCost || 0), notes: notes.trim(), logExpense, scheduleNext, nextDue: nextDate });
  };
  return <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal">
    <div className="modal-head"><div className="modal-symbol green"><CheckCircle2 size={18}/></div><div><h3>Complete maintenance</h3><p>{record.asset} · {record.title}</p></div><button className="btn icon small modal-close" onClick={onClose}><X size={14}/></button></div>
    <form onSubmit={submit}><div className="modal-body">
      <div className="two"><div className="field"><label>Service date *</label><input type="date" value={completedDate} max={todayKey()} onChange={e => setCompletedDate(e.target.value)} required/></div><div className="field"><label>Actual cost (GH₵)</label><input type="number" min="0" step="0.01" value={actualCost} onChange={e => setActualCost(e.target.value)}/></div></div>
      <div className="field"><label>Completion notes</label><textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Work completed, parts replaced or follow-up needed…"/></div>
      <label className="check-row"><input type="checkbox" checked={logExpense} onChange={e => setLogExpense(e.target.checked)} disabled={Number(actualCost || 0) <= 0}/><span><b>Add cost to business expenses</b><small>Create one Maintenance expense for {format(actualCost)}.</small></span></label>
      <label className="check-row"><input type="checkbox" checked={scheduleNext} onChange={e => setScheduleNext(e.target.checked)}/><span><b>Schedule the next recurring service</b><small>Next due date: {readableDate(nextDate)} ({frequencyLabel(record.frequency).toLowerCase()}).</small></span></label>
    </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary"><CheckCircle2 size={14}/> Mark completed</button></div></form>
  </div></div>;
}

export function SettingsPage({ settings, onSave, onExportBackup, onChangePassword, counts, offlineStatus }) {
  const [tab, setTab] = useState('store');
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS, ...settings });
  const [error, setError] = useState('');
  useEffect(() => setForm({ ...DEFAULT_SETTINGS, ...settings }), [settings]);
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const submit = e => {
    e.preventDefault();
    if (!form.shopName.trim() || !form.address.trim()) { setError('Shop name and address are required.'); setTab('store'); return; }
    if (!/^[A-Za-z0-9-]{2,10}$/.test(form.invoicePrefix)) { setError('Invoice prefix must be 2–10 letters, numbers or dashes.'); setTab('receipts'); return; }
    if (Number(form.discountPercent) < 0 || Number(form.discountPercent) > 100) { setError('Discount must be between 0 and 100%.'); setTab('receipts'); return; }
    setError('');
    onSave({
      ...form, shopName: form.shopName.trim(), address: form.address.trim(), phone: form.phone.trim(), email: form.email.trim(),
      invoicePrefix: form.invoicePrefix.trim().toUpperCase(), discountPercent: Number(form.discountPercent),
      defaultLowStock: Math.max(0, Math.floor(Number(form.defaultLowStock || 0))), receiptFooter: form.receiptFooter.trim(),
    });
  };
  const tabs = [
    { id: 'store', label: 'Store profile', icon: Store, note: 'Name and contact details' },
    { id: 'receipts', label: 'Sales & receipts', icon: Receipt, note: 'Checkout and invoice defaults' },
    { id: 'data', label: 'Data & security', icon: ShieldCheck, note: 'Backup, access and storage' },
  ];
  return <form onSubmit={submit}>
    <div className="page-head">
      <div><div className="eyebrow"><SettingsIcon size={12}/> SETTINGS</div><h1>Make POSI work your way</h1><p>Manage your store identity, checkout defaults, invoice numbering and local shop data. Changes are saved on this device.</p></div>
      <button className="btn primary"><Check size={15}/> Save settings</button>
    </div>
    {error && <div className="settings-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
    <div className="settings-layout">
      <aside className="card settings-nav" aria-label="Settings sections">
        {tabs.map(item => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setError(''); }}><item.icon size={17}/><span><b>{item.label}</b><small>{item.note}</small></span><ArrowRight size={13}/></button>)}
        <div className="settings-local"><Database size={15}/><span><b>Local-first workspace</b><small>Your records stay in this browser.</small></span></div>
      </aside>

      <div className="settings-content">
        {tab === 'store' && <div className="card settings-panel">
          <div className="settings-panel-head"><span className="modal-symbol green"><Store size={19}/></span><div><h2>Store profile</h2><p className="sub">Used in the workspace, invoices and customer receipts.</p></div></div>
          <div className="settings-form-grid">
            <div className="field full"><label>Store name *</label><div className="input-with-icon"><Store size={15}/><input value={form.shopName} onChange={e => update('shopName', e.target.value)} required/></div></div>
            <div className="field"><label>Phone number</label><div className="input-with-icon"><Phone size={15}/><input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="030…"/></div></div>
            <div className="field"><label>Email address</label><div className="input-with-icon"><Mail size={15}/><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="shop@example.com"/></div></div>
            <div className="field full"><label>Physical address *</label><div className="input-with-icon"><MapPin size={15}/><input value={form.address} onChange={e => update('address', e.target.value)} required/></div></div>
          </div>
          <div className="settings-note"><ShieldCheck size={15}/><span>Updating this profile also updates new invoices and receipts. Existing sale records and totals are not changed.</span></div>
        </div>}

        {tab === 'receipts' && <div className="settings-panel-stack">
          <div className="card settings-panel">
            <div className="settings-panel-head"><span className="modal-symbol blue"><Receipt size={19}/></span><div><h2>Sales & receipt defaults</h2><p className="sub">These defaults apply to new sales and newly added products.</p></div></div>
            <div className="settings-form-grid three">
              <div className="field"><label>Invoice prefix</label><input value={form.invoicePrefix} maxLength="10" onChange={e => update('invoicePrefix', e.target.value.toUpperCase())}/><small>Example: {form.invoicePrefix || 'INV'}-123456</small></div>
              <div className="field"><label>Optional discount (%)</label><input type="number" min="0" max="100" step="0.5" value={form.discountPercent} onChange={e => update('discountPercent', e.target.value)}/><small>Used when the POS discount is enabled.</small></div>
              <div className="field"><label>Default reorder level</label><input type="number" min="0" step="1" value={form.defaultLowStock} onChange={e => update('defaultLowStock', e.target.value)}/><small>Starting alert level for new items.</small></div>
              <div className="field full"><label>Receipt footer</label><textarea rows="3" value={form.receiptFooter} onChange={e => update('receiptFooter', e.target.value)} placeholder="Thank your customer or add a return note…"/></div>
            </div>
          </div>
          <div className="card settings-panel receipt-settings-preview">
            <div className="settings-panel-head"><span className="modal-symbol violet"><FileText size={19}/></span><div><h2>Live receipt preview</h2><p className="sub">A quick check of your store details and footer.</p></div></div>
            <div className="mini-receipt"><div className="mini-receipt-brand"><span className="brand-mark">P</span><div><b>{form.shopName || 'Your store'}</b><small>{form.address || 'Store address'}</small><small>{form.phone || 'Store phone'}</small></div></div><h3>PAYMENT RECEIPT</h3><span className="mini-receipt-number">{form.invoicePrefix || 'INV'}-123456</span><div><span>Paracetamol 500mg × 1</span><b>{format(12.5)}</b></div><div><span>Optional discount ({Number(form.discountPercent || 0)}%)</span><b>−{format(12.5 * Number(form.discountPercent || 0) / 100)}</b></div><div className="mini-receipt-total"><span>Total amount</span><b>{format(12.5 * (1 - Number(form.discountPercent || 0) / 100))}</b></div><p>{form.receiptFooter || 'Your receipt footer appears here.'}</p></div>
          </div>
        </div>}

        {tab === 'data' && <div className="settings-panel-stack">
          <div className="card settings-panel">
            <div className="settings-panel-head"><span className="modal-symbol green"><HardDriveDownload size={19}/></span><div><h2>Shop data backup</h2><p className="sub">Download a complete JSON snapshot of records stored in this browser.</p></div></div>
            <div className="data-summary">{Object.entries(counts).map(([label, count]) => <div key={label}><b>{count}</b><small>{label}</small></div>)}</div>
            <div className="settings-action-row"><div><b>Export all shop data</b><small>Includes products, sales, customers, staff, expenses, attendance, maintenance and settings.</small></div><button type="button" className="btn primary" onClick={onExportBackup}><Download size={14}/> Export JSON</button></div>
            <div className="settings-note warning"><AlertTriangle size={15}/><span>Keep the export somewhere safe. Browser data is device-specific; clearing site data can permanently remove records that have not been exported.</span></div>
          </div>
          <div className="card settings-panel">
            <div className="settings-panel-head"><span className="modal-symbol blue"><KeyRound size={19}/></span><div><h2>Account & offline status</h2><p className="sub">Manage your own sign-in and check this device's storage mode.</p></div></div>
            <div className="settings-action-row"><div><b>Your password</b><small>Change your own password. Your current password is required.</small></div><button type="button" className="btn" onClick={onChangePassword}><KeyRound size={14}/> Change password</button></div>
            <div className="settings-action-row"><div><b>Offline application files</b><small>{offlineStatus === 'ready' ? 'Saved on this device and ready to open without internet.' : offlineStatus === 'installing' ? 'Preparing app files for offline use.' : 'Offline app files are not active in this session. Shop records remain stored locally.'}</small></div><span className={`status ${offlineStatus === 'ready' ? 'ok' : 'neutral'}`}><i/>{offlineStatus === 'ready' ? 'Offline ready' : offlineStatus === 'installing' ? 'Preparing' : 'Local data only'}</span></div>
          </div>
        </div>}
      </div>
    </div>
  </form>;
}
