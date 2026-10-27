import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Bot, UserRound, Trash2, WifiOff, ShieldCheck } from 'lucide-react';

/* ------------------------------------------------------------------------- *
 * POSI on-device assistant
 *
 * This is a deliberately offline "AI" layer: every answer is computed from the
 * shop records already saved in this browser (sales, products, customers,
 * expenses, stock movements, maintenance, attendance). Nothing is uploaded and
 * no network request is made, so it keeps working with the internet switched
 * off — which matters because POSI is a local-first, offline-capable POS.
 * ------------------------------------------------------------------------- */

/* ---------- small local helpers (self-contained, no imports from main.jsx) ---------- */
const pad = (n)=>String(n).padStart(2,'0');
const money = (n)=>{
  const v = Number(n||0);
  const value = Math.abs(v).toLocaleString('en-GH',{ minimumFractionDigits:2, maximumFractionDigits:2 });
  return `${v<0?'-':''}GH₵ ${value}`;
};
const num = (n)=>Number(n||0);
const localKey = (d)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayKey = ()=>localKey(new Date());
const shiftKey = (key, days)=>{ const d=new Date(`${key}T12:00:00`); d.setDate(d.getDate()+days); return localKey(d) };
const monthStartKey = (key=todayKey())=>`${key.slice(0,7)}-01`;
const monthLabel = (key)=> new Date(`${key.slice(0,7)}-01T12:00:00`).toLocaleDateString('en-GH',{month:'long',year:'numeric'});
const prevMonthRange = (key=todayKey())=>{
  const d = new Date(`${key.slice(0,7)}-01T12:00:00`);
  d.setDate(0);
  const to = localKey(d);
  d.setDate(1);
  return { from:localKey(d), to };
};
const readable = (key)=> key && String(key).length>=10 ? new Date(`${String(key).slice(0,10)}T12:00:00`).toLocaleDateString('en-GH',{day:'numeric',month:'short',year:'numeric'}) : (key||'—');
const pctText = (n)=> `${Number(n||0).toFixed(0)}%`;
const partOfDay = ()=>{ const h=new Date().getHours(); return h<12?'morning':h<17?'afternoon':'evening' };

const saleUnits = (s)=> (s?.items||[]).reduce((a,it)=>a+num(it.qty),0);
const itemCostOf = (it, products)=>{
  const stored = it?.cost ?? it?.unitCost;
  if(stored!==undefined && stored!==null && stored!=='') return num(stored);
  const p = (products||[]).find(x=>x.id===it?.productId);
  return num(p?.cost);
};
const saleCost = (s, products)=> (s?.items||[]).reduce((a,it)=>a+itemCostOf(it,products)*num(it.qty),0);
const saleProfit = (s, products)=> (s?.items||[]).reduce((a,it)=>a+(num(it.unitPrice)-itemCostOf(it,products))*num(it.qty),0);
const reorderOf = (p)=> num(p?.lowStockAt ?? 5);
const daysToExpiry = (p)=>{
  if(!p?.expiry) return null;
  const d = new Date(`${p.expiry}T12:00:00`);
  if(Number.isNaN(d.getTime())) return null;
  return Math.round((d - new Date(`${todayKey()}T12:00:00`))/86400000);
};
const salesBetween = (sales, from, to)=> (sales||[]).filter(s=>s.date>=from && s.date<=to);
const sumBy = (list, fn)=> list.reduce((a,x)=>a+num(fn(x)),0);

function summarizeSales(list, products){
  const revenue = sumBy(list, s=>s.total);
  const cost = list.reduce((a,s)=>a+saleCost(s,products), 0);
  const units = list.reduce((a,s)=>a+saleUnits(s), 0);
  const days = new Set(list.map(s=>s.date)).size;
  const count = list.length;
  return {
    count, revenue, cost, units, days,
    profit: revenue - cost,
    avg: count ? revenue/count : 0,
    margin: revenue ? (revenue-cost)/revenue*100 : 0,
    perDay: days ? revenue/days : 0,
  };
}

/* ---------- periods ---------- */
function resolvePeriod(q, fallback='today'){
  const t = todayKey();
  if(/\b(today|so far today|right now)\b/.test(q)) return { id:'today', label:'today', from:t, to:t };
  if(/\byesterday\b/.test(q)){ const y=shiftKey(t,-1); return { id:'yesterday', label:'yesterday', from:y, to:y } }
  if(/\b(last|previous|past)\s+month\b/.test(q)){ const p=prevMonthRange(t); return { id:'lastmonth', label:monthLabel(p.from), from:p.from, to:p.to } }
  if(/\b(this|current)\s+month\b|\bmonth\b|\bmonthly\b|\bmtd\b/.test(q)) return { id:'month', label:'this month', from:monthStartKey(t), to:t };
  if(/\b(last|previous|past)\s+week\b|\blast 7 days\b/.test(q)) return { id:'lastweek', label:'the previous 7 days', from:shiftKey(t,-13), to:shiftKey(t,-7) };
  if(/\b(this\s+)?week\b|\b7 days\b|\bseven days\b/.test(q)) return { id:'week', label:'the last 7 days', from:shiftKey(t,-6), to:t };
  if(/\b(this\s+)?year\b|\bytd\b|\bannual\b/.test(q)) return { id:'year', label:'this year', from:`${t.slice(0,4)}-01-01`, to:t };
  if(/\b(all time|all dates|ever|overall|everything)\b/.test(q)) return { id:'all', label:'all recorded time', from:'0000-01-01', to:t };
  if(fallback==='month') return { id:'month', label:'this month', from:monthStartKey(t), to:t };
  if(fallback==='week') return { id:'week', label:'the last 7 days', from:shiftKey(t,-6), to:t };
  if(fallback==='all') return { id:'all', label:'all recorded time', from:'0000-01-01', to:t };
  return { id:'today', label:'today', from:t, to:t };
}
function previousPeriod(p){
  if(!p) return null;
  if(p.id==='today'){ const y=shiftKey(p.from,-1); return { id:'yesterday', label:'yesterday', from:y, to:y } }
  if(p.id==='week') return { id:'prevweek', label:'the previous 7 days', from:shiftKey(p.from,-7), to:shiftKey(p.from,-1) };
  if(p.id==='lastweek') return { id:'prevlastweek', label:'the 7 days before that', from:shiftKey(p.from,-7), to:shiftKey(p.from,-1) };
  if(p.id==='month'){ const prev=prevMonthRange(p.from); return { id:'lastmonth', label:monthLabel(prev.from), from:prev.from, to:prev.to } }
  if(p.id==='lastmonth'){ const prev=prevMonthRange(p.from); return { id:'prevprevmonth', label:monthLabel(prev.from), from:prev.from, to:prev.to } }
  if(p.id==='year'){ const y=Number(p.to.slice(0,4))-1; return { id:'lastyear', label:String(y), from:`${y}-01-01`, to:`${y}-12-31` } }
  return null;
}

/* ---------- entity matching ---------- */
function findProduct(q, products){
  const words = q.replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>3);
  let best=null, bestScore=0;
  (products||[]).forEach(p=>{
    const name = String(p.name||'').toLowerCase();
    if(!name) return;
    let score = 0;
    if(q.includes(name)) score += 12;
    name.split(/\s+/).filter(t=>t.length>3).forEach(t=>{ if(words.includes(t)) score += 4 });
    if(p.sku && q.includes(String(p.sku).toLowerCase())) score += 6;
    if(p.barcode && q.includes(String(p.barcode))) score += 6;
    if(score>bestScore){ bestScore=score; best=p }
  });
  return bestScore>=4 ? best : null;
}
function findEmployee(q, employees){
  let best=null, bestScore=0;
  (employees||[]).forEach(e=>{
    const name=String(e.name||'').toLowerCase();
    if(!name) return;
    const first = name.split(/\s+/)[0];
    let score=0;
    if(q.includes(name)) score += 12;
    else if(first.length>2 && q.includes(first)) score += 7;
    if(e.username && q.includes(String(e.username).toLowerCase())) score += 5;
    if(score>bestScore){ bestScore=score; best=e }
  });
  return bestScore>=7 ? best : null;
}
function findCustomer(q, customers){
  let best=null, bestScore=0;
  (customers||[]).forEach(c=>{
    if(c.isWalkIn) return;
    const name=String(c.name||'').toLowerCase();
    if(!name) return;
    const first = name.split(/\s+/)[0];
    let score=0;
    if(q.includes(name)) score += 12;
    else if(first.length>2 && q.includes(first)) score += 6;
    if(c.phone && q.includes(String(c.phone))) score += 8;
    if(score>bestScore){ bestScore=score; best=c }
  });
  return bestScore>=6 ? best : null;
}

/* ---------- answer helpers ---------- */
const stat = (label, value, tone)=> ({ label, value, tone });
const delta = (cur, prev, isMoney=true)=>{
  if(prev===undefined || prev===null) return null;
  if(!prev) return cur ? (isMoney ? `up from ${money(0)}` : `up from 0`) : 'no change';
  const change = (cur-prev)/Math.abs(prev)*100;
  const word = change>0 ? 'up' : change<0 ? 'down' : 'flat';
  return `${word} ${Math.abs(change).toFixed(0)}% on ${isMoney?money(prev):prev}`;
};
const topEntries = (map, limit=5)=> [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit);

const SELL_WORDS = ['sold','sell','selling','sales','sale','revenue','performance','cashier','staff','employee','target','commission','who','average basket','basket'];
const SPEND_WORDS = ['spent','spend','spending','buy','buying','bought','purchase','purchases','customer','client','owes','owe','debt','balance','credit'];
const hasAny = (q, list)=> list.some(w=>q.includes(w));

/* ------------------------------------------------------------------------- *
 * Answer builders — each one returns {title, summary, stats, table, bullets, note, suggestions}
 * ------------------------------------------------------------------------- */
function briefing(ctx, greeting=true){
  const { sales, products, customers, expenses, giftCards, currentUser } = ctx;
  const today = resolvePeriod('today');
  const week = resolvePeriod('week');
  const t = summarizeSales(salesBetween(sales, today.from, today.to), products);
  const w = summarizeSales(salesBetween(sales, week.from, week.to), products);
  const low = products.filter(p=>num(p.stock)<=reorderOf(p) && num(p.stock)>0);
  const out = products.filter(p=>num(p.stock)<=0);
  const expired = products.filter(p=>{ const d=daysToExpiry(p); return d!==null && d<0 });
  const soon = products.filter(p=>{ const d=daysToExpiry(p); return d!==null && d>=0 && d<=90 });
  const owedList = customers.filter(c=>!c.isWalkIn && num(c.balance)>0);
  const owed = sumBy(owedList, c=>c.balance);
  const monthExpenses = sumBy(expenses.filter(e=>e.date>=monthStartKey() && e.date<=todayKey()), e=>e.amount);
  const activeGift = giftCards.filter(g=>g.status==='active');
  const giftValue = sumBy(activeGift, g=>g.balance);
  const name = (currentUser?.name||'there').split(' ')[0];
  const lines = [];
  lines.push(`Good ${partOfDay()}, ${name}. Here is where the shop stands right now.`);
  if(t.count) lines.push(`Today: ${t.count} sale${t.count===1?'':'s'} worth ${money(t.revenue)} with ${money(t.profit)} profit (${pctText(t.margin)} margin).`);
  else lines.push(`No sales recorded yet today — the last 7 days brought in ${money(w.revenue)}.`);
  if(w.count) lines.push(`The last 7 days: ${money(w.revenue)} from ${w.count} sales, ${money(w.profit)} profit.`);
  if(owedList.length) lines.push(`${owedList.length} customer${owedList.length===1?'':'s'} owe${owedList.length===1?'s':''} you ${money(owed)} altogether.`);
  return {
    title: 'Shop briefing',
    summary: lines.join(' '),
    stats: [
      stat('Sales today', money(t.revenue), 'good'),
      stat('Profit today', money(t.profit)),
      stat('Sales · 7 days', money(w.revenue)),
      stat('Expenses · month', money(monthExpenses), 'warn'),
      stat('Owed to you', money(owed), owed>0?'warn':'muted'),
      stat('Stock alerts', `${low.length+out.length} item${low.length+out.length===1?'':'s'}`, (low.length+out.length)?'bad':'good'),
      stat('Expired / expiring', `${expired.length} / ${soon.length}`, expired.length?'bad':'muted'),
      stat('Gift card balance', money(giftValue), 'muted'),
    ],
    bullets: [
      out.length ? `${out.length} item${out.length===1?' is':''} out of stock: ${out.slice(0,3).map(p=>p.name).join(', ')}${out.length>3?'…':''}` : null,
      low.length ? `${low.length} item${low.length===1?' is':'s'} running low: ${low.slice(0,3).map(p=>p.name).join(', ')}${low.length>3?'…':''}` : null,
      expired.length ? `${expired.length} expired item${expired.length===1?'':'s'} still in the item list — pull them from the shelf.` : null,
      soon.length ? `${soon.length} item${soon.length===1?'':'s'} expire within 90 days and need attention.` : null,
    ].filter(Boolean),
    note: greeting ? 'I read only the records saved on this device. Nothing leaves the shop.' : null,
    suggestions: [
      'How are sales this week?',
      'What should I restock?',
      'Show my profit this month',
      'Which products are not selling?',
    ],
  };
}

function salesAnswer(ctx, p, q){
  const { sales, products } = ctx;
  const list = salesBetween(sales, p.from, p.to);
  const t = summarizeSales(list, products);
  if(!t.count){
    const prev = previousPeriod(p);
    const prevT = prev ? summarizeSales(salesBetween(sales, prev.from, prev.to), products) : null;
    return {
      title: `Sales · ${p.label}`,
      summary: `No sales were recorded ${p.label}${prevT && prevT.count ? ` — ${prev.label} had ${prevT.count} sales worth ${money(prevT.revenue)}.` : '.'}`,
      stats: [stat('Sales', '0'), stat('Revenue', money(0)), stat('Units sold', '0')],
      note: 'Tips: check the date filter on Sales history, or ask me about a wider period such as “this week” or “this month”.',
      suggestions: ['How were sales this week?', 'What should I restock?', 'Show today’s shop briefing'],
    };
  }
  const prev = previousPeriod(p);
  const prevT = prev ? summarizeSales(salesBetween(sales, prev.from, prev.to), products) : null;
  const byPayment = new Map();
  list.forEach(s=> byPayment.set(s.payment||'Cash', num(byPayment.get(s.payment||'Cash'))+num(s.total)));
  const bySeller = new Map();
  list.forEach(s=>{ const k=s.cashier||'Unknown'; bySeller.set(k, num(bySeller.get(k))+num(s.total)) });
  const byDay = new Map();
  list.forEach(s=> byDay.set(s.date, num(byDay.get(s.date))+num(s.total)));
  const bestDay = [...byDay.entries()].sort((a,b)=>b[1]-a[1])[0];
  const lines = [];
  lines.push(`${cap(inP(p.label))} you recorded ${t.count} sale${t.count===1?'':'s'} worth ${money(t.revenue)} — ${t.units} item${t.units===1?'':'s'} sold, ${money(t.profit)} profit${t.revenue?` (${pctText(t.margin)} margin)`:''}.`);
  lines.push(`Average sale ${money(t.avg)}${t.days>1?`, about ${money(t.perDay)} a day`:''}.`);
  if(prevT && prevT.count){
    const change = prevT.revenue ? ((t.revenue-prevT.revenue)/prevT.revenue*100) : 0;
    lines.push(`Revenue is ${change>=0?'up':'down'} ${Math.abs(change).toFixed(0)}% on ${prev.label} (${money(prevT.revenue)}).`);
  }
  lines.push(`Payment split: ${[...byPayment.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${money(v)}`).join(' · ')}.`);
  if(bestDay && byDay.size>1) lines.push(`Best day: ${readable(bestDay[0])} with ${money(bestDay[1])}.`);
  const sellers = [...bySeller.entries()].sort((a,b)=>b[1]-a[1]);
  return {
    title: `Sales · ${p.label}`,
    summary: lines.join(' '),
    stats: [
      stat('Revenue', money(t.revenue), 'good'),
      stat('Sales', String(t.count)),
      stat('Units sold', String(t.units)),
      stat('Profit', money(t.profit)),
      stat('Margin', pctText(t.margin)),
      stat('Average sale', money(t.avg)),
    ],
    table: sellers.length>1 ? {
      columns: ['Seller','Sales','Revenue'],
      rows: sellers.map(([name,rev])=>[name, String(list.filter(s=>(s.cashier||'Unknown')===name).length), money(rev)]),
    } : null,
    bullets: [
      `Payments: ${[...byPayment.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${money(v)}`).join(' · ')}`,
      bestDay && byDay.size>1 ? `Best day: ${readable(bestDay[0])} · ${money(bestDay[1])}` : null,
      prevT && prevT.count ? `Previous period (${prev.label}): ${money(prevT.revenue)} from ${prevT.count} sales` : null,
    ].filter(Boolean),
    suggestions: ['Show my profit for the same period', 'Which products sold best?', 'Compare this week with last week'],
  };
}

function profitAnswer(ctx, p){
  const { sales, products, expenses } = ctx;
  const list = salesBetween(sales, p.from, p.to);
  const t = summarizeSales(list, products);
  const periodExpenses = expenses.filter(e=>e.date>=p.from && e.date<=p.to);
  const expenseTotal = sumBy(periodExpenses, e=>e.amount);
  const net = t.profit - expenseTotal;
  const productProfit = new Map();
  list.forEach(s=>(s.items||[]).forEach(it=>{
    const profit = (num(it.unitPrice)-itemCostOf(it,products))*num(it.qty);
    const key = it.name || 'Item';
    productProfit.set(key, num(productProfit.get(key)) + profit);
  }));
  const top = topEntries(productProfit, 5);
  const lines = [];
  if(!t.count) lines.push(`No sales ${p.label}, so there is no profit to report for that period.`);
  else lines.push(`${p.label[0].toUpperCase()}${p.label.slice(1)} you sold ${money(t.revenue)} worth of goods. They cost ${money(t.cost)}, leaving ${money(t.profit)} gross profit — a ${pctText(t.margin)} margin.`);
  if(expenseTotal) lines.push(`Expenses in the same period were ${money(expenseTotal)}, so net profit is ${money(net)}.`);
  else lines.push('No expenses were recorded in this period, so net profit matches gross profit.');
  if(top.length) lines.push(`${top[0][0]} contributed the most profit at ${money(top[0][1])}.`);
  return {
    title: `Profit · ${p.label}`,
    summary: lines.join(' '),
    stats: [
      stat('Revenue', money(t.revenue), 'good'),
      stat('Cost of goods', money(t.cost)),
      stat('Gross profit', money(t.profit), 'good'),
      stat('Gross margin', pctText(t.margin)),
      stat('Expenses', money(expenseTotal), expenseTotal?'warn':'muted'),
      stat('Net profit', money(net), net>=0?'good':'bad'),
    ],
    table: top.length ? { columns:['Product','Profit'], rows: top.map(([n,v])=>[n, money(v)]) } : null,
    bullets: [
      t.count ? `Average profit per sale: ${money(t.profit/t.count)}` : null,
      periodExpenses.length ? `Biggest expense: ${[...periodExpenses].sort((a,b)=>num(b.amount)-num(a.amount))[0].category} · ${money([...periodExpenses].sort((a,b)=>num(b.amount)-num(a.amount))[0].amount)}` : null,
    ].filter(Boolean),
    note: 'Profit uses the cost price stored on each sale line, or the item cost when the sale line has none.',
    suggestions: ['Where is my money going?', 'Which products make the most profit?', 'Show my expenses this month'],
  };
}

function restockAnswer(ctx){
  const { products } = ctx;
  const low = products.filter(p=>num(p.stock)<=reorderOf(p))
    .map(p=>{
      const suggested = Math.max(reorderOf(p)*2, 10);
      return {...p, suggested, cost: suggested*num(p.cost)};
    })
    .sort((a,b)=> (num(a.stock)-num(b.stock)) || (num(b.cost)-num(a.cost)));
  const out = low.filter(p=>num(p.stock)<=0);
  const totalCost = low.reduce((a,p)=>a+p.cost, 0);
  const lines = [];
  if(!low.length) lines.push('Nothing is at or below its reorder level right now — stock levels look healthy.');
  else {
    lines.push(`${low.length} item${low.length===1?' is':'s'} at or below the reorder level${out.length?`, and ${out.length} of those ${out.length===1?'is':'are'} completely out`:''}.`);
    lines.push(`Restocking ${low.length===1?'it':'them'} to a comfortable level would cost about ${money(totalCost)} at current cost prices.`);
  }
  return {
    title: 'Restock suggestions',
    summary: lines.join(' '),
    stats: [
      stat('Needs restocking', String(low.length), low.length?'warn':'good'),
      stat('Out of stock', String(out.length), out.length?'bad':'good'),
      stat('Estimated cost', money(totalCost), 'muted'),
    ],
    table: low.length ? {
      columns: ['Product','In stock','Reorder at','Suggested order','Cost'],
      rows: low.slice(0,12).map(p=>[p.name, String(num(p.stock)), String(reorderOf(p)), `${p.suggested} units`, money(p.cost)]),
    } : null,
    bullets: [
      out.length ? `Buy first: ${out.slice(0,4).map(p=>p.name).join(', ')}` : null,
      'Use Stock & Items → Stock to record the delivery — every unit is logged at cost price.',
    ].filter(Boolean),
    note: 'Suggested order quantities are twice the reorder level (minimum 10) unless you set your own.',
    suggestions: ['What is my stock worth?', 'Which items expire soon?', 'Show my profit this month'],
  };
}

function expiryAnswer(ctx){
  const { products } = ctx;
  const withDate = products
    .map(p=>({...p, days:daysToExpiry(p)}))
    .filter(p=>p.days!==null)
    .sort((a,b)=>a.days-b.days);
  const expired = withDate.filter(p=>p.days<0);
  const soon = withDate.filter(p=>p.days>=0 && p.days<=90);
  const lostValue = expired.reduce((a,p)=>a+num(p.cost)*num(p.stock),0);
  const lines = [];
  if(!expired.length && !soon.length) lines.push('No item is expired, and nothing expires in the next 90 days.');
  else {
    if(expired.length) lines.push(`${expired.length} item${expired.length===1?' is':'s'} already expired, holding ${money(lostValue)} of stock at cost. They cannot be sold at the POS.`);
    if(soon.length) lines.push(`${soon.length} item${soon.length===1?' expires':'s expire'} within 90 days — sell or return ${soon.length===1?'it':'them'} before the date passes.`);
  }
  return {
    title: 'Expiry watch',
    summary: lines.join(' '),
    stats: [
      stat('Expired', String(expired.length), expired.length?'bad':'good'),
      stat('Expiring ≤90d', String(soon.length), soon.length?'warn':'good'),
      stat('Value at risk', money(lostValue), 'warn'),
    ],
    table: (expired.length||soon.length) ? {
      columns:['Product','Expiry','Days','In stock','Value at cost'],
      rows: [...expired, ...soon].slice(0,12).map(p=>[
        p.name, readable(p.expiry), p.days<0?`${Math.abs(p.days)}d ago`:`${p.days}d left`,
        String(num(p.stock)), money(num(p.cost)*num(p.stock)),
      ]),
    } : null,
    note: 'Items past their date are marked Expired and are blocked at the point of sale.',
    suggestions: ['What should I restock?', 'What is my stock worth?', 'Show my shop briefing'],
  };
}

function deadStockAnswer(ctx){
  const { products, sales } = ctx;
  const since = shiftKey(todayKey(), -30);
  const soldIds = new Set();
  salesBetween(sales, since, todayKey()).forEach(s=>(s.items||[]).forEach(it=>{ if(it.productId) soldIds.add(it.productId) }));
  const slow = products
    .map(p=>{
      const lastSale = [...sales].filter(s=>(s.items||[]).some(it=>it.productId===p.id)).sort((a,b)=>b.date.localeCompare(a.date))[0];
      return {...p, lastSale};
    })
    .filter(p=> !soldIds.has(p.id) && num(p.stock)>0)
    .sort((a,b)=>num(b.stock)*num(b.cost)-num(a.stock)*num(a.cost));
  const tied = slow.reduce((a,p)=>a+num(p.stock)*num(p.cost),0);
  const lines = [];
  if(!slow.length) lines.push('Every item with stock had at least one sale in the last 30 days — nice and healthy.');
  else lines.push(`${slow.length} item${slow.length===1?'':'s'} with stock have not sold in the last 30 days, tying up ${money(tied)} at cost.`);
  return {
    title: 'Slow-moving stock',
    summary: lines.join(' '),
    stats: [
      stat('No sale in 30 days', String(slow.length), slow.length?'warn':'good'),
      stat('Capital tied up', money(tied), 'warn'),
      stat('Products tracked', String(products.length)),
    ],
    table: slow.length ? {
      columns:['Product','In stock','Value at cost','Last sale'],
      rows: slow.slice(0,12).map(p=>[p.name, String(num(p.stock)), money(num(p.stock)*num(p.cost)), p.lastSale?readable(p.lastSale.date):'never sold']),
    } : null,
    bullets: [
      'Consider a small discount, a shelf move, or returning near-expiry packs to the supplier.',
      slow.length ? `Worst offender: ${slow[0].name} with ${slow[0].stock} units and ${slow[0].lastSale?'last sold '+readable(slow[0].lastSale.date):'no sales on record'}.` : null,
    ].filter(Boolean),
    suggestions: ['Which items expire soon?', 'Which products sell best?', 'What should I restock?'],
  };
}

function productAnswer(ctx, product){
  const { products, sales, stockMoves } = ctx;
  const p = product;
  const last30 = salesBetween(sales, shiftKey(todayKey(), -30), todayKey());
  let units=0, revenue=0, profit=0;
  last30.forEach(s=>(s.items||[]).forEach(it=>{
    if(it.productId!==p.id) return;
    units += num(it.qty);
    revenue += num(it.lineTotal) || num(it.unitPrice)*num(it.qty);
    profit += (num(it.unitPrice)-itemCostOf(it,products))*num(it.qty);
  }));
  const moves = (stockMoves||[]).filter(m=>m.productId===p.id).sort((a,b)=>`${b.date}${b.time||''}`.localeCompare(`${a.date}${a.time||''}`));
  const lastRestock = moves.find(m=>m.type==='restock');
  const cost = num(p.cost), price = num(p.price);
  const margin = price ? (price-cost)/price*100 : 0;
  const days = daysToExpiry(p);
  const lines = [];
  lines.push(`${p.name}${p.sku?` (${p.sku})`:''} sells at ${money(price)} and costs ${money(cost)} — ${money(price-cost)} profit per unit, a ${pctText(margin)} margin.`);
  lines.push(`${num(p.stock)} unit${num(p.stock)===1?' is':'s'} in stock${num(p.stock)<=reorderOf(p)?` — that is at or below the reorder level of ${reorderOf(p)}, so it needs restocking`:''}.`);
  if(units) lines.push(`In the last 30 days you sold ${units} unit${units===1?'':'s'} for ${money(revenue)} (${money(profit)} profit).`);
  else lines.push('It has had no sales in the last 30 days.');
  if(days!==null) lines.push(days<0 ? `It expired ${Math.abs(days)} days ago on ${readable(p.expiry)}.` : `It expires in ${days} days (${readable(p.expiry)}).`);
  return {
    title: p.name,
    summary: lines.join(' '),
    stats: [
      stat('In stock', `${num(p.stock)} units`, num(p.stock)<=reorderOf(p)?'warn':'good'),
      stat('Selling price', money(price)),
      stat('Cost price', money(cost)),
      stat('Profit / unit', money(price-cost)),
      stat('Margin', pctText(margin)),
      stat('Sold · 30d', `${units} units`),
    ],
    bullets: [
      `Category: ${p.category||'—'}${p.supplier?` · Supplier: ${p.supplier}`:''}${p.brand?` · ${p.brand}`:''}`,
      `Reorder level: ${reorderOf(p)} units`,
      lastRestock ? `Last restock: ${readable(lastRestock.date)} · ${lastRestock.qty>0?'+':''}${lastRestock.qty} units (${lastRestock.by})` : null,
      days!==null ? `Expiry: ${readable(p.expiry)}${days<0?' — expired':days<=90?` — ${days} days left`:' — plenty of time'}` : 'No expiry date set',
    ].filter(Boolean),
    suggestions: ['What should I restock?', 'Which products sell best?', 'What is my stock worth?'],
  };
}

function employeeAnswer(ctx, p){
  const { sales, employees, products, attendance } = ctx;
  const list = salesBetween(sales, p.from, p.to);
  const rows = employees.map(e=>{
    const mine = list.filter(s=> s.cashierId===e.id || s.cashier===e.name);
    const t = summarizeSales(mine, products);
    return { e, t };
  }).sort((a,b)=>b.t.revenue-a.t.revenue);
  const selling = rows.filter(r=>r.t.count);
  const top = selling[0];
  const hours = attendance.filter(a=>a.date>=p.from && a.date<=p.to).reduce((a,x)=>a+num(x.hours),0);
  const lines = [];
  if(!selling.length) lines.push(`No sales were recorded by any staff member ${p.label}.`);
  else {
    lines.push(`${cap(inP(p.label))} ${top.e.name} brought in the most: ${money(top.t.revenue)} from ${top.t.count} sale${top.t.count===1?'':'s'}.`);
    if(selling.length>1) lines.push(`${selling.length} staff members recorded sales in that period.`);
  }
  if(hours) lines.push(`${hours.toFixed(1)} hours were clocked in over the same period.`);
  return {
    title: `Staff performance · ${p.label}`,
    summary: lines.join(' '),
    stats: [
      stat('Staff with sales', String(selling.length)),
      stat('Top seller', top?top.e.name:'—'),
      stat('Top revenue', top?money(top.t.revenue):money(0)),
      stat('Hours clocked', hours?`${hours.toFixed(1)}h`:'0h'),
    ],
    table: {
      columns: ['Staff','Sales','Revenue','Items','Profit','Avg sale'],
      rows: rows.filter(r=>r.t.count).map(r=>[
        `${r.e.name}${r.e.role==='owner'?' (owner)':''}`, String(r.t.count), money(r.t.revenue),
        String(r.t.units), money(r.t.profit), money(r.t.avg),
      ]),
    },
    bullets: selling.length>1 ? [`Runner-up: ${selling[1].e.name} · ${money(selling[1].t.revenue)}`] : [],
    note: 'You can open any sale from Staff Tracking → Sales history and correct it if something was recorded wrongly.',
    suggestions: ['Compare this week with last week', 'How are sales today?', 'Who owes me money?'],
  };
}

function employeeDetail(ctx, employee, p){
  const { sales, products, attendance } = ctx;
  const mine = salesBetween(sales, p.from, p.to).filter(s=> s.cashierId===employee.id || s.cashier===employee.name);
  const t = summarizeSales(mine, products);
  const productsMap = new Map();
  mine.forEach(s=>(s.items||[]).forEach(it=> productsMap.set(it.name, num(productsMap.get(it.name))+num(it.qty))));
  const top = topEntries(productsMap, 5);
  const hours = attendance.filter(a=>a.employeeId===employee.id && a.date>=p.from && a.date<=p.to).reduce((a,x)=>a+num(x.hours),0);
  const corrections = mine.filter(s=>num(s.editCount)>0).length;
  const allTime = summarizeSales(sales.filter(s=> s.cashierId===employee.id || s.cashier===employee.name), products);
  return {
    title: `${employee.name} · ${p.label}`,
    summary: `${employee.name} recorded ${t.count} sale${t.count===1?'':'s'} worth ${money(t.revenue)} ${p.label}, selling ${t.units} item${t.units===1?'':'s'} with ${money(t.profit)} profit${hours?`, across ${hours.toFixed(1)} clocked hours`:''}. All time: ${allTime.count} sales, ${money(allTime.revenue)}.`,
    stats: [
      stat('Sales', String(t.count)),
      stat('Revenue', money(t.revenue), 'good'),
      stat('Items sold', String(t.units)),
      stat('Profit', money(t.profit)),
      stat('Average sale', money(t.avg)),
      stat('Hours', hours?`${hours.toFixed(1)}h`:'not clocked'),
    ],
    table: top.length ? { columns:['Product','Units'], rows: top.map(([n,v])=>[n, String(v)]) } : null,
    bullets: [
      `Shift: ${employee.shift||'—'} · status: ${employee.status||'—'}`,
      corrections ? `${corrections} of their sales ${corrections===1?'has':'have'} been corrected by you` : 'No corrections on their sales',
    ],
    suggestions: ['Who is my top seller?', 'How are sales today?', 'Which products sell best?'],
  };
}

function topProductsAnswer(ctx, p){
  const { sales, products } = ctx;
  const list = salesBetween(sales, p.from, p.to);
  const map = new Map();
  list.forEach(s=>(s.items||[]).forEach(it=>{
    const key = it.productId || it.name;
    const cur = map.get(key) || { name: it.name||'Item', units:0, revenue:0, profit:0 };
    cur.units += num(it.qty);
    cur.revenue += num(it.lineTotal) || num(it.unitPrice)*num(it.qty);
    cur.profit += (num(it.unitPrice)-itemCostOf(it,products))*num(it.qty);
    map.set(key, cur);
  }));
  const all = [...map.values()].sort((a,b)=>b.revenue-a.revenue);
  if(!all.length){
    return {
      title: `Best sellers · ${p.label}`,
      summary: `No products were sold ${p.label}, so there are no best sellers to rank.`,
      suggestions: ['How were sales this week?', 'Which products are not selling?', 'Show my shop briefing'],
    };
  }
  return {
    title: `Best sellers · ${p.label}`,
    summary: `${all[0].name} is your top earner ${p.label}: ${all[0].units} units for ${money(all[0].revenue)} (${money(all[0].profit)} profit). Here are the ${Math.min(all.length,8)} strongest products.`,
    stats: [
      stat('Products sold', String(all.length)),
      stat('Units sold', String(all.reduce((a,x)=>a+x.units,0))),
      stat('Revenue', money(all.reduce((a,x)=>a+x.revenue,0))),
      stat('Profit', money(all.reduce((a,x)=>a+x.profit,0)), 'good'),
    ],
    table: {
      columns:['Product','Units','Revenue','Profit'],
      rows: all.slice(0,8).map(x=>[x.name, String(x.units), money(x.revenue), money(x.profit)]),
    },
    suggestions: ['Which products are not selling?', 'Show my profit this month', 'What should I restock?'],
  };
}

function customerAnswer(ctx, p, q){
  const { customers, sales } = ctx;
  const named = findCustomer(q, customers);
  const owing = customers.filter(c=>!c.isWalkIn && num(c.balance)>0).sort((a,b)=>num(b.balance)-num(a.balance));
  const owed = sumBy(owing, c=>c.balance);
  if(named){
    const mine = sales.filter(s=>s.customerId===named.id);
    const t = summarizeSales(mine, ctx.products);
    const inPeriod = summarizeSales(salesBetween(mine, p.from, p.to), ctx.products);
    return {
      title: named.name,
      summary: `${named.name} has spent ${money(named.totalSpent || t.revenue)} with ${num(named.visits) || t.count} visit${(num(named.visits)||t.count)===1?'':'s'}${inPeriod.count?`, including ${money(inPeriod.revenue)} ${p.label}`:''}. ${num(named.balance)>0?`They currently owe ${money(named.balance)}.`:'Their account is clear.'}`,
      stats: [
        stat('Total spent', money(named.totalSpent || t.revenue), 'good'),
        stat('Visits', String(num(named.visits) || t.count)),
        stat('Owes', money(named.balance), num(named.balance)>0?'warn':'good'),
        stat('Sales recorded', String(t.count)),
      ],
      bullets: [
        named.phone ? `Phone: ${named.phone}` : null,
        named.address ? `Address: ${named.address}` : null,
        t.count ? `Average spend per visit: ${money((named.totalSpent || t.revenue) / Math.max(1, num(named.visits) || t.count))}` : null,
        mine.length ? `Last purchase: ${readable([...mine].sort((a,b)=>b.date.localeCompare(a.date))[0].date)}` : null,
      ].filter(Boolean),
      suggestions: ['Who owes me money?', 'Who are my best customers?', 'How are sales this month?'],
    };
  }
  const best = [...customers].filter(c=>!c.isWalkIn).sort((a,b)=>num(b.totalSpent)-num(a.totalSpent)).slice(0,6);
  const lines = [];
  lines.push(`${owing.length} customer${owing.length===1?'':'s'} owe${owing.length===1?'s':''} you ${money(owed)} in total.`);
  if(best.length) lines.push(`Your best customer is ${best[0].name} with ${money(best[0].totalSpent)} spent over ${num(best[0].visits)} visits.`);
  return {
    title: 'Customers & money owed',
    summary: lines.join(' '),
    stats: [
      stat('Customers', String(customers.filter(c=>!c.isWalkIn).length)),
      stat('Owing money', String(owing.length), owing.length?'warn':'good'),
      stat('Total owed', money(owed), owed?'warn':'good'),
      stat('Best customer', best[0]?best[0].name:'—'),
    ],
    table: best.length ? {
      columns:['Customer','Total spent','Visits','Owes'],
      rows: best.map(c=>[c.name, money(c.totalSpent), String(num(c.visits)), money(c.balance)]),
    } : null,
    bullets: owing.length ? [`Largest balance: ${owing[0].name} · ${money(owing[0].balance)}`] : [],
    note: 'Record payments on Customers → Pay, or from Gift Cards & Money Owed.',
    suggestions: ['Who owes me money?', 'Which customers buy most often?', 'How are sales today?'],
  };
}

function expensesAnswer(ctx, p){
  const { expenses } = ctx;
  const list = expenses.filter(e=>e.date>=p.from && e.date<=p.to);
  const total = sumBy(list, e=>e.amount);
  const byCat = new Map();
  list.forEach(e=> byCat.set(e.category||'Other', num(byCat.get(e.category||'Other'))+num(e.amount)));
  const cats = [...byCat.entries()].sort((a,b)=>b[1]-a[1]);
  const prev = previousPeriod(p);
  const prevList = prev ? expenses.filter(e=>e.date>=prev.from && e.date<=prev.to) : [];
  const prevTotal = sumBy(prevList, e=>e.amount);
  const lines = [];
  if(!list.length) lines.push(`No expenses were recorded ${p.label}.`);
  else {
    lines.push(`You spent ${money(total)} ${p.label} across ${list.length} entr${list.length===1?'y':'ies'}.`);
    if(cats.length) lines.push(`${cats[0][0]} is the biggest category at ${money(cats[0][1])}${total?` (${pctText(cats[0][1]/total*100)} of spending)`:''}.`);
    if(prevTotal) lines.push(`That is ${total>=prevTotal?'more':'less'} than ${prev.label} (${money(prevTotal)}).`);
  }
  return {
    title: `Expenses · ${p.label}`,
    summary: lines.join(' '),
    stats: [
      stat('Spent', money(total), 'warn'),
      stat('Entries', String(list.length)),
      stat('Categories', String(cats.length)),
      stat('Average entry', money(list.length?total/list.length:0)),
    ],
    table: cats.length ? { columns:['Category','Amount','Share'], rows: cats.map(([c,v])=>[c, money(v), pctText(total?v/total*100:0)]) } : null,
    bullets: list.length ? [
      `Largest single expense: ${[...list].sort((a,b)=>num(b.amount)-num(a.amount))[0].note || [...list].sort((a,b)=>num(b.amount)-num(a.amount))[0].category} · ${money([...list].sort((a,b)=>num(b.amount)-num(a.amount))[0].amount)}`,
    ] : [],
    suggestions: ['What is my net profit this month?', 'How are sales this month?', 'Show my shop briefing'],
  };
}

function paymentAnswer(ctx, p){
  const { sales } = ctx;
  const list = salesBetween(sales, p.from, p.to);
  const map = new Map();
  list.forEach(s=>{
    const k = s.payment||'Cash';
    const cur = map.get(k) || {count:0, amount:0};
    cur.count += 1; cur.amount += num(s.total);
    map.set(k, cur);
  });
  const rows = [...map.entries()].sort((a,b)=>b[1].amount-a[1].amount);
  const total = rows.reduce((a,[,v])=>a+v.amount,0);
  return {
    title: `Payment methods · ${p.label}`,
    summary: rows.length
      ? `${p.label[0].toUpperCase()}${p.label.slice(1)}: ${rows.map(([k,v])=>`${k} ${money(v.amount)}`).join(', ')}. ${rows[0][0]} is the most used method${total?` at ${pctText(rows[0][1].amount/total*100)} of takings`:''}.`
      : `No payments were recorded ${p.label}.`,
    stats: rows.length ? rows.map(([k,v])=>stat(k, money(v.amount))) : [stat('Takings', money(0))],
    table: rows.length ? { columns:['Method','Sales','Amount','Share'], rows: rows.map(([k,v])=>[k, String(v.count), money(v.amount), pctText(total?v.amount/total*100:0)]) } : null,
    note: 'Cash, MoMo and gift-card payments all combine into the owner account.',
    suggestions: ['How are sales this week?', 'Show my profit this month', 'What should I restock?'],
  };
}

function giftAnswer(ctx){
  const { giftCards, sales } = ctx;
  const active = giftCards.filter(g=>g.status==='active');
  const balance = sumBy(active, g=>g.balance);
  const original = sumBy(giftCards, g=>g.original);
  const used = sumBy(giftCards, g=>Math.max(0, num(g.original)-num(g.balance)));
  const soon = active.filter(g=>g.expiry && new Date(`${g.expiry}T12:00:00`) - new Date(`${todayKey()}T12:00:00`) < 30*86400000);
  const giftSales = sales.filter(s=>s.payment==='Gift');
  return {
    title: 'Gift cards',
    summary: `${active.length} active gift card${active.length===1?'':'s'} carry ${money(balance)} of unspent balance (${money(used)} of ${money(original)} already redeemed).${soon.length?` ${soon.length} card${soon.length===1?' expires':'s expire'} within 30 days.`:''} Gift cards have paid for ${giftSales.length} sale${giftSales.length===1?'':'s'}.`,
    stats: [
      stat('Active cards', String(active.length), 'good'),
      stat('Unspent balance', money(balance), 'warn'),
      stat('Redeemed', money(used)),
      stat('Cards expiring ≤30d', String(soon.length), soon.length?'warn':'good'),
    ],
    table: giftCards.length ? {
      columns:['Code','Customer','Balance','Status','Expiry'],
      rows: giftCards.slice(0,10).map(g=>[g.code, g.customerName||'—', money(g.balance), g.status, g.expiry?readable(g.expiry):'—']),
    } : null,
    note: 'Gift-card balances are a liability: the money is only yours once the card is spent.',
    suggestions: ['How are sales this week?', 'Who owes me money?', 'Show my shop briefing'],
  };
}

function forecastAnswer(ctx){
  const { sales, products, expenses } = ctx;
  const t = todayKey();
  const rows = [];
  for(let i=6;i>=0;i--){
    const d = shiftKey(t,-i);
    const list = salesBetween(sales, d, d);
    rows.push({ date:d, revenue:sumBy(list, s=>s.total), count:list.length });
  }
  const total = rows.reduce((a,r)=>a+r.revenue, 0);
  const avg = total/7;
  const last3 = rows.slice(4).reduce((a,r)=>a+r.revenue,0)/3;
  const first4 = rows.slice(0,4).reduce((a,r)=>a+r.revenue,0)/4;
  const trend = first4 ? (last3-first4)/first4*100 : 0;
  const daysWithSales = rows.filter(r=>r.count).length || 1;
  const perSellingDay = total/daysWithSales;
  const next7 = trend<0 ? perSellingDay*daysWithSales*Math.max(0.6, 1+trend/100) : perSellingDay*7*(1+Math.min(0.3, trend/200));
  const monthExpenses = sumBy(expenses.filter(e=>e.date>=monthStartKey()), e=>e.amount);
  const low = products.filter(p=>num(p.stock)<=reorderOf(p)).length;
  return {
    title: 'Short-term outlook',
    summary: `Over the last 7 days you averaged ${money(avg)} a day. ${Math.abs(trend)<5 ? 'Sales are holding steady compared with the earlier part of the week' : trend>0 ? `The trend is up about ${trend.toFixed(0)}% compared with the earlier part of the week` : `The trend is down about ${Math.abs(trend).toFixed(0)}% compared with the earlier part of the week`}, so the next 7 days could land near ${money(next7)}.`,
    stats: [
      stat('7-day total', money(total)),
      stat('Daily average', money(avg)),
      stat('Momentum', `${trend>=0?'+':''}${trend.toFixed(0)}%`, trend>=0?'good':'warn'),
      stat('Next 7 days (est.)', money(next7), 'good'),
      stat('Expenses · month', money(monthExpenses), 'warn'),
    ],
    table: {
      columns:['Day','Sales','Revenue'],
      rows: rows.map(r=>[readable(r.date), String(r.count), money(r.revenue)]),
    },
    bullets: [
      `Aim for at least ${money(perSellingDay)} on each trading day to hold this pace.`,
      low ? `${low} item${low===1?'':'s'} need restocking — a stock-out would cut into this forecast.` : 'Stock levels support this forecast.',
    ],
    note: 'This is a simple on-device projection from your own sales history, not a guarantee. It ignores seasonality, holidays and promotions.',
    suggestions: ['Compare this week with last week', 'Where is my money going?', 'What should I restock?'],
  };
}

function compareAnswer(ctx, q){
  const base = /month/.test(q) ? resolvePeriod('this month') : /year/.test(q) ? resolvePeriod('this year') : { ...resolvePeriod('this week'), label:'this week (last 7 days)' };
  const prev = previousPeriod(base);
  const prevLabel = /month/.test(q) ? monthLabel(prevMonthRange(todayKey()).from) : /year/.test(q) ? String(Number(todayKey().slice(0,4))-1) : 'last week (previous 7 days)';
  const { sales, products, expenses } = ctx;
  const cur = summarizeSales(salesBetween(sales, base.from, base.to), products);
  const old = summarizeSales(salesBetween(sales, prev.from, prev.to), products);
  const curExp = sumBy(expenses.filter(e=>e.date>=base.from && e.date<=base.to), e=>e.amount);
  const oldExp = sumBy(expenses.filter(e=>e.date>=prev.from && e.date<=prev.to), e=>e.amount);
  const revenueChange = old.revenue ? (cur.revenue-old.revenue)/old.revenue*100 : 0;
  const netCur = cur.profit - curExp, netOld = old.profit - oldExp;
  return {
    title: `${cap(base.label)} vs ${prevLabel}`,
    summary: `Revenue is ${money(cur.revenue)} ${base.label} against ${money(old.revenue)} in ${prevLabel} (${revenueChange>=0?'up':'down'} ${Math.abs(revenueChange).toFixed(0)}%). Profit went from ${money(old.profit)} to ${money(cur.profit)}, and net profit after expenses from ${money(netOld)} to ${money(netCur)}.`,
    stats: [
      stat('Revenue', money(cur.revenue), 'good'),
      stat('Change', `${revenueChange>=0?'+':''}${revenueChange.toFixed(0)}%`, revenueChange>=0?'good':'bad'),
      stat('Sales', `${cur.count} vs ${old.count}`),
      stat('Profit', `${money(cur.profit)} vs ${money(old.profit)}`),
      stat('Expenses', `${money(curExp)} vs ${money(oldExp)}`, 'warn'),
      stat('Net profit', money(netCur), netCur>=netOld?'good':'bad'),
    ],
    table: {
      columns:['Measure', cap(base.label), prevLabel, 'Difference'],
      rows: [
        ['Revenue', money(cur.revenue), money(old.revenue), `${cur.revenue-old.revenue>=0?'+':''}${money(cur.revenue-old.revenue)}`],
        ['Sales', String(cur.count), String(old.count), `${cur.count-old.count>=0?'+':''}${cur.count-old.count}`],
        ['Units', String(cur.units), String(old.units), `${cur.units-old.units>=0?'+':''}${cur.units-old.units}`],
        ['Profit', money(cur.profit), money(old.profit), `${cur.profit-old.profit>=0?'+':''}${money(cur.profit-old.profit)}`],
        ['Expenses', money(curExp), money(oldExp), `${curExp-oldExp>=0?'+':''}${money(curExp-oldExp)}`],
      ],
    },
    suggestions: ['Which products sold best?', 'Which products are not selling?', 'Show my shop briefing'],
  };
}

function stockValueAnswer(ctx){
  const { products } = ctx;
  const cost = products.reduce((a,p)=>a+num(p.cost)*num(p.stock),0);
  const retail = products.reduce((a,p)=>a+num(p.price)*num(p.stock),0);
  const potential = retail-cost;
  const low = products.filter(p=>num(p.stock)<=reorderOf(p));
  const lowValue = low.reduce((a,p)=>a+num(p.cost)*num(p.stock),0);
  const expired = products.map(p=>({p, d:daysToExpiry(p)})).filter(x=>x.d!==null && x.d<0);
  const expValue = expired.reduce((a,x)=>a+num(x.p.cost)*num(x.p.stock),0);
  return {
    title: 'Stock value',
    summary: `Your shelves hold ${products.length} products worth ${money(cost)} at cost and ${money(retail)} at retail — ${money(potential)} of potential profit${low.length?`, with ${low.length} item${low.length===1?'':'s'} below the reorder level (${money(lowValue)} at cost)`:''}.`,
    stats: [
      stat('Value at cost', money(cost), 'good'),
      stat('Retail value', money(retail)),
      stat('Potential profit', money(potential), 'good'),
      stat('Units on hand', String(products.reduce((a,p)=>a+num(p.stock),0))),
      stat('Low stock value', money(lowValue), low.length?'warn':'muted'),
      stat('Expired value', money(expValue), expValue?'bad':'muted'),
    ],
    table: {
      columns:['Product','Units','Cost','Value at cost'],
      rows: [...products].sort((a,b)=>num(b.cost)*num(b.stock)-num(a.cost)*num(a.stock)).slice(0,8)
        .map(p=>[p.name, String(num(p.stock)), money(p.cost), money(num(p.cost)*num(p.stock))]),
    },
    suggestions: ['What should I restock?', 'Which items expire soon?', 'Show my shop briefing'],
  };
}

function attendanceAnswer(ctx, p){
  const { attendance, employees } = ctx;
  const list = attendance.filter(a=>a.date>=p.from && a.date<=p.to);
  const hours = sumBy(list, a=>a.hours);
  const open = list.filter(a=>!a.out).length;
  const today = attendance.filter(a=>a.date===todayKey());
  const payroll = employees.filter(e=>e.role!=='owner').reduce((a,e)=>a+num(e.salary),0);
  const byPerson = new Map();
  list.forEach(a=>{ const cur = byPerson.get(a.name) || {hours:0, shifts:0}; cur.hours += num(a.hours); cur.shifts += 1; byPerson.set(a.name, cur) });
  return {
    title: `Attendance & hours · ${p.label}`,
    summary: `${list.length} shift${list.length===1?' was':'s were'} logged ${inP(p.label)}${hours?`, totalling ${hours.toFixed(1)} hours`:`${open?`, ${open} of them still open with no clock-out yet`:''}`}. ${today.length} staff member${today.length===1?' is':'s'} clocked in today. Monthly payroll sits at ${money(payroll)}.`,
    stats: [
      stat('Shifts logged', String(list.length)),
      stat('Hours worked', hours?`${hours.toFixed(1)}h`:'0h (open)'),
      stat('In today', String(today.length)),
      stat('Monthly payroll', money(payroll), 'warn'),
    ],
    table: byPerson.size ? {
      columns:['Staff','Shifts','Hours'],
      rows: [...byPerson.entries()].sort((a,b)=>b[1].hours-a[1].hours).map(([n,v])=>[n, String(v.shifts), v.hours?v.hours.toFixed(1):'open']),
    } : null,
    bullets: list.some(a=>!a.out) ? [`${list.filter(a=>!a.out).length} open clock-in${list.filter(a=>!a.out).length===1?'':'s'} still running`] : [],
    suggestions: ['Who is my top seller?', 'How are sales this week?', 'Show my shop briefing'],
  };
}

function maintenanceAnswer(ctx){
  const { maintenance } = ctx;
  const t = todayKey();
  const pending = maintenance.filter(m=>m.status!=='completed');
  const overdue = pending.filter(m=>m.dueDate && m.dueDate<t);
  const soon = pending.filter(m=>m.dueDate && m.dueDate>=t && m.dueDate<=shiftKey(t,7));
  const cost = pending.reduce((a,m)=>a+num(m.cost),0);
  const rows = [...overdue, ...soon, ...pending.filter(m=>!overdue.includes(m)&&!soon.includes(m))]
    .slice(0,10)
    .map(m=>[
      m.asset||'Equipment',
      m.title||'Service',
      m.dueDate?readable(m.dueDate):'—',
      m.dueDate&&m.dueDate<t?`${Math.abs(Math.round((new Date(`${t}T12:00:00`)-new Date(`${m.dueDate}T12:00:00`))/86400000))}d overdue`:m.dueDate&&m.dueDate<=shiftKey(t,7)?'due soon':'scheduled',
      money(m.cost),
    ]);
  return {
    title: 'Maintenance',
    summary: pending.length
      ? `${pending.length} maintenance plan${pending.length===1?' is':'s'} open, with ${overdue.length} overdue${soon.length?` and ${soon.length} due in the next 7 days`:''}. Estimated spend ${money(cost)}.`
      : 'No open maintenance plans — equipment is up to date.',
    stats: [
      stat('Open plans', String(pending.length)),
      stat('Overdue', String(overdue.length), overdue.length?'bad':'good'),
      stat('Due in 7 days', String(soon.length), soon.length?'warn':'good'),
      stat('Estimated cost', money(cost), 'muted'),
    ],
    table: rows.length ? { columns:['Asset','Service','Due','Status','Cost'], rows } : null,
    suggestions: ['Show my shop briefing', 'Where is my money going?', 'How are sales this week?'],
  };
}

function correctionsAnswer(ctx, p){
  const { sales } = ctx;
  const corrected = [...sales].filter(s=>num(s.editCount)>0).sort((a,b)=>String(b.editedAt||'').localeCompare(String(a.editedAt||'')));
  if(!corrected.length){
    return {
      title: 'Sale corrections',
      summary: 'No recorded sale has been corrected yet, so every invoice still matches what the cashier entered.',
      stats: [ stat('Corrected sales','0','good') ],
      suggestions: ['How are sales today?', 'Who is my top seller?', 'Show my shop briefing'],
    };
  }
  const last = corrected[0];
  const trail = last.corrections?.[last.corrections.length-1];
  return {
    title: 'Sale corrections',
    summary: `${corrected.length} sale${corrected.length===1?' has':'s have'} been corrected. Latest: ${last.invoiceNumber} ${trail?`— ${money(trail.before.total)} → ${money(trail.after.total)} because “${trail.reason}”`:''} (by ${last.editedBy||'owner'}).`,
    stats: [
      stat('Corrected sales', String(corrected.length), 'warn'),
      stat('Latest', last.invoiceNumber),
      stat('Change', trail?`${trail.after.total-trail.before.total>=0?'+':''}${money(trail.after.total-trail.before.total)}`:'—', 'muted'),
      stat('Edited by', last.editedBy||'owner'),
    ],
    table: {
      columns:['Invoice','When','Reason','Before','After','By'],
      rows: corrected.slice(0,10).map(s=>{
        const c = s.corrections?.[s.corrections.length-1];
        return [s.invoiceNumber, c?new Date(c.at).toLocaleDateString('en-GH'):'—', c?.reason||'—', c?money(c.before.total):'—', c?money(c.after.total):money(s.total), s.editedBy||'owner'];
      }),
    },
    note: 'Stock, customer totals and gift-card balances were adjusted automatically for each correction.',
    suggestions: ['Who is my top seller?', 'How are sales this month?', 'Which products sell best?'],
  };
}

function invoiceAnswer(ctx, q){
  const { sales, products } = ctx;
  const match = q.match(/(?:invoice|inv|receipt|pos|sale|bill)[-\s#:]*(\d{3,})/);
  if(!match) return null;
  const digits = match[1];
  const sale = sales.find(s=> String(s.invoiceNumber||'').toLowerCase().includes(digits) || String(s.id||'').toLowerCase().includes(digits));
  if(!sale) return { title:'Invoice not found', summary:`I could not find an invoice matching “${digits}” on this device. Check the number on Sales history.`, suggestions:['How are sales today?','Show sale corrections','Show my shop briefing'] };
  const profit = saleProfit(sale, products);
  return {
    title: `Invoice ${sale.invoiceNumber}`,
    summary: `${sale.customerName} bought ${saleUnits(sale)} item${saleUnits(sale)===1?'':'s'} for ${money(sale.total)} on ${readable(sale.date)} at ${sale.time||''}, paid by ${sale.payment}. Seller: ${sale.cashier}${sale.discount?`. A discount of ${money(sale.discount)} was applied`:''}.`,
    stats: [
      stat('Total', money(sale.total), 'good'),
      stat('Payment', sale.payment||'Cash'),
      stat('Seller', sale.cashier||'—'),
      stat('Profit', money(profit)),
      stat('Corrected', num(sale.editCount)?`${sale.editCount}×`:'no', num(sale.editCount)?'warn':'muted'),
    ],
    table: (sale.items||[]).length ? {
      columns:['Product','Qty','Unit price','Line total'],
      rows: sale.items.map(it=>[it.name, String(num(it.qty)), money(it.unitPrice), money(it.lineTotal ?? num(it.unitPrice)*num(it.qty))]),
    } : null,
    bullets: [
      sale.discount ? `Discount: ${money(sale.discount)}` : null,
      sale.paymentDetail?.code ? `Gift card: ${sale.paymentDetail.code}` : null,
      num(sale.editCount) ? `Corrected by ${sale.editedBy}: ${sale.corrections?.[sale.corrections.length-1]?.reason||''}` : null,
    ].filter(Boolean),
    suggestions: ['Show sale corrections', 'How are sales today?', 'Who is my top seller?'],
  };
}

function helpAnswer(ctx){
  return {
    title: 'What I can answer',
    summary: `I am POSI’s on-device assistant for the owner. I read the sales, stock, customer, expense, staff and maintenance records already saved in this browser — no internet required — and answer in plain language. Ask me things like:`,
    bullets: [
      '“How are sales today?” · “Compare this week with last week”',
      '“Show my profit this month” · “Where is my money going?”',
      '“What should I restock?” · “Which items expire soon?” · “What is my stock worth?”',
      '“Which products sell best?” · “Which products are not selling?”',
      '“Who is my top seller?” · “How are Ama’s sales this week?”',
      '“Who owes me money?” · “How much has Akosua spent?” · “Show my gift cards”',
      '“Predict next week’s sales” · “Show sale corrections” · “Look up invoice 02487”',
      '“How many Paracetamol do I have left?” · “What is the price of Ibuprofen?”',
    ],
    stats: [
      stat('Runs offline', 'Yes', 'good'),
      stat('Data leaves device', 'Never', 'good'),
      stat('Owner only', 'Yes'),
    ],
    note: 'I do not invent numbers: if there is no record for a period, I say so.',
    suggestions: ['How are sales today?', 'What should I restock?', 'Who owes me money?', 'Predict next week’s sales'],
  };
}

const cap = (s)=> s ? s[0].toUpperCase()+s.slice(1) : s;
const inP = (label)=> /^(the|all) /.test(label||'') ? `in ${label}` : label;

/* ------------------------------------------------------------------------- *
 * The router: pick the best intent for the question.
 * Ordered from most specific to most general.
 * ------------------------------------------------------------------------- */
export function respond(question, data, options={}){
  const ctx = {
    sales: data?.sales||[], products: data?.products||[], customers: data?.customers||[],
    employees: data?.employees||[], expenses: data?.expenses||[], giftCards: data?.giftCards||[],
    stockMoves: data?.stockMoves||[], maintenance: data?.maintenance||[], attendance: data?.attendance||[],
    currentUser: data?.currentUser||null,
  };
  const raw = String(question||'').trim();
  if(!raw) return briefing(ctx, true);
  const q = raw.toLowerCase().replace(/[’']/g,"'");

  // 1. Help + greetings
  if(/(what can you (do|answer)|how (do|can) i use you|help me|^help$|what do you do|commands|examples)/.test(q)) return helpAnswer(ctx);
  if(/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(q) && q.split(/\s+/).length<=6) return briefing(ctx, true);

  // 2. Invoice lookup
  const inv = invoiceAnswer(ctx, q);
  if(inv) return inv;

  // 3. Corrections / audit
  if(/(correct|correction|audit|mistake|wrong|edit(ed|s)? (sale|sales|record)|change(d)? (a|the)? ?sale)/.test(q)) return correctionsAnswer(ctx, resolvePeriod(q, 'all'));

  // 4. A specific product
  const product = findProduct(q, ctx.products);
  const productIntent = product && /(stock|left|price|cost|margin|profit|sell|sold|expire|expiry|available|how many|much|reorder|supplier|barcode|sku)/.test(q);
  if(product && (productIntent || q.split(/\s+/).length<=4)) return productAnswer(ctx, product);

  // 5. Restock / low stock
  if(/(restock|re-?order|low stock|out of stock|running (low|out)|need to (buy|order)|order more|buy more|stock up)/.test(q)) return restockAnswer(ctx);

  // 6. Expiry
  if(/(expir|out of date|shelf life|near(ing)? (the )?end)/.test(q)) return expiryAnswer(ctx);

  // 7. Slow movers
  if(/(not selling|isn'?t selling|dead stock|slow(-| )?moving|never sold|no sales|stale|bad stock)/.test(q)) return deadStockAnswer(ctx);

  // 8. A named staff member (sales words, no spend words)
  const hoursQuestion = /(hours|clock(ed)?|attendance|payroll|salary|salaries|shift)/.test(q);
  const employee = findEmployee(q, ctx.employees);
  if(employee && !hoursQuestion && (hasAny(q, SELL_WORDS) || !hasAny(q, SPEND_WORDS))) {
    const period = resolvePeriod(q, /month/.test(q) ? 'month' : /year/.test(q) ? 'all' : 'week');
    return employeeDetail(ctx, employee, period);
  }

  // 9. Staff / seller ranking
  if(/(who (sold|sells|is (my|the) (top|best))|top (seller|cashier|staff|employee)|best (seller|cashier|staff)|staff performance|sales by (staff|employee|cashier|seller)|employee performance|cashier performance)/.test(q)) {
    return employeeAnswer(ctx, resolvePeriod(q, 'week'));
  }
  if(/(staff|employees|cashiers|team)/.test(q) && !hasAny(q, SPEND_WORDS) && !hoursQuestion) return employeeAnswer(ctx, resolvePeriod(q, 'week'));

  // 10. Best sellers
  if(/(best (sell|product|item)|top (product|item|selling)|most (sold|popular)|popular (product|item)|which (products|items) sell|what sells|fast(est)? moving)/.test(q)) {
    return topProductsAnswer(ctx, resolvePeriod(q, 'week'));
  }

  // 11. Payments
  if(/(payment method|payments|cash|momo|mobile money|gift card.*paid|paid by|how do (people|they) pay)/.test(q) && !/gift card/.test(q)) {
    return paymentAnswer(ctx, resolvePeriod(q, 'today'));
  }

  // 12. Expenses
  if(/(expense|spending|spend(ing)? money|money going|cost of running|outgoings?|bills|rent|utilities|salaries)/.test(q) && !/(profit|net)/.test(q)) {
    return expensesAnswer(ctx, resolvePeriod(q, 'month'));
  }

  // 13. Profit
  if(/(profit|net income|margin|make money|earn|take home)/.test(q)) return profitAnswer(ctx, resolvePeriod(q, 'month'));

  // 14. Forecast
  if(/(predict|forecast|expect|projection|next (week|month)|trend|outlook|growing|growth|improving|declining|getting (better|worse)|will i (sell|make))/.test(q)) return forecastAnswer(ctx);

  // 15. Comparison
  if(/(compare|versus|\bvs\b|better than|worse than|difference between)/.test(q)) return compareAnswer(ctx, q);

  // 16. Customers
  if(/(customer|client|owes?|owe|debt|credit|receivable|spent|spend|visit|loyal|best customer)/.test(q)) {
    return customerAnswer(ctx, resolvePeriod(q, 'month'), q);
  }

  // 17. Gift cards
  if(/gift ?card/.test(q)) return giftAnswer(ctx);

  // 18. Stock value
  if(/(stock value|inventory value|capital|worth|how much stock|value of (my )?(stock|inventory))/.test(q)) return stockValueAnswer(ctx);

  // 19. Attendance / payroll
  if(/(attendance|clock(ed)?( in| out)?|hours|payroll|salary|salaries|shift|who is (in|working))/.test(q)) return attendanceAnswer(ctx, resolvePeriod(q, 'week'));

  // 20. Maintenance
  if(/(maintenance|service|servicing|repair|equipment|fridge|generator|due for)/.test(q)) return maintenanceAnswer(ctx);

  // 21. Generic sales / business
  if(/(sale|sales|revenue|turnover|income|sold|sell|business|takings|earnings|how (is|are) (things|business|we doing))/.test(q)) {
    return salesAnswer(ctx, resolvePeriod(q, /business|how are things/.test(q) ? 'week' : 'today'), q);
  }

  // 22. Fallback: briefing with a hint about what was not understood
  const fallback = briefing(ctx, true);
  return {
    ...fallback,
    title: 'Here is the shop picture',
    summary: `I could not match “${raw}” to a specific report, so here is the current shop picture. ${fallback.summary}`,
    note: 'Try asking about sales, profit, stock, restocking, expiry, customers, expenses, staff, gift cards or maintenance.',
  };
}

export const STARTER_QUESTIONS = [
  'How are sales today?',
  'What should I restock?',
  'Show my profit this month',
  'Which products are not selling?',
  'Who owes me money?',
  'Predict next week’s sales',
];

/* ------------------------------------------------------------------------- *
 * The page (owner only)
 * ------------------------------------------------------------------------- */
function useStored(key, initial){
  const [value, setValue] = useState(()=>{
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial }catch{ return initial }
  });
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(value)) }catch{} },[key,value]);
  return [value,setValue];
}

function StatChips({ stats }){
  if(!stats?.length) return null;
  const tone = (t)=> t==='good' ? { color:'#065f46', background:'#ecfdf5', borderColor:'#a7f3d0' }
    : t==='bad' ? { color:'#991b1b', background:'#fef2f2', borderColor:'#fecaca' }
    : t==='warn' ? { color:'#92400e', background:'#fffbeb', borderColor:'#fde68a' }
    : t==='muted' ? { color:'#4a635c', background:'#f6faf8' } : undefined;
  return <div className="ai-stats">{stats.map((s,i)=>(
    <span className="ai-stat" style={tone(s.tone)} key={`${s.label}-${i}`}><b>{s.value}</b>{s.label}</span>
  ))}</div>;
}

function AnswerTable({ table }){
  if(!table?.rows?.length) return null;
  return (
    <div className="table-wrap ai-table">
      <table>
        <thead><tr>{table.columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead>
        <tbody>{table.rows.map((row,r)=>(
          <tr key={r}>{row.map((cell,c)=><td key={c}>{c===0?<b style={{fontSize:'12px'}}>{cell}</b>:cell}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function AnswerCard({ answer, onAsk }){
  if(!answer) return null;
  return (
    <div className="ai-bubble">
      <h4>{answer.title}</h4>
      {answer.summary && <p>{answer.summary}</p>}
      <StatChips stats={answer.stats}/>
      <AnswerTable table={answer.table}/>
      {answer.bullets?.length ? <ul className="ai-bullets">{answer.bullets.map((b,i)=><li key={i}>{b}</li>)}</ul> : null}
      {answer.note && <div className="ai-note">{answer.note}</div>}
      {answer.suggestions?.length ? (
        <div className="ai-suggest">
          {answer.suggestions.slice(0,4).map((s,i)=>(
            <button key={i} className="btn small ghost" onClick={()=>onAsk(s)}>{s}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AIAssistantPage({ data, shop=null, currentUser=null }){
  const [messages,setMessages] = useStored('posi-live-v1-assistant', []);
  const [input,setInput] = useState('');
  const [thinking,setThinking] = useState(false);
  const threadRef = useRef(null);
  const seeded = useRef(false);
  const askRef = useRef(null);

  useEffect(()=>{
    if(seeded.current) return;
    seeded.current = true;
    if(!messages.length){
      setMessages([{ id:`a-${Date.now()}`, role:'assistant', answer:respond('', {...data, currentUser}), at:Date.now() }]);
    }
  },[]);

  useEffect(()=>{
    const el = threadRef.current;
    if(el) el.scrollTop = el.scrollHeight;
  },[messages, thinking]);

  const ask = (text)=>{
    const question = String(text||'').trim();
    if(!question) return;
    setInput('');
    setMessages(prev=>[...prev, { id:`u-${Date.now()}`, role:'user', text:question, at:Date.now() }].slice(-60));
    setThinking(true);
    setTimeout(()=>{
      let answer;
      try{ answer = respond(question, {...data, currentUser}) }
      catch(err){ answer = { title:'I could not read that', summary:'Something in the shop data blocked that answer. Try asking in a different way, for example “how are sales today?”.', suggestions:STARTER_QUESTIONS } }
      setMessages(prev=>[...prev, { id:`a-${Date.now()}`, role:'assistant', answer, at:Date.now() }].slice(-60));
      setThinking(false);
    }, 380);
  };
  askRef.current = ask;

  const clear = ()=>{
    const fresh = { id:`a-${Date.now()}`, role:'assistant', answer:respond('', {...data, currentUser}), at:Date.now() };
    setMessages([fresh]);
  };

  const lastAnswer = useMemo(()=>[...messages].reverse().find(m=>m.role==='assistant')?.answer, [messages]);
  const chips = lastAnswer?.suggestions?.length ? lastAnswer.suggestions : STARTER_QUESTIONS;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Sparkles size={12}/> AI ASSISTANT · OWNER ONLY</div>
          <h1>Ask your shop anything</h1>
          <p>Answers are worked out on this device from your own sales, stock, customer and expense records — no internet needed, nothing is uploaded.</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <span className="kpi" style={{background:'#ecfdf5',color:'#065f46',borderColor:'#a7f3d0'}}><WifiOff size={14}/> Works offline</span>
          <span className="kpi"><ShieldCheck size={14}/> On-device only</span>
          <button className="btn small" onClick={clear} title="Start a fresh conversation"><Trash2 size={14}/> Clear chat</button>
        </div>
      </div>

      <div className="card ai-card">
        <div className="ai-thread" ref={threadRef}>
          {messages.map(m=>(
            m.role==='user' ? (
              <div className="ai-msg user" key={m.id}>
                <div className="ai-avatar user">{currentUser?.initials || <UserRound size={15}/>}</div>
                <div className="ai-bubble user">{m.text}</div>
              </div>
            ) : (
              <div className="ai-msg" key={m.id}>
                <div className="ai-avatar"><Bot size={16}/></div>
                <AnswerCard answer={m.answer} onAsk={(t)=>askRef.current?.(t)}/>
              </div>
            )
          ))}
          {thinking && (
            <div className="ai-msg">
              <div className="ai-avatar"><Bot size={16}/></div>
              <div className="ai-bubble"><span className="ai-thinking"><i/><i/><i/></span> checking your shop records…</div>
            </div>
          )}
        </div>

        <div className="ai-suggest" style={{marginTop:'10px'}}>
          {chips.slice(0,4).map((s,i)=><button key={i} className="btn small ghost" onClick={()=>ask(s)}>{s}</button>)}
        </div>

        <form className="ai-composer" onSubmit={(e)=>{ e.preventDefault(); ask(input) }}>
          <div className="search" style={{flex:1}}>
            <Sparkles size={16}/>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder={`Ask about sales, stock, profit, staff… e.g. “how much did I sell this week?”`} aria-label="Ask the assistant"/>
          </div>
          <button className="btn primary" type="submit" disabled={!input.trim()}><Send size={15}/> Ask</button>
        </form>
        <div className="ai-note" style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'8px'}}>
          <ShieldCheck size={12}/> Owner-only assistant · reads this device’s records only · {shop?.name || 'your shop'}
        </div>
      </div>
    </div>
  );
}
