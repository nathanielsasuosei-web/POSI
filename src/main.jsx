import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText, BarChart3, Gift, MessageSquare,
  Wallet, CreditCard, Banknote, Smartphone, Receipt, Ticket, UserCircle,
  Search, Plus, Minus, X, Check, LogOut, Store, Clock3, TrendingUp, AlertTriangle,
  ArrowRight, ChevronDown, Download, Printer, ShieldCheck, CalendarDays, UserRound,
  CheckCircle2, DollarSign, PiggyBank, Landmark, Mail, Send, Eye, Edit2, Trash2, UserPlus,
  Bell, ClipboardList, History, Coins, AlarmClock, TrendingDown, KeyRound, Lock, EyeOff,
  Wrench, Settings, MoreHorizontal, Sparkles
} from 'lucide-react';
import './style.css';
import { useOfflineSupport, OfflineBanner, OfflineChip } from './offline.jsx';
import {
  DEFAULT_SETTINGS, DEFAULT_MAINTENANCE, TimelinePage, LeadsPage, MaintenancePage, SettingsPage
} from './operations.jsx';
import { AIAssistantPage } from './assistant.jsx';

// Storage keys
const K = {
  products: 'posi-live-v1-products',
  sales: 'posi-live-v1-sales',
  customers: 'posi-live-v1-customers',
  employees: 'posi-live-v1-employees',
  giftCards: 'posi-live-v1-giftcards',
  messages: 'posi-live-v1-messages',
  activities: 'posi-live-v1-activities',
  attendance: 'posi-live-v1-attendance',
  expenses: 'posi-live-v1-expenses',
  stockMoves: 'posi-live-v1-stockmoves',
  settings: 'posi-live-v1-settings',
  maintenance: 'posi-live-v1-maintenance',
};

// helpers
// Enter in a search box keeps the cursor there and selects the text, so the next search replaces it.
const selectOnEnter = (e)=>{ if(e.key==='Enter'){ e.preventDefault(); e.currentTarget.select() } };
const format = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;
const todayKey = () => new Date().toISOString().slice(0,10);
const shortTime = (d=new Date()) => d.toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit',hour12:false});
const readableDate = (v) => v ? new Date(v+'T12:00:00').toLocaleDateString('en-GH',{day:'numeric',month:'short',year:'numeric'}) : '—';
const fullDate = (d=new Date()) => d.toLocaleDateString('en-GH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const uid = (p='id') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const initials = (name) => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const daysAgo = (n) => new Date(Date.now()-n*86400000).toISOString().slice(0,10);
const toMinutes = (t='')=>{
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if(!m) return null;
  let h = Number(m[1]); const min = Number(m[2]); const ap = m[3]?.toLowerCase();
  if(ap==='pm' && h<12) h+=12;
  if(ap==='am' && h===12) h=0;
  return h*60+min;
};
const hoursBetween = (dateKey, inTime, outTime) => {
  const a = toMinutes(inTime), b = toMinutes(outTime);
  if(a==null||b==null) return null;
  return Math.max(0, Number(((b-a)/60).toFixed(2)));
};
const reorderOf = (p) => Number(p?.lowStockAt ?? 5);
// Expiry tracking: items count as "expiring soon" inside this window.
const EXPIRY_SOON_DAYS = 90;
const daysToExpiry = (p) => {
  if(!p?.expiry) return null;
  const d = new Date(`${p.expiry}T12:00:00`);
  if(Number.isNaN(d.getTime())) return null;
  return Math.round((d - new Date(`${todayKey()}T12:00:00`))/86400000);
};
// Sales maths: units bought, cost of goods and profit per sale. Item cost is
// stored on the sale line when available, otherwise looked up from the product.
const saleUnits = (sale) => (sale?.items||[]).reduce((s,it)=>s+Number(it.qty||0),0);
const itemCostOf = (it, products) => {
  const stored = it?.cost ?? it?.unitCost;
  if(stored!==undefined && stored!==null && stored!=='') return Number(stored)||0;
  const prod = (products||[]).find(p=>p.id===it?.productId);
  return Number(prod?.cost||0);
};
const saleCost = (sale, products) => (sale?.items||[]).reduce((s,it)=>s+itemCostOf(it,products)*Number(it.qty||0),0);
const saleProfit = (sale, products) => (sale?.items||[]).reduce((s,it)=>s+(Number(it.unitPrice||0)-itemCostOf(it,products))*Number(it.qty||0),0);

// Per-product rollup of the stock movement log: for every product it sums the
// units, unit cost, value at cost and profit of each movement type (sale,
// restock in, adjustment) plus what the Stock / ± Adj / Edit actions did.
const emptyMoveBucket = () => ({ count:0, units:0, value:0, profit:0, costSum:0 });
const stockRollupFor = (products, stockMoves, ids)=>{
  const wanted = ids ? new Set(ids) : null;
  const rows = new Map();
  (products||[]).forEach(p=>{
    if(wanted && !wanted.has(p.id)) return;
    rows.set(p.id,{
      product:p,
      sale:emptyMoveBucket(), restock:emptyMoveBucket(), adjustment:emptyMoveBucket(),
      actions:{ stockUnits:0, stockClicks:0, adjUnits:0, adjClicks:0, edits:Number(p.edits||0) },
      moves:0,
    });
  });
  (stockMoves||[]).forEach(m=>{
    const row = rows.get(m.productId);
    if(!row) return;
    const qty = Number(m.qty||0);
    const unitCost = Number(m.cost ?? row.product.cost ?? 0);
    const unitPrice = Number(m.unitPrice ?? row.product.price ?? 0);
    const bucket = row[m.type] || row.adjustment;
    bucket.count += 1;
    bucket.units += qty;
    bucket.value += unitCost*qty;
    bucket.costSum += unitCost;
    if(m.type==='sale') bucket.profit += (unitPrice-unitCost)*Math.abs(qty);
    if(m.type==='restock'){ row.actions.stockUnits += Math.abs(qty); row.actions.stockClicks += 1 }
    if(m.type==='adjustment'){ row.actions.adjUnits += qty; row.actions.adjClicks += 1 }
    row.moves += 1;
  });
  return [...rows.values()];
};
const moveTypeLabel = (k)=> k==='sale' ? 'Sale' : k==='restock' ? 'Restock in' : 'Adjustment';
const bucketAvgCost = (b)=> b.units ? (b.value/b.units) : 0;

// 'expired' | 'soon' | 'ok' | 'none' — drives badges, filters and alerts.
const expiryOf = (p) => {
  const days = daysToExpiry(p);
  if(days===null) return {state:'none', days:null, label:'Not set'};
  if(days<0) return {state:'expired', days, label:`Expired ${Math.abs(days)}d ago`};
  if(days===0) return {state:'soon', days, label:'Expires today'};
  if(days<=EXPIRY_SOON_DAYS) return {state:'soon', days, label:`${days}d left`};
  return {state:'ok', days, label:`${days}d left`};
};

const categories = ['All','Pain Relief','Cough & Cold','Antibiotics','Antimalarials','Vitamins','Baby & Mother','Personal Care','First Aid','Devices','Other'];
const expenseCategories = ['Rent','Utilities','Supplies','Transport','Salaries','Maintenance','Marketing','Other'];
const stockMoveTypes = {
  sale: { label:'Sale', color:'#065f46' },
  restock: { label:'Restock in', color:'#1e40af' },
  adjustment: { label:'Adjustment', color:'#92400e' },
};

const SHOP = { name:'Your store', address:'', phone:'' };

const paymentMethods = [
  { id:'Cash', label:'Cash', icon: Banknote, desc:'Cash payment' },
  { id:'MoMo', label:'MoMo', icon: Smartphone, desc:'Mobile Money' },
  { id:'Gift', label:'Gift', icon: Gift, desc:'Gift card' },
];

const walkInCustomers = [{ id:'c1', name:'Walk-in customer', phone:'', email:'', address:'', balance:0, totalSpent:0, visits:0, isWalkIn:true }];
const SETUP_KEY = 'posi-live-v1-setup';

// SHA-256 via Web Crypto, with a deterministic fallback for contexts where
// crypto.subtle is unavailable (non-secure origins). Local-first demo hashing:
// a production deployment must verify passwords on a server (e.g. bcrypt/argon2).
async function hashPassword(password){
  const text = `posi-v1:${String(password)}`;
  try{
    if(globalThis.crypto?.subtle){
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  }catch{}
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i=0;i<text.length;i++){ const ch = text.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return (h2>>>0).toString(16).padStart(8,'0') + (h1>>>0).toString(16).padStart(8,'0');
}
const normalizeUsername = (u) => String(u||'').trim().toLowerCase();
function usePersistent(key, initial){
  const [val,setVal]=useState(()=>{
    try{ const s=localStorage.getItem(key); return s?JSON.parse(s):initial }catch{ return initial }
  });
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(val)) }catch{} },[key,val]);
  return [val,setVal];
}

function App({offline,setup,onRestart}){
  const [products,setProducts]=usePersistent(K.products, []);
  const [sales,setSales]=usePersistent(K.sales, []);
  const [customers,setCustomers]=usePersistent(K.customers, walkInCustomers);
  const [employees,setEmployees]=usePersistent(K.employees, [setup.owner]);
  const [giftCards,setGiftCards]=usePersistent(K.giftCards, []);
  const [messages,setMessages]=usePersistent(K.messages, []);
  const [activities,setActivities]=usePersistent(K.activities, []);
  const [attendance,setAttendance]=usePersistent(K.attendance, []);
  const [expenses,setExpenses]=usePersistent(K.expenses, []);
  const [stockMoves,setStockMoves]=usePersistent(K.stockMoves, []);
  const [settings,setSettings]=usePersistent(K.settings, setup.settings);
  const [maintenance,setMaintenance]=usePersistent(K.maintenance, DEFAULT_MAINTENANCE);
  const shop = {...SHOP,...settings,name:settings.shopName||SHOP.name};
  const discountPercent = Number(settings.discountPercent ?? 10);

  const [userId,setUserId]=useState(()=>{ try{ return sessionStorage.getItem('posi-live-user-id')||null }catch{return null}});
  const [view,setView]=useState('pos');
  const [toast,setToast]=useState('');
  const [success,setSuccess]=useState(null);
  const [online,setOnline]=useState(typeof navigator!=='undefined'?navigator.onLine:true);

  // POS state
  const [search,setSearch]=useState('');
  const [cat,setCat]=useState('All');
  const [cart,setCart]=useState([]);
  const [selectedCustomerId,setSelectedCustomerId]=useState('c1');
  const [discountOn,setDiscountOn]=useState(false);
  const [showPay,setShowPay]=useState(false);
  const [selectedInvoice,setSelectedInvoice]=useState(null);
  const [selectedReceipt,setSelectedReceipt]=useState(null);
  const [editingSale,setEditingSale]=useState(null); // owner correcting a recorded sale
  const [mobileCart,setMobileCart]=useState(false);
  const [mobileMore,setMobileMore]=useState(false);

  // modals
  const [showProductModal,setShowProductModal]=useState(false);
  const [editingProduct,setEditingProduct]=useState(null);
  const [showCustomerModal,setShowCustomerModal]=useState(false);
  const [editingCustomer,setEditingCustomer]=useState(null);
  const [showEmployeeModal,setShowEmployeeModal]=useState(false);
  const [editingEmployee,setEditingEmployee]=useState(null);
  const [showGiftModal,setShowGiftModal]=useState(false);
  const [showMessageModal,setShowMessageModal]=useState(false);
  const [showExpenseModal,setShowExpenseModal]=useState(false);
  const [editingExpense,setEditingExpense]=useState(null);
  const [stockModal,setStockModal]=useState(null); // {product, mode:'restock'|'adjust'}
  const [alertsOpen,setAlertsOpen]=useState(false);
  const [staffSales,setStaffSales]=useState(null); // employee whose sales history is open
  const [credentialsFor,setCredentialsFor]=useState(null); // employee whose login the owner is managing
  const [showMyPassword,setShowMyPassword]=useState(false); // signed-in user changing their own password
  const [filterSales,setFilterSales]=useState({search:'',payment:'All',date:'All',cashier:'All'});

  const currentUser = employees.find(e=>e.id===userId) || null;
  const cashierId = currentUser?.id;
  const isOwner = currentUser?.role==='owner';
  const role = currentUser ? (isOwner ? 'owner' : 'cashier') : null;

  useEffect(()=>{
    const on=()=>setOnline(navigator.onLine);
    window.addEventListener('online',on); window.addEventListener('offline',on);
    return ()=>{window.removeEventListener('online',on);window.removeEventListener('offline',on)}
  },[]);
  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),2800); return ()=>clearTimeout(t)} },[toast]);
  useEffect(()=>{ if(success){ const t=setTimeout(()=>setSuccess(null),6000); return ()=>clearTimeout(t)} },[success]);

  const flash = (m)=>setToast(m);
  const landedRef = useRef(false);
  useEffect(()=>{
    if(landedRef.current || !currentUser) return;
    landedRef.current = true;
    setView(currentUser.role==='owner' ? 'dashboard' : 'pos');
  },[currentUser]);

  // Signing in as someone else on this device must not carry the previous
  // worker's sale filters, open invoice, receipt or correction form over.
  useEffect(()=>{
    setSelectedInvoice(null); setSelectedReceipt(null); setEditingSale(null);
    setFilterSales({search:'',payment:'All',date:'All',cashier:'All'});
    const emp = employees.find(e=>e.id===userId);
    setView(emp ? (emp.role==='owner' ? 'dashboard' : 'pos') : 'pos');
  },[userId]);

  // Username + password sign-in. Only accounts the owner created (Staff
  // Tracking) can sign in; there is no self-registration.
  const signIn = async (username,password)=>{
    const emp = employees.find(e=>normalizeUsername(e.username)===normalizeUsername(username));
    if(!emp) return 'No account with that username. Ask the owner to create your account.';
    if(!emp.passwordHash) return 'This account has no password yet. Ask the owner to set one.';
    if(await hashPassword(password) !== emp.passwordHash) return 'Wrong password. Try again or ask the owner to reset it.';
    try{ sessionStorage.setItem('posi-live-user-id',emp.id); sessionStorage.removeItem('pos-role'); sessionStorage.removeItem('pos-cashier') }catch{}
    setUserId(emp.id); setView(emp.role==='owner'?'dashboard':'pos');
    return null;
  };
  const signOut = ()=>{
    try{ sessionStorage.removeItem('posi-live-user-id'); sessionStorage.removeItem('pos-role'); sessionStorage.removeItem('pos-cashier') }catch{}
    setUserId(null); setCart([]); setView('pos');
    // Never leave another worker's invoice/receipt or sale edit open for the
    // next person who signs in on this device.
    setSelectedInvoice(null); setSelectedReceipt(null); setEditingSale(null);
    setFilterSales({search:'',payment:'All',date:'All',cashier:'All'});
  };

  // Owner-only: change any employee's username and/or reset their password.
  // Also used by the owner for their own account from Staff Tracking.
  const saveCredentials = async (emp, {username,password})=>{
    if(!isOwner) { flash('Only the owner can change usernames and passwords'); return false }
    const uname = normalizeUsername(username);
    if(!uname) { flash('Username is required'); return false }
    if(employees.some(e=>e.id!==emp.id && normalizeUsername(e.username)===uname)){ flash(`Username “${uname}” is already used by another account`); return false }
    const patch = { username: uname };
    if(password) patch.passwordHash = await hashPassword(password);
    setEmployees(es=>es.map(e=>e.id===emp.id?{...e,...patch}:e));
    addActivity({type:'staff',title:`${currentUser?.name} updated login for ${emp.name}`,detail:password?'Username and password changed':'Username changed'});
    flash(password ? `Login updated for ${emp.name} — new username and password saved` : `Username for ${emp.name} changed to ${uname}`);
    setCredentialsFor(null);
    return true;
  };

  // Any signed-in user changing their OWN password must prove the current one.
  const changeMyPassword = async (currentPassword,newPassword)=>{
    if(!currentUser?.passwordHash) return 'This account has no password yet. Ask the owner to set one.';
    if(await hashPassword(currentPassword) !== currentUser.passwordHash) return 'Current password is wrong.';
    const passwordHash = await hashPassword(newPassword);
    setEmployees(es=>es.map(e=>e.id===currentUser.id?{...e,passwordHash}:e));
    flash('Your password has been changed');
    setShowMyPassword(false);
    return null;
  };

  const addActivity = (a)=> setActivities(p=>[{id:uid('act'),...a,date:todayKey(),time:shortTime()},...p].slice(0,120));

  // Settings, maintenance and portable local-data export
  const saveSettings = (next)=>{
    setSettings(next);
    addActivity({type:'settings',title:`${currentUser?.name||'Owner'} updated store settings`,detail:'Store profile, sales and receipt defaults'});
    flash('Settings saved on this device');
  };
  const saveMaintenance = (record)=>{
    const exists = maintenance.some(m=>m.id===record.id);
    setMaintenance(list=>exists ? list.map(m=>m.id===record.id?record:m) : [record,...list]);
    addActivity({type:'maintenance',title:`${exists?'Maintenance updated':'Maintenance scheduled'} · ${record.asset}`,detail:`${record.title} · due ${readableDate(record.dueDate)}`});
    flash(exists?'Maintenance plan updated':'Maintenance scheduled');
  };
  const completeMaintenance = (record,completion)=>{
    const completed = {...record,status:'completed',completedDate:completion.completedDate,actualCost:completion.actualCost,completionNotes:completion.notes};
    setMaintenance(list=>{
      const updated = list.map(m=>m.id===record.id?completed:m);
      if(!completion.scheduleNext) return updated;
      const next = {
        ...record,id:uid('mnt'),status:'scheduled',dueDate:completion.nextDue,lastCompleted:completion.completedDate,
        cost:completion.actualCost,actualCost:undefined,completedDate:undefined,completionNotes:'',
      };
      return [next,...updated];
    });
    if(completion.logExpense && completion.actualCost>0){
      setExpenses(es=>[{id:uid('x'),date:completion.completedDate,category:'Maintenance',amount:completion.actualCost,payment:'Cash',note:`${record.asset} — ${record.title}`,by:currentUser?.name||'Owner'},...es]);
    }
    addActivity({type:'maintenance',title:`Maintenance completed · ${record.asset}`,detail:`${record.title} · ${format(completion.actualCost)}${completion.scheduleNext?` · next ${readableDate(completion.nextDue)}`:''}`});
    flash(completion.scheduleNext?`Service completed · next visit ${readableDate(completion.nextDue)}`:'Maintenance completed');
  };
  const deleteMaintenance = (id)=>{
    const record = maintenance.find(m=>m.id===id);
    setMaintenance(list=>list.filter(m=>m.id!==id));
    addActivity({type:'maintenance',title:`Maintenance record removed · ${record?.asset||'Equipment'}`,detail:record?.title||''});
    flash('Maintenance record deleted');
  };
  const exportShopData = ()=>{
    const payload = {
      app:'POSI',version:3,exportedAt:new Date().toISOString(),
      data:{products,sales,customers,employees,giftCards,messages,activities,attendance,expenses,stockMoves,maintenance,settings},
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const a=document.createElement('a'); a.href=url; a.download=`posi-shop-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(url);
    addActivity({type:'settings',title:`${currentUser?.name||'Owner'} exported shop data`,detail:'Complete JSON backup downloaded'});
    flash('Shop data export downloaded');
  };

  // Low stock alerts
  const lowStockItems = useMemo(()=> products
    .filter(p=>p.stock<=reorderOf(p))
    .sort((a,b)=>a.stock-b.stock),[products]);

  // Stock movements
  const logStockMove = (product, type, qty, note)=> {
    setStockMoves(sm=>[{id:uid('sm'),productId:product.id,productName:product.name,type,qty,cost:Number(product.cost||0),unitPrice:Number(product.price||0),date:todayKey(),time:shortTime(),by:currentUser?.name||'Staff',note:note||''},...sm].slice(0,300));
  };

  const applyStockChange = ({product, mode, qty, note, cost})=>{
    if(!isOwner){ flash('Only the owner can manage stock'); return }
    const amount = Math.floor(Number(qty));
    if(!product || !amount){ flash('Enter a quantity'); return }
    const delta = mode==='restock' ? Math.abs(amount) : -Math.abs(amount);
    setProducts(prev=>prev.map(p=>{
      if(p.id!==product.id) return p;
      return {...p, stock: Math.max(0, p.stock + delta), ...(cost!==undefined && cost!=='' ? {cost:Number(cost)} : {})};
    }));
    logStockMove(product, mode, delta, note);
    addActivity({type:'stock',title:`${currentUser?.name} ${mode==='restock'?'restocked':'adjusted'} ${product.name}`,detail:`${delta>0?'+':''}${delta} units${note?` · ${note}`:''}`});
    flash(mode==='restock' ? `${product.name} restocked (+${delta})` : `${product.name} adjusted (${delta})`);
    setStockModal(null);
  };

  // Expenses
  const saveExpense = (exp)=>{
    if(editingExpense){
      setExpenses(es=>es.map(e=>e.id===exp.id?exp:e));
      flash('Expense updated');
    }else{
      setExpenses(es=>[exp,...es]);
      flash('Expense recorded');
    }
    addActivity({type:'expense',title:`${currentUser?.name} recorded expense`,detail:`${format(exp.amount)} · ${exp.category}`});
    setShowExpenseModal(false); setEditingExpense(null);
  };
  const deleteExpense = (id)=>{
    if(!isOwner){ flash('Only owner can delete expenses'); return }
    setExpenses(es=>es.filter(e=>e.id!==id));
    flash('Expense deleted');
  };

  // Staff attendance (clock in / out)
  const todayAttendance = attendance.find(a=>a.employeeId===currentUser?.id && a.date===todayKey());
  const toggleClock = ()=>{
    if(!todayAttendance){
      setAttendance(at=>[{id:uid('at'),employeeId:currentUser.id,name:currentUser.name,date:todayKey(),in:shortTime(),out:null,hours:null},...at]);
      addActivity({type:'staff',title:`${currentUser.name} clocked in`,detail:shortTime()});
      flash(`Clocked in at ${shortTime()}`);
    }else if(!todayAttendance.out){
      const out = shortTime();
      const hours = hoursBetween(todayAttendance.date, todayAttendance.in, out);
      setAttendance(at=>at.map(a=>a.id===todayAttendance.id?{...a,out,hours}:a));
      addActivity({type:'staff',title:`${currentUser.name} clocked out`,detail:`${hours??0} hours today`});
      flash(`Clocked out · ${hours??0} hours today`);
    }else{
      flash('Already clocked out for today');
    }
  };

  // Products
  const saveProduct = (prod)=>{
    if(!isOwner){ flash('Only the owner can manage product records'); return }
    if(editingProduct){
      const prevStock = editingProduct.stock||0;
      const record = {...prod, edits:Number(editingProduct.edits||0)+1, updatedAt:new Date().toISOString()};
      setProducts(p=>p.map(x=>x.id===record.id?record:x));
      if(prod.stock!==prevStock) logStockMove(prod,'adjustment',prod.stock-prevStock,'Edited in product record');
      addActivity({type:'product',title:`${currentUser?.name} updated product`,detail:prod.name});
      flash(`${prod.name} updated`);
    }else{
      setProducts(p=>[prod,...p]);
      if(prod.stock>0) logStockMove(prod,'restock',prod.stock,'Opening stock');
      addActivity({type:'product',title:`${currentUser?.name} added product`,detail:`${prod.name} · ${prod.stock} units`});
      flash(`${prod.name} added to inventory`);
    }
    setShowProductModal(false); setEditingProduct(null);
  };
  const deleteProduct = (id)=>{
    if(!isOwner){ flash('Only owner can delete products'); return }
    setProducts(p=>p.filter(x=>x.id!==id));
    flash('Product removed');
  };

  // Customers
  const saveCustomer = (cust)=>{
    if(editingCustomer){
      setCustomers(cs=>cs.map(c=>c.id===cust.id?cust:c));
      flash(`${cust.name} updated`);
    }else{
      setCustomers(cs=>[cust,...cs]);
      flash(`${cust.name} added`);
    }
    setShowCustomerModal(false); setEditingCustomer(null);
  };
  const payAccount = (customerId, amount)=>{
    setCustomers(cs=>cs.map(c=>{
      if(c.id!==customerId) return c;
      return {...c,balance:Math.max(0, Number(c.balance)-Number(amount))};
    }));
    addActivity({type:'account',title:`Customer payment received`,detail:`${format(amount)} · ${customers.find(c=>c.id===customerId)?.name}`});
    flash(`Payment of ${format(amount)} recorded`);
  };

  // Employees — accounts are created only by the owner (this whole page is
  // owner-only, and we double-check here). Usernames must be unique.
  const saveEmployee = (emp)=>{
    if(!isOwner){ flash('Only the owner can create or change staff accounts'); return }
    const uname = normalizeUsername(emp.username);
    if(!uname){ flash('Every account needs a username'); return }
    if(employees.some(e=>e.id!==emp.id && normalizeUsername(e.username)===uname)){ flash(`Username “${uname}” is already used by another account`); return }
    if(editingEmployee){
      // Preserve the existing password unless the owner typed a new one.
      const existing = employees.find(e=>e.id===emp.id);
      setEmployees(es=>es.map(e=>e.id===emp.id?{...emp,username:uname,passwordHash:emp.passwordHash||existing?.passwordHash}:e));
      flash(`${emp.name} updated`);
    }else{
      if(!emp.passwordHash){ flash('New accounts need a starting password'); return }
      setEmployees(es=>[{...emp,username:uname},...es]);
      flash(`${emp.name} added as ${emp.role} — they can now sign in as “${uname}”`);
    }
    setShowEmployeeModal(false); setEditingEmployee(null);
  };

  // Gift Cards
  const saveGiftCard = (gc)=>{
    setGiftCards(gs=>[gc,...gs]);
    flash(`Gift card ${gc.code} created with ${format(gc.balance)}`);
    setShowGiftModal(false);
  };

  // Messages
  const sendMessage = (msg)=>{
    setMessages(m=>[msg,...m]);
    flash(`Message sent to ${msg.toName}`);
    setShowMessageModal(false);
  };
  const markRead = (msgId, empId)=>{
    setMessages(ms=>ms.map(m=>{
      if(m.id!==msgId) return m;
      if(m.readBy?.includes(empId)) return m;
      return {...m,readBy:[...(m.readBy||[]),empId]};
    }));
  };

  // POS logic
  const filteredProducts = useMemo(()=>{
    return products.filter(p=>{
      const matchCat = cat==='All' || p.category===cat;
      const q = search.toLowerCase().trim();
      const text = `${p.name} ${p.brand||''} ${p.sku} ${p.category} ${p.barcode||''}`.toLowerCase();
      return matchCat && text.includes(q);
    });
  },[products,cat,search]);

  const addToCart = (product)=>{
    if(product.stock<1){ flash(`${product.name} out of stock`); return }
    if(expiryOf(product).state==='expired'){ flash(`${product.name} has expired — cannot be sold`); return }
    setCart(prev=>{
      const ex = prev.find(i=>i.id===product.id);
      if(ex){
        if(ex.qty>=product.stock){ flash(`Only ${product.stock} available`); return prev }
        return prev.map(i=>i.id===product.id?{...i,qty:i.qty+1}:i);
      }
      return [...prev,{...product,qty:1}];
    });
    flash(`${product.name} added`);
  };
  const updateQty = (id, delta)=>{
    setCart(prev=>prev.map(i=>{
      if(i.id!==id) return i;
      const prod = products.find(p=>p.id===id);
      const max = prod?prod.stock: i.stock;
      return {...i,qty:Math.max(1, Math.min(i.qty+delta, max))};
    }));
  };
  const removeFromCart = (id)=> setCart(prev=>prev.filter(i=>i.id!==id));

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const discount = discountOn ? subtotal*(discountPercent/100) : 0;
  const total = subtotal - discount;
  const itemCount = cart.reduce((s,i)=>s+i.qty,0);
  const selectedCustomer = customers.find(c=>c.id===selectedCustomerId) || customers[0];

  const completeSale = (payment, detail)=>{
    if(!cart.length) return;
    if(payment==='Gift'){
      const gc = giftCards.find(g=>g.code===detail.code && g.status==='active');
      if(!gc){ flash('Invalid gift card'); return }
      if(gc.balance < total){ flash(`Gift card balance ${format(gc.balance)} insufficient`); return }
    }

    const saleId = `POS-${String(Date.now()).slice(-6)}`;
    const invoiceNumber = `${settings.invoicePrefix || 'INV'}-${String(Date.now()).slice(-6)}`;
    const sale = {
      id:saleId, invoiceNumber,
      date:todayKey(), time:shortTime(),
      cashier: currentUser?.name || 'Cashier',
      cashierId: currentUser?.id || cashierId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      items: cart.map(i=>({productId:i.id,name:i.name,qty:i.qty,unitPrice:i.price,cost:Number(i.cost||0),lineTotal:i.price*i.qty})),
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      tax:0,
      total: Number(total.toFixed(2)),
      payment, paymentDetail: detail,
      itemCount, status:'paid'
    };

    // update products stock + log movements + watch for low stock
    setProducts(prev=>prev.map(p=>{
      const sold = cart.find(c=>c.id===p.id);
      if(!sold) return p;
      return {...p, stock: Math.max(0, p.stock - sold.qty)};
    }));
    const soldMoves = cart.map(i=>({id:uid('sm'),productId:i.id,productName:i.name,type:'sale',qty:-i.qty,cost:Number(i.cost||0),unitPrice:Number(i.price||0),date:todayKey(),time:shortTime(),by:currentUser?.name||'Staff',note:saleId}));
    setStockMoves(sm=>[...soldMoves,...sm].slice(0,300));
    const lowNow = cart.filter(i=>{
      const prod = products.find(p=>p.id===i.id);
      return prod && (prod.stock - i.qty) <= reorderOf(prod);
    }).map(i=>i.name);

    // update customer spent for non walk-in
    if(!selectedCustomer.isWalkIn){
      setCustomers(cs=>cs.map(c=> c.id===selectedCustomer.id ? {...c,totalSpent:Number(c.totalSpent)+Number(total),visits:(c.visits||0)+1} : c));
    }

    // handle gift card deduction
    if(payment==='Gift'){
      setGiftCards(gs=>gs.map(g=>{
        if(g.code!==detail.code) return g;
        const newBal = Number(g.balance)-Number(total);
        return {...g, balance: Math.max(0,newBal), status: newBal<=0.01?'used':'active'};
      }));
    }

    setSales(prev=>[sale,...prev]);
    addActivity({type:'sale',title:`${sale.cashier} completed a sale`,detail:`${format(total)} · ${payment}`});
    setCart([]); setDiscountOn(false); setShowPay(false); setMobileCart(false);
    setSuccess(sale);
    if(isOwner && lowNow.length){ setTimeout(()=>flash(`Low stock alert: ${lowNow.join(', ')} — restock soon`), 400); }
    if(!isOwner) flash(`Sale ${invoiceNumber} recorded — today's sales are under Today's Sales`);
  };

  // A signed-in employee may only open their own sales from today. The owner
  // can open any sale from any date.
  const canAccessSale = (sale)=> !!sale && (isOwner || (((sale.cashierId===currentUser?.id) || (sale.cashier===currentUser?.name)) && sale.date===todayKey()));

  // Owner correction of a recorded sale: seller, customer, payment, date/time,
  // line items (quantity and unit price), discount, plus a mandatory reason.
  // Stock, customer spend and gift-card balances are all reconciled.
  const saveSaleEdit = (original, form)=>{
    if(!isOwner){ flash('Only the owner can correct or change a recorded sale'); return false }
    if(!original) return false;
    const items = (form.items||[])
      .map(it=>({productId:it.productId, name:it.name, qty:Number(it.qty||0), unitPrice:Number(it.unitPrice||0), cost:Number(it.cost||0)}))
      .filter(it=>it.qty>0)
      .map(it=>({...it, lineTotal:Number((it.unitPrice*it.qty).toFixed(2))}));
    if(!items.length){ flash('A sale needs at least one item'); return false }
    const reason = String(form.reason||'').trim();
    if(reason.length<3){ flash('Add a short reason for this correction'); return false }
    const subtotal = Number(items.reduce((s,it)=>s+it.lineTotal,0).toFixed(2));
    const discount = Math.min(subtotal, Math.max(0, Number(form.discount||0)));
    const total = Number((subtotal-discount).toFixed(2));
    const itemCount = items.reduce((s,it)=>s+it.qty,0);
    const customer = customers.find(c=>c.id===form.customerId) || customers[0];
    const seller = employees.find(e=>e.id===form.cashierId) || employees.find(e=>e.name===original.cashier) || null;
    const payment = form.payment || original.payment;
    const date = form.date || original.date;
    const time = form.time || original.time;

    // Gift-card payments must stay covered by the card after the correction.
    let giftCode = '';
    if(payment==='Gift'){
      giftCode = String(form.giftCode ?? original.paymentDetail?.code ?? '').trim();
      const card = giftCards.find(g=>g.code===giftCode);
      if(!card){ flash('Choose a valid gift card code for a gift-card sale'); return false }
      const refundable = original.payment==='Gift' && original.paymentDetail?.code===giftCode ? Number(original.total||0) : 0;
      if(Number(card.balance||0)+refundable < total){ flash(`Gift card ${giftCode} only has ${format(Number(card.balance||0)+refundable)} available`); return false }
      setGiftCards(gs=>gs.map(g=>{
        let balance = Number(g.balance||0);
        if(original.payment==='Gift' && original.paymentDetail?.code===g.code) balance += Number(original.total||0);
        if(g.code===giftCode) balance -= total;
        balance = Math.max(0, Number(balance.toFixed(2)));
        return {...g, balance, status: balance<=0.01?'used':'active'};
      }));
    } else if(original.payment==='Gift' && original.paymentDetail?.code){
      // Payment corrected away from a gift card — put the money back on the card.
      const code = original.paymentDetail.code;
      setGiftCards(gs=>gs.map(g=>{
        if(g.code!==code) return g;
        const balance = Number((Number(g.balance||0)+Number(original.total||0)).toFixed(2));
        return {...g, balance, status:'active'};
      }));
    }

    // Stock reconciliation: the difference between the old and corrected
    // quantities goes back in (or comes out of) inventory, and is logged.
    const qtyByProduct = (list)=>{
      const map = new Map();
      (list||[]).forEach(it=>{ if(it.productId) map.set(it.productId,(map.get(it.productId)||0)+Number(it.qty||0)) });
      return map;
    };
    const oldQty = qtyByProduct(original.items);
    const newQty = qtyByProduct(items);
    const touched = new Set([...oldQty.keys(),...newQty.keys()]);
    const stockLog = []; const lowNow = [];
    const nextProducts = products.map(p=>{
      if(!touched.has(p.id)) return p;
      const delta = (newQty.get(p.id)||0)-(oldQty.get(p.id)||0);
      if(!delta) return p;
      const stock = Math.max(0, Number(p.stock||0)-delta);
      stockLog.push({productId:p.id, productName:p.name, qty:-delta, cost:Number(p.cost||0), unitPrice:Number(p.price||0)});
      if(stock<=reorderOf(p)) lowNow.push(p.name);
      return {...p, stock};
    });
    if(stockLog.length){
      setProducts(nextProducts);
      setStockMoves(sm=>[
        ...stockLog.map(m=>({id:uid('sm'),productId:m.productId,productName:m.productName,type:'adjustment',qty:m.qty,cost:m.cost,unitPrice:m.unitPrice,date:todayKey(),time:shortTime(),by:currentUser?.name||'Owner',note:`${original.invoiceNumber} corrected`})),
        ...sm,
      ].slice(0,300));
    }

    // Customer spend/visit figures follow the corrected sale.
    setCustomers(cs=>cs.map(c=>{
      if(c.isWalkIn) return c;
      const wasCustomer = c.id===original.customerId;
      const isCustomer = c.id===customer?.id;
      if(!wasCustomer && !isCustomer) return c;
      let totalSpent = Number(c.totalSpent||0);
      let visits = Number(c.visits||0);
      if(wasCustomer) totalSpent -= Number(original.total||0);
      if(isCustomer) totalSpent += total;
      if(wasCustomer && !isCustomer) visits = Math.max(0,visits-1);
      if(isCustomer && !wasCustomer) visits += 1;
      return {...c, totalSpent:Math.max(0,Number(totalSpent.toFixed(2))), visits};
    }));

    const correction = {
      id:uid('cor'),
      at:new Date().toISOString(),
      by:currentUser?.name||'Owner',
      reason,
      before:{total:Number(original.total||0),seller:original.cashier,payment:original.payment,date:original.date,time:original.time,customer:original.customerName,units:saleUnits(original)},
      after:{total,seller:seller?.name||original.cashier,payment,date,time,customer:customer?.name||original.customerName,units:itemCount},
    };
    const nextSale = {
      ...original,
      date, time,
      cashier: seller?.name || original.cashier,
      cashierId: seller?.id || original.cashierId,
      customerId: customer?.id || original.customerId,
      customerName: customer?.name || original.customerName,
      items, subtotal, discount, total, itemCount,
      payment,
      paymentDetail: payment==='Gift' ? {...(original.paymentDetail||{}), code:giftCode} : {},
      status:'paid',
      editedAt:new Date().toISOString(),
      editedBy:currentUser?.name||'Owner',
      editCount:Number(original.editCount||0)+1,
      corrections:[...(original.corrections||[]), correction],
    };
    setSales(prev=>prev.map(s=>s.id===original.id?nextSale:s));
    setEditingSale(null);
    setSelectedInvoice(prev=>prev&&prev.id===original.id?nextSale:prev);
    setSelectedReceipt(prev=>prev&&prev.id===original.id?nextSale:prev);
    addActivity({
      type:'sale',
      title:`${currentUser?.name||'Owner'} corrected sale ${original.invoiceNumber}`,
      detail:`${format(original.total)} → ${format(total)} · ${reason}`,
    });
    flash(`${original.invoiceNumber} corrected — stock, totals and history updated`);
    if(lowNow.length) setTimeout(()=>flash(`Low stock alert: ${lowNow.join(', ')} — restock soon`), 500);
    return true;
  };

  // Owner deletion of a recorded sale: inventory is restored, the sale's stock
  // movements are removed, customer spend and gift-card balances are reversed.
  const deleteSale = (sale)=>{
    if(!isOwner){ flash('Only the owner can delete a recorded sale'); return false }
    if(!sale) return false;
    const restored = [];
    const nextProducts = products.map(p=>{
      const back = (sale.items||[]).filter(it=>it.productId===p.id).reduce((s,it)=>s+Number(it.qty||0),0);
      if(!back) return p;
      restored.push({productId:p.id,productName:p.name,qty:back,cost:Number(p.cost||0),unitPrice:Number(p.price||0)});
      return {...p, stock:Number(p.stock||0)+back};
    });
    if(restored.length){
      setProducts(nextProducts);
      setStockMoves(sm=>[
        ...restored.map(m=>({id:uid('sm'),productId:m.productId,productName:m.productName,type:'adjustment',qty:m.qty,cost:m.cost,unitPrice:m.unitPrice,date:todayKey(),time:shortTime(),by:currentUser?.name||'Owner',note:`${sale.invoiceNumber} deleted — stock restored`})),
        ...sm.filter(m=>!(m.type==='sale' && (m.note===sale.id || m.note===sale.invoiceNumber))),
      ].slice(0,300));
    } else {
      setStockMoves(sm=>sm.filter(m=>!(m.type==='sale' && (m.note===sale.id || m.note===sale.invoiceNumber))));
    }
    setCustomers(cs=>cs.map(c=>{
      if(c.isWalkIn || c.id!==sale.customerId) return c;
      return {
        ...c,
        totalSpent:Math.max(0,Number((Number(c.totalSpent||0)-Number(sale.total||0)).toFixed(2))),
        visits:Math.max(0,Number(c.visits||0)-1),
      };
    }));
    if(sale.payment==='Gift' && sale.paymentDetail?.code){
      const code = sale.paymentDetail.code;
      setGiftCards(gs=>gs.map(g=> g.code!==code ? g : ({...g, balance:Number((Number(g.balance||0)+Number(sale.total||0)).toFixed(2)), status:'active'})));
    }
    setSales(prev=>prev.filter(s=>s.id!==sale.id));
    setEditingSale(null);
    setSelectedInvoice(prev=>prev&&prev.id===sale.id?null:prev);
    setSelectedReceipt(prev=>prev&&prev.id===sale.id?null:prev);
    addActivity({
      type:'sale',
      title:`${currentUser?.name||'Owner'} deleted sale ${sale.invoiceNumber}`,
      detail:`${format(sale.total)} · ${sale.cashier} · stock restored`,
    });
    flash(`${sale.invoiceNumber} deleted — stock and customer totals restored`);
    return true;
  };

  const todaySales = useMemo(()=> sales.filter(s=>s.date===todayKey()),[sales]);
  const visibleSales = useMemo(()=>{
    // Owner sees every employee's sales. Workers see only their own sales made today.
    let list = isOwner ? sales : sales.filter(s=>(s.cashierId===currentUser?.id || s.cashier===currentUser?.name) && s.date===todayKey());
    if(filterSales.search){
      const q=filterSales.search.toLowerCase();
      list = list.filter(s=> `${s.invoiceNumber} ${s.customerName} ${s.cashier} ${s.payment}`.toLowerCase().includes(q));
    }
    if(filterSales.payment!=='All') list=list.filter(s=>s.payment===filterSales.payment);
    if(isOwner && filterSales.cashier && filterSales.cashier!=='All'){
      const emp = employees.find(e=>e.id===filterSales.cashier);
      list = list.filter(s=>s.cashierId===filterSales.cashier || (emp && s.cashier===emp.name));
    }
    if(isOwner && filterSales.date!=='All'){
      const now=new Date();
      if(filterSales.date==='Today') list=list.filter(s=>s.date===todayKey());
      if(filterSales.date==='Week'){ const weekAgo=new Date(); weekAgo.setDate(now.getDate()-7); const wk=weekAgo.toISOString().slice(0,10); list=list.filter(s=>s.date>=wk) }
      if(filterSales.date==='Month'){ const m=now.toISOString().slice(0,7); list=list.filter(s=>s.date.startsWith(m)) }
    }
    return list;
  },[sales,isOwner,currentUser,filterSales,employees]);

  const navOwner = [
    {id:'dashboard',label:'Dashboard',icon:LayoutDashboard},
    {id:'pos',label:'Point of Sale',icon:ShoppingCart},
    {id:'inventory',label:'Stock & Items',icon:Package},
    {id:'leads',label:'Customer Leads',icon:TrendingUp},
    {id:'customers',label:'Customers',icon:Users},
    {id:'invoices',label:'Sales History',icon:FileText},
    {id:'expenses',label:'Expenses',icon:Coins},
    {id:'maintenance',label:'Maintenance',icon:Wrench},
    {id:'timeline',label:'Activity Timeline',icon:History},
    {id:'gift',label:'Gift Cards & Money Owed',icon:Gift},
    {id:'staff',label:'Staff Tracking',icon:UserCircle},
    {id:'reports',label:'Business Reports',icon:BarChart3},
    {id:'assistant',label:'AI Assistant',icon:Sparkles},
    {id:'messages',label:'Messages',icon:MessageSquare},
    {id:'settings',label:'Settings',icon:Settings},
  ];
  const navCashier = [
    {id:'pos',label:'POS',icon:ShoppingCart},
    {id:'inventory',label:'Items',icon:Package},
    {id:'customers',label:'Customers',icon:Users},
    {id:'invoices',label:'Today’s Sales',icon:FileText},
    {id:'messages',label:'Messages',icon:MessageSquare},
  ];
  const nav = isOwner?navOwner:navCashier;

  if(!currentUser) return <LoginScreen onSignIn={signIn} shop={shop} onRestart={onRestart} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><div className="brand-mark">P</div><div className="brand-copy"><b>POSI<span>.</span></b><small>SHOP MANAGER</small></div></a>
        <div className="shop-card"><div className="shop-icon"><Store size={16}/></div><div className="shop-copy"><b>{shop.name}</b><small>{shop.address}</small></div><span className="shop-dot"/></div>

        <div className="nav-section nav-scroll">
          <div className="nav-label">MAIN MENU</div>
          <div className="nav-list">
            {nav.map(n=>(
              <button key={n.id} className={`nav-item ${view===n.id?'active':''}`} onClick={()=>setView(n.id)}>
                <n.icon size={18}/><span>{n.label}</span>
                {n.id==='inventory' && isOwner && lowStockItems.length>0 && <span className="badge">{lowStockItems.length}</span>}
                {n.id==='maintenance' && maintenance.filter(m=>m.status!=='completed' && m.dueDate<=todayKey()).length>0 && <span className="badge">{maintenance.filter(m=>m.status!=='completed' && m.dueDate<=todayKey()).length}</span>}
                {n.id==='messages' && messages.filter(m=> (m.to==='all' || m.to===currentUser?.id) && !m.readBy?.includes(currentUser?.id)).length>0 && <span className="badge">{messages.filter(m=> (m.to==='all' || m.to===currentUser?.id) && !m.readBy?.includes(currentUser?.id)).length}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-label">PAYMENT TYPES</div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',padding:'0 6px'}}>
            {paymentMethods.map(pm=>(
              <span key={pm.id} className={`badge-pay ${pm.id.toLowerCase()}`} style={{fontSize:'10px',padding:'4px 8px',borderRadius:'20px'}}>{pm.label}</span>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          {isOwner && <div className="owner-note"><ShieldCheck size={16} style={{flex:'none',marginTop:'1px'}}/><span><b>Owner control</b><br/>All sales combine to the owner</span></div>}
          <div className="profile">
            <div className={`avatar ${isOwner?'owner':'cashier'}`}>{currentUser?.initials||initials(currentUser?.name||'U')}</div>
            <div><b>{currentUser?.name}</b><small>{isOwner?'Store Owner':currentUser?.role}</small></div>
            <span className="role-pill">{isOwner?'OWNER':'CASHIER'}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb"><span>{shop.name}</span><span>›</span><b>{nav.find(n=>n.id===view)?.label||view}</b></div>
          <div className="top-actions">
            <OfflineChip status={offline.status} online={online}/>
            <span className="today"><Clock3 size={14}/>{fullDate()}</span>
            <button className={`btn small ${todayAttendance && !todayAttendance.out?'primary':'ghost'}`} onClick={toggleClock} title="Staff clock in / out">
              <AlarmClock size={14}/><span className="clock-text">{todayAttendance ? (todayAttendance.out?`Out ${todayAttendance.out}`:`In ${todayAttendance.in}`) : 'Clock in'}</span>
            </button>
            {isOwner && <div className="bell-wrap">
              <button className="btn icon small bell" onClick={()=>setAlertsOpen(o=>!o)} title="Low stock alerts">
                <Bell size={14}/>{lowStockItems.length>0 && <span className="bell-badge">{lowStockItems.length}</span>}
              </button>
              {alertsOpen && <>
                <div className="pop-backdrop" onClick={()=>setAlertsOpen(false)}/>
                <div className="alert-pop">
                  <div className="alert-pop-head"><b>Low stock alerts</b><small>{lowStockItems.length} item{lowStockItems.length===1?'':'s'} at or below reorder level</small></div>
                  <div className="alert-pop-list">
                    {lowStockItems.length? lowStockItems.map(p=>(
                      <div key={p.id} className="alert-row">
                        <div style={{flex:1,minWidth:0}}><b style={{fontSize:'11px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{p.stock} left · reorder at {reorderOf(p)}{expiryOf(p).state!=='none'?` · exp ${readableDate(p.expiry)}${expiryOf(p).state==='expired'?' (expired)':expiryOf(p).state==='soon'?` (${expiryOf(p).label})`:''}`:''}</small></div>
                        <span className={`status ${p.stock===0?'bad':'warn'}`}><i/>{p.stock===0?'Out':'Low'}</span>
                        {isOwner && <button className="btn small" onClick={()=>{setStockModal({product:p,mode:'restock'});setAlertsOpen(false)}}>Restock</button>}
                      </div>
                    )) : <div style={{padding:'18px 10px',textAlign:'center',color:'#6b7d76',fontSize:'11px'}}><b style={{color:'#065f46',display:'block'}}>All stocked up</b>No low stock alerts</div>}
                  </div>
                  <button className="btn small" style={{width:'100%',marginTop:'8px'}} onClick={()=>{setView('inventory');setAlertsOpen(false)}}><Package size={13}/> Open stock management</button>
                </div>
              </>}
            </div>}
            <div className="user-menu"><div className={`avatar ${isOwner?'owner':'cashier'}`} style={{width:'28px',height:'28px',fontSize:'11px'}}>{currentUser?.initials||'U'}</div><span style={{fontSize:'12px',fontWeight:700,maxWidth:'110px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{currentUser?.name}{currentUser?.username?` · @${currentUser.username}`:''}</span></div>
            <button className="logout" onClick={()=>setShowMyPassword(true)} title={isOwner?'Change your own password':'Change my password'}><KeyRound size={14}/> <span className="clock-text">Password</span></button>
            <button className="logout" onClick={signOut}><LogOut size={14}/> Sign out</button>
          </div>
        </header>

        <div className="page">
          {view==='dashboard' && isOwner && <DashboardOwner sales={sales} todaySales={todaySales} products={products} customers={customers} employees={employees} activities={activities} messages={messages} giftCards={giftCards} expenses={expenses} maintenance={maintenance} setView={setView} onRestock={(p)=>setStockModal({product:p,mode:'restock'})} />}
          {view==='pos' && <POSPage
            products={filteredProducts} allProducts={products} categories={categories} cat={cat} setCat={setCat}
            search={search} setSearch={setSearch} cart={cart} setCart={setCart} addToCart={addToCart} updateQty={updateQty} removeFromCart={removeFromCart}
            customers={customers} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId}
            subtotal={subtotal} discount={discount} total={total} itemCount={itemCount} discountOn={discountOn} setDiscountOn={setDiscountOn}
            showPay={showPay} setShowPay={setShowPay} mobileCart={mobileCart} setMobileCart={setMobileCart}
            completeSale={completeSale} giftCards={giftCards} isOwner={isOwner} discountPercent={discountPercent}
            onAddProduct={()=>{setEditingProduct(null);setShowProductModal(true)}}
          />}
          {view==='inventory' && <InventoryPage products={products} setProducts={setProducts} search={search} setSearch={setSearch} cat={cat} setCat={setCat} categories={categories} isOwner={isOwner} stockMoves={stockMoves} onEdit={(p)=>{setEditingProduct(p);setShowProductModal(true)}} onDelete={deleteProduct} onAdd={()=>{setEditingProduct(null);setShowProductModal(true)}} onStock={(p,mode)=>setStockModal({product:p,mode})} />}
          {view==='customers' && <CustomersPage customers={customers} sales={sales} products={products} isOwner={isOwner} onEdit={(c)=>{setEditingCustomer(c);setShowCustomerModal(true)}} onAdd={()=>{setEditingCustomer(null);setShowCustomerModal(true)}} onPayAccount={payAccount} />}
          {view==='leads' && isOwner && <LeadsPage customers={customers} sales={sales} products={products} onStartSale={(customer)=>{setSelectedCustomerId(customer.id);setView('pos')}} />}
          {view==='maintenance' && isOwner && <MaintenancePage records={maintenance} onSave={saveMaintenance} onComplete={completeMaintenance} onDelete={deleteMaintenance} />}
          {view==='timeline' && isOwner && <TimelinePage activities={activities} sales={sales} stockMoves={stockMoves} expenses={expenses} maintenance={maintenance} messages={messages} />}
          {view==='settings' && isOwner && <SettingsPage settings={settings} onSave={saveSettings} onExportBackup={exportShopData} onChangePassword={()=>setShowMyPassword(true)} offlineStatus={offline.status} counts={{Products:products.length,Sales:sales.length,Customers:customers.filter(c=>!c.isWalkIn).length,Staff:employees.length,Expenses:expenses.length,Maintenance:maintenance.length}} />}
          {view==='invoices' && <InvoicesPage sales={visibleSales} products={products} isOwner={isOwner} filter={filterSales} setFilter={setFilterSales} onViewInvoice={(s)=>canAccessSale(s)&&setSelectedInvoice(s)} onViewReceipt={(s)=>canAccessSale(s)&&setSelectedReceipt(s)} onEditSale={isOwner?setEditingSale:undefined} employees={employees} />}
          {view==='expenses' && isOwner && <ExpensesPage expenses={expenses} onEdit={(e)=>{setEditingExpense(e);setShowExpenseModal(true)}} onAdd={()=>{setEditingExpense(null);setShowExpenseModal(true)}} onDelete={deleteExpense} />}
          {view==='gift' && isOwner && <GiftAccountPage giftCards={giftCards} customers={customers} sales={sales} onAdd={()=>setShowGiftModal(true)} onPayAccount={payAccount} />}
          {view==='staff' && isOwner && <StaffPage employees={employees} sales={sales} attendance={attendance} currentUser={currentUser} onEdit={(e)=>{setEditingEmployee(e);setShowEmployeeModal(true)}} onAdd={()=>{setEditingEmployee(null);setShowEmployeeModal(true)}} onViewSales={setStaffSales} onCredentials={setCredentialsFor} />}
          {view==='reports' && isOwner && <ReportsPage sales={sales} products={products} customers={customers} giftCards={giftCards} expenses={expenses} />}
          {view==='assistant' && isOwner && <AIAssistantPage data={{sales,products,customers,employees,expenses,giftCards,stockMoves,maintenance,attendance}} shop={shop} currentUser={currentUser} />}
          {view==='messages' && <MessagesPage messages={messages} employees={employees} currentUser={currentUser} isOwner={isOwner} onSend={()=>setShowMessageModal(true)} onMarkRead={markRead} />}
        </div>

        <button className="fab" onClick={()=>setMobileCart(true)}><ShoppingCart size={18}/> View sale <span style={{background:'#ffffff22',padding:'2px 8px',borderRadius:'20px'}}>{itemCount}</span> <b>{format(total)}</b></button>
        <nav className="mnav">
          {nav.slice(0,4).map(n=>(
            <button key={n.id} className={view===n.id?'active':''} onClick={()=>{setView(n.id);setMobileMore(false)}}><n.icon size={18}/><span>{n.id==='inventory'?'Stock':n.id==='leads'?'Leads':n.label}</span></button>
          ))}
          <button className={mobileMore || !nav.slice(0,4).some(n=>n.id===view)?'active':''} onClick={()=>setMobileMore(true)}><MoreHorizontal size={18}/><span>More</span></button>
        </nav>
      </main>

      {mobileMore && <div className="backdrop mobile-more-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setMobileMore(false)}}>
        <div className="mobile-more-sheet"><div className="mobile-more-head"><div><b>POSI workspaces</b><small>Choose where you want to go</small></div><button className="btn icon small" onClick={()=>setMobileMore(false)}><X size={15}/></button></div>
          <div className="mobile-more-grid">{nav.map(n=><button key={n.id} className={view===n.id?'active':''} onClick={()=>{setView(n.id);setMobileMore(false)}}><n.icon size={19}/><span>{n.label}</span>{n.id==='inventory'&&lowStockItems.length>0&&<i>{lowStockItems.length}</i>}</button>)}</div>
        </div>
      </div>}

      {/* Modals */}
      {showProductModal && <ProductModal product={editingProduct} categories={categories.filter(c=>c!=='All')} defaultLowStock={settings.defaultLowStock??5} onClose={()=>{setShowProductModal(false);setEditingProduct(null)}} onSave={saveProduct} />}
      {showCustomerModal && <CustomerModal customer={editingCustomer} onClose={()=>{setShowCustomerModal(false);setEditingCustomer(null)}} onSave={saveCustomer} />}
      {showEmployeeModal && <EmployeeModal employee={editingEmployee} employees={employees} onClose={()=>{setShowEmployeeModal(false);setEditingEmployee(null)}} onSave={saveEmployee} />}
      {credentialsFor && <CredentialsModal employee={credentialsFor} employees={employees} onClose={()=>setCredentialsFor(null)} onSave={saveCredentials} />}
      {showMyPassword && <ChangePasswordModal user={currentUser} onClose={()=>setShowMyPassword(false)} onSave={changeMyPassword} />}
      {showGiftModal && <GiftModal customers={customers} onClose={()=>setShowGiftModal(false)} onSave={saveGiftCard} />}
      {showMessageModal && <MessageModal employees={employees} currentUser={currentUser} onClose={()=>setShowMessageModal(false)} onSend={sendMessage} />}
      {showExpenseModal && <ExpenseModal expense={editingExpense} onClose={()=>{setShowExpenseModal(false);setEditingExpense(null)}} onSave={saveExpense} employees={employees} />}
      {stockModal && <StockModal stock={stockModal} onClose={()=>setStockModal(null)} onSave={applyStockChange} />}
      {staffSales && isOwner && <StaffSalesModal employee={staffSales} sales={sales} products={products} onClose={()=>setStaffSales(null)} onViewInvoice={(s)=>{setStaffSales(null);setSelectedInvoice(s)}} onViewReceipt={(s)=>{setStaffSales(null);setSelectedReceipt(s)}} onEdit={setEditingSale} />}
      {editingSale && isOwner && <SaleEditModal sale={editingSale} products={products} customers={customers} employees={employees} giftCards={giftCards} onClose={()=>setEditingSale(null)} onSave={saveSaleEdit} onDelete={deleteSale} />}
      {showPay && <PaymentModal cart={cart} subtotal={subtotal} discount={discount} total={total} customer={selectedCustomer} giftCards={giftCards} onClose={()=>setShowPay(false)} onComplete={completeSale} isOwner={isOwner} />}
      {selectedInvoice && canAccessSale(selectedInvoice) && <InvoiceModal sale={selectedInvoice} shop={shop} receiptFooter={settings.receiptFooter} onClose={()=>setSelectedInvoice(null)} onPrintReceipt={(s)=>{setSelectedInvoice(null);setSelectedReceipt(s)}} onEditSale={isOwner?((s)=>{setSelectedInvoice(null);setEditingSale(s)}):undefined} />}
      {selectedReceipt && canAccessSale(selectedReceipt) && <ReceiptModal sale={selectedReceipt} shop={shop} receiptFooter={settings.receiptFooter} onClose={()=>setSelectedReceipt(null)} />}
      {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
      {success && <div className="success"><span style={{width:'32px',height:'32px',borderRadius:'50%',background:'#ecfdf5',color:'#065f46',display:'grid',placeItems:'center'}}><Check size={16}/></span><span><b>Sale invoiced!</b><small>{success.invoiceNumber} · {format(success.total)}</small></span><button className="btn small primary" onClick={()=>{setSelectedReceipt(success);setSuccess(null)}}><Printer size={14}/>Print receipt</button><button className="btn small" onClick={()=>{setSelectedInvoice(success);setSuccess(null)}}><FileText size={14}/>Invoice</button><button className="btn icon small" onClick={()=>setSuccess(null)}><X size={14}/></button></div>}
    </div>
  );
}

// Components

function LoginScreen({onSignIn,shop=SHOP,onRestart}){
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const submit = async (e)=>{
    e.preventDefault();
    if(busy) return;
    if(!username.trim() || !password){ setErr('Enter your username and password.'); return }
    setBusy(true); setErr('');
    const error = await onSignIn(username.trim(), password);
    setBusy(false);
    if(error) setErr(error);
  };
  return (
    <div className="login">
      <div className="login-left">
        <div className="brand" style={{color:'#fff'}}><div className="brand-mark" style={{background:'#fff',color:'#0f2320'}}>P</div><div className="brand-copy"><b style={{color:'#fff'}}>POSI<span style={{color:'#6ee7b7'}}>.</span></b><small style={{color:'#a7f3d0'}}>SHOP POS SYSTEM</small></div></div>
        <div style={{marginTop:'auto',maxWidth:'420px',position:'relative',zIndex:1}}>
          <div className="eyebrow" style={{color:'#6ee7b7'}}><span className="kicker-dot" style={{background:'#6ee7b7',boxShadow:'0 0 0 4px #ffffff22'}}/> COMPLETE SHOP SOLUTION</div>
          <h1 style={{fontSize:'42px',fontWeight:900,letterSpacing:'-1.5px',lineHeight:1.05,margin:'14px 0 10px'}}>One drug store.<br/><span style={{color:'#6ee7b7'}}>All sales combined.</span></h1>
          <p style={{color:'#cbd5d1',fontSize:'13px',lineHeight:1.6}}>Cash, MoMo &amp; Gift card sales for your drug store. Owner controls everything, cashiers sell fast.</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'22px'}}>
            <div style={{padding:'12px',border:'1px solid #ffffff22',borderRadius:'10px',background:'#ffffff0f'}}><b style={{fontSize:'12px'}}>💰 3 Payment Methods</b><small style={{display:'block',color:'#a7f3d0',marginTop:'4px',fontSize:'11px'}}>Cash · MoMo · Gift card</small></div>
            <div style={{padding:'12px',border:'1px solid #ffffff22',borderRadius:'10px',background:'#ffffff0f'}}><b style={{fontSize:'12px'}}>👑 Owner Combined</b><small style={{display:'block',color:'#a7f3d0',marginTop:'4px',fontSize:'11px'}}>All cashier sales → owner account</small></div>
          </div>
        </div>
      </div>
      <div className="login-right">
        <form className="login-card" onSubmit={submit}>
          <span style={{fontSize:'10px',fontWeight:800,letterSpacing:'1px',color:'#0f766e'}}>{shop.name.toUpperCase()} · {shop.address}</span>
          <h2 style={{margin:'8px 0 4px',fontSize:'24px',fontWeight:900}}>Sign in to POSI</h2>
          <p style={{margin:0,color:'#6b7d76',fontSize:'13px'}}>Use the username and password the owner created for you. Accounts cannot be self-registered.</p>

          <div style={{display:'flex',flexDirection:'column',gap:'12px',marginTop:'20px'}}>
            <div className="field"><label htmlFor="login-username">Username</label>
              <input id="login-username" name="username" autoComplete="username" autoFocus placeholder="e.g. owner" value={username} onChange={e=>setUsername(e.target.value)} required/>
            </div>
            <div className="field"><label htmlFor="login-password">Password</label>
              <div style={{display:'flex',gap:'6px'}}>
                <input id="login-password" name="password" type={showPassword?'text':'password'} autoComplete="current-password" placeholder="Your password" value={password} onChange={e=>setPassword(e.target.value)} required style={{flex:1}}/>
                <button type="button" className="btn icon" onClick={()=>setShowPassword(v=>!v)} title={showPassword?'Hide password':'Show password'} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>
              </div>
            </div>
          </div>

          {err && <div role="alert" style={{marginTop:'12px',padding:'10px',borderRadius:'8px',background:'#fef2f2',border:'1px solid #fecaca',color:'#991b1b',fontSize:'12px',display:'flex',gap:'8px'}}><Lock size={14} style={{flex:'none'}}/><span>{err}</span></div>}

          <button className="btn primary" style={{width:'100%',marginTop:'16px',justifyContent:'space-between'}} disabled={busy}>
            <span>{busy?'Signing in…':'Sign in'}</span><ArrowRight size={18}/>
          </button>
          <button type="button" className="btn" style={{width:'100%',marginTop:'12px'}} onClick={onRestart}>Start fresh · create my owner account</button>
          <p style={{fontSize:'11px',color:'#6b7d76'}}>Starting fresh deletes this device’s current shop records and opens store setup. You will be asked to confirm.</p>


        </form>
      </div>
    </div>
  );
}

function DashboardOwner({sales,todaySales,products,customers,employees,activities,messages,giftCards,expenses,maintenance,setView,onRestock}){
  const lowStock = products.filter(p=>p.stock<=reorderOf(p)).sort((a,b)=>a.stock-b.stock);
  const expiring = products
    .map(p=>({p, ...expiryOf(p)}))
    .filter(x=>x.state==='expired'||x.state==='soon')
    .sort((a,b)=>a.days-b.days);
  const expiredCount = expiring.filter(x=>x.state==='expired').length;
  const expiringValue = expiring.reduce((s,x)=>s+Number(x.p.cost||0)*Number(x.p.stock||0),0);
  const todayExpenses = expenses.filter(e=>e.date===todayKey());
  const todayExpenseTotal = todayExpenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const totalToday = todaySales.reduce((s,x)=>s+Number(x.total||0),0);
  const yesterdayTotal = sales.filter(s=>s.date===daysAgo(1)).reduce((s,x)=>s+Number(x.total||0),0);
  const dailyChange = yesterdayTotal ? ((totalToday-yesterdayTotal)/yesterdayTotal*100) : null;
  const weekSales = sales.filter(s=>{ const d=new Date(); d.setDate(d.getDate()-7); return s.date>=d.toISOString().slice(0,10) });
  const weekTotal = weekSales.reduce((s,x)=>s+Number(x.total||0),0);
  const accountReceivable = customers.reduce((s,c)=>s+Number(c.balance||0),0);
  const giftLiability = giftCards.filter(g=>g.status==='active').reduce((s,g)=>s+Number(g.balance||0),0);
  const byPayment = paymentMethods.map(pm=>({
    method:pm.id,
    total: sales.filter(s=>s.payment===pm.id).reduce((s,x)=>s+Number(x.total||0),0),
    count: sales.filter(s=>s.payment===pm.id).length
  }));
  const allUnitsBought = sales.reduce((sum,x)=>sum+saleUnits(x),0);
  const allProfit = sales.reduce((sum,x)=>sum+saleProfit(x,products),0);
  const allProfitMargin = (()=>{ const rev = sales.reduce((sum,x)=>sum+Number(x.total||0),0); return rev? allProfit/rev*100 : 0 })();
  const topProducts = (()=>{ const m=new Map(); sales.forEach(s=>s.items?.forEach(it=>{ const cur=m.get(it.name)||{name:it.name,qty:0,rev:0}; cur.qty+=it.qty; cur.rev+=it.lineTotal; m.set(it.name,cur)})); return [...m.values()].sort((a,b)=>b.qty-a.qty).slice(0,5) })();

  const combinedTotal = sales.reduce((s,x)=>s+Number(x.total||0),0);
  const upcomingMaintenance = maintenance.filter(m=>m.status!=='completed').sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,4);
  const maintenanceAttention = maintenance.filter(m=>m.status!=='completed' && m.dueDate<=todayKey()).length;
  const customerLeadPreview = customers.filter(c=>!c.isWalkIn).map(c=>{
    const bought = new Map();
    sales.filter(s=>s.customerId===c.id).forEach(s=>s.items?.forEach(it=>bought.set(it.name,(bought.get(it.name)||0)+Number(it.qty||0))));
    const favourite = [...bought.entries()].sort((a,b)=>b[1]-a[1])[0];
    return {customer:c,favourite};
  }).filter(x=>x.favourite).sort((a,b)=>Number(b.customer.totalSpent||0)-Number(a.customer.totalSpent||0)).slice(0,4);

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><span className="kicker-dot"/> OWNER OVERVIEW · {fullDate().toUpperCase()}</div><h1>Your shop, at a glance</h1><p>Sales, customers, stock and equipment in one owner command centre. All cashier activity is combined here.</p></div><div className="dashboard-actions"><button className="btn" onClick={()=>setView('assistant')}><Sparkles size={15}/> Ask AI</button><button className="btn" onClick={()=>setView('invoices')}><FileText size={15}/> Sales history</button><button className="btn" onClick={()=>setView('timeline')}><History size={15}/> Timeline</button><button className="btn" onClick={()=>setView('maintenance')}><Wrench size={15}/> Maintenance{maintenanceAttention>0&&<span className="button-count">{maintenanceAttention}</span>}</button><button className="btn primary" onClick={()=>setView('pos')}><ShoppingCart size={16}/> New Sale</button></div></div>

      <div className="grid metrics" style={{marginBottom:'14px'}}>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><Wallet size={16}/></div><span style={{fontSize:'10px',fontWeight:800,color:'#065f46',background:'#ecfdf5',padding:'3px 7px',borderRadius:'20px'}}>TODAY</span></div><div className="metric-label">Sales today (combined)</div><div className="metric-value">{format(totalToday)}</div><div className="metric-note">{dailyChange!==null&&<em>{dailyChange>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>} {dailyChange>=0?'+':''}{dailyChange.toFixed(0)}%</em>} {todaySales.length} transactions from all cashiers</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon dark"><DollarSign size={16}/></div></div><div className="metric-label">Total combined revenue</div><div className="metric-value">{format(combinedTotal)}</div><div className="metric-note">All payment methods combined to owner</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><PiggyBank size={16}/></div></div><div className="metric-label">Profit on all sales</div><div className="metric-value" style={{color:allProfit>=0?'#065f46':'#991b1b'}}>{format(allProfit)}</div><div className="metric-note"><b>{allUnitsBought.toLocaleString()}</b> products bought · {allProfitMargin.toFixed(0)}% margin</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon amber"><PiggyBank size={16}/></div></div><div className="metric-label">Money owed by customers</div><div className="metric-value">{format(accountReceivable)}</div><div className="metric-note">{customers.filter(c=>c.balance>0).length} customers owe</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon violet"><Gift size={16}/></div></div><div className="metric-label">Gift card liability</div><div className="metric-value">{format(giftLiability)}</div><div className="metric-note">{giftCards.filter(g=>g.status==='active').length} active cards</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon blue"><Package size={16}/></div></div><div className="metric-label">Low stock alerts</div><div className="metric-value">{lowStock.length}</div><div className="metric-note">{lowStock.length? <button className="link-btn" onClick={()=>setView('inventory')}>Needs restock — view items</button> : 'All stocked'}</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon amber"><Coins size={16}/></div></div><div className="metric-label">Expenses today</div><div className="metric-value">{format(todayExpenseTotal)}</div><div className="metric-note"><button className="link-btn" onClick={()=>setView('expenses')}>{todayExpenses.length} entries · manage</button></div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><Users size={16}/></div></div><div className="metric-label">Staff on shift</div><div className="metric-value">{employees.filter(e=>e.status==='On shift').length}</div><div className="metric-note">{employees.length} total employees</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon violet"><MessageSquare size={16}/></div></div><div className="metric-label">Unread messages</div><div className="metric-value">{messages.filter(m=>m.to==='all' || m.toName?.includes('All')).length}</div><div className="metric-note">Owner → employees</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon dark"><BarChart3 size={16}/></div></div><div className="metric-label">Week revenue</div><div className="metric-value">{format(weekTotal)}</div><div className="metric-note">{weekSales.length} invoices this week</div></div>
      </div>

      <div className="grid layout-2">
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><div><h2>Combined sales by payment</h2><p className="sub">Cash, MoMo, Gift → owner total</p></div><span className="chip"><Wallet size={14}/>{format(combinedTotal)} combined</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {byPayment.map(bp=>{
              const pct = combinedTotal? (bp.total/combinedTotal*100):0;
              return <div key={bp.method}><div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'4px'}}><span style={{display:'flex',alignItems:'center',gap:'6px'}}><span className={`badge-pay ${bp.method.toLowerCase()}`}>{bp.method}</span> {bp.count} sales</span><b>{format(bp.total)}</b></div><div className="progress"><i style={{width:`${pct}%`}}/></div></div>
            })}
          </div>
          <div style={{marginTop:'14px',padding:'10px',borderRadius:'8px',background:'#f6fffe',border:'1px solid #ccede8',fontSize:'11px',color:'#0f766e',display:'flex',gap:'8px'}}><ShieldCheck size={14}/><span><b>Owner combined control:</b> All cashier transactions automatically aggregate here. Money owed and gift liabilities are tracked separately.</span></div>
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><div><h2>Cashier monitor</h2><p className="sub">Sales combined to owner account</p></div><button className="btn small ghost" onClick={()=>setView('invoices')}>View all <ArrowRight size={14}/></button></div>
          <div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>TRANSACTIONS</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>
            {employees.filter(e=>e.role!=='owner').map(emp=>{
              const empSales = sales.filter(s=>s.cashierId===emp.id || s.cashier===emp.name);
              const empTotal = empSales.reduce((s,x)=>s+Number(x.total||0),0);
              return <tr key={emp.id}><td><div style={{display:'flex',alignItems:'center',gap:'8px'}}><div className="avatar cashier" style={{width:'28px',height:'28px'}}>{emp.initials}</div><span><b style={{fontSize:'12px'}}>{emp.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{emp.role} · {emp.shift}</small></span></div></td><td>{empSales.length}</td><td><b>{format(empTotal)}</b></td><td><span className="status ok"><i/> {emp.status}</span></td></tr>
            })}
          </tbody>
          <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{employees.filter(e=>e.role!=='owner').length} cashiers</small></td>
            <td><b>{employees.filter(e=>e.role!=='owner').reduce((s,emp)=>s+sales.filter(x=>x.cashierId===emp.id||x.cashier===emp.name).length,0)}</b></td>
            <td><b>{format(employees.filter(e=>e.role!=='owner').reduce((s,emp)=>s+sales.filter(x=>x.cashierId===emp.id||x.cashier===emp.name).reduce((a,x)=>a+Number(x.total||0),0),0))}</b></td>
            <td><span style={{fontSize:'10px',color:'#6b7d76'}}>{sales.length} invoices shop-wide</span></td>
          </tr></tfoot></table></div>
          <div style={{marginTop:'10px',fontSize:'11px',color:'#6b7d76',display:'flex',justifyContent:'space-between'}}><span>Combined to owner: {format(combinedTotal)}</span><span>{sales.length} total invoices</span></div>
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><div><h2>Low stock alerts</h2><p className="sub">Items at or below reorder level</p></div><AlertTriangle size={16} color={lowStock.length?'#b45309':'#6b7d76'}/></div>
          {lowStock.length? (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {lowStock.slice(0,6).map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px',border:'1px solid #fde68a',background:'#fffbeb',borderRadius:'8px'}}>
                  <div style={{flex:1,minWidth:0}}><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#92400e'}}>{p.stock} left · reorder at {reorderOf(p)}{p.expiry?` · exp ${readableDate(p.expiry)}`:''}</small></div>
                  <span className={`status ${p.stock===0?'bad':'warn'}`}><i/>{p.stock===0?'Out':'Low'}</span>
                  <button className="btn small" onClick={()=>onRestock(p)}>Restock</button>
                </div>
              ))}
              {lowStock.length>6 && <button className="btn small ghost" onClick={()=>setView('inventory')}>View all {lowStock.length} alerts</button>}
            </div>
          ) : <div className="empty-state"><b>Everything is stocked</b><small>Alerts appear when items reach their reorder level</small></div>}
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h2>Expiry alerts</h2><p className="sub">Expired items and items expiring within {EXPIRY_SOON_DAYS} days</p></div><AlarmClock size={16} color={expiring.length?'#b45309':'#6b7d76'}/></div>
          {expiring.length? <>
            <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}>
              {expiredCount>0 && <span className="kpi" style={{color:'#991b1b',background:'#fef2f2'}}><b>{expiredCount}</b> expired</span>}
              <span className="kpi" style={{color:'#92400e',background:'#fffbeb'}}><b>{expiring.length-expiredCount}</b> expiring soon</span>
              <span className="kpi">At cost <b>{format(expiringValue)}</b></span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'10px'}}>
              {expiring.slice(0,5).map(({p,state,label})=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px',border:`1px solid ${state==='expired'?'#fecaca':'#fde68a'}`,background:state==='expired'?'#fef2f2':'#fffbeb',borderRadius:'8px'}}>
                  <div style={{flex:1,minWidth:0}}><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:state==='expired'?'#991b1b':'#92400e'}}>{readableDate(p.expiry)} · {label} · {p.stock} in stock</small></div>
                  <span className={`status ${state==='expired'?'bad':'warn'}`}><i/>{state==='expired'?'Expired':'Soon'}</span>
                </div>
              ))}
            </div>
            <button className="btn small ghost" style={{marginTop:'10px'}} onClick={()=>setView('inventory')}>Review expiry <ArrowRight size={13}/></button>
          </> : <div className="empty-state"><b>No expiry concerns</b><small>Nothing has expired or expires in the next {EXPIRY_SOON_DAYS} days</small></div>}
        </div>

        <div className="card">
          <div className="section-head"><div><h2>Recent activity</h2><p className="sub">Latest shop updates</p></div><button className="btn small ghost" onClick={()=>setView('timeline')}>Full timeline <ArrowRight size={13}/></button></div>
          <div style={{marginTop:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
            {activities.slice(0,5).map(a=><div key={a.id} style={{display:'flex',gap:'8px',alignItems:'center'}}><div style={{width:'28px',height:'28px',borderRadius:'8px',background:'#e6f4f1',display:'grid',placeItems:'center',color:'#0f766e'}}><ShoppingCart size={14}/></div><div style={{flex:1,minWidth:0}}><b style={{fontSize:'12px',display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.title}</b><small style={{fontSize:'11px',color:'#6b7d76'}}>{a.detail}</small></div><small style={{fontSize:'10px',color:'#94a8a1'}}>{a.time}</small></div>)}
          </div>
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h2>Top products</h2><p className="sub">Best sellers from combined sales</p></div><Package size={16} color="#6b7d76"/></div>
          <div style={{marginTop:'10px'}}>
            {topProducts.length? topProducts.map((p,i)=><div key={p.name} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderTop:'1px solid #f1f5f1'}}><span style={{width:'22px',height:'22px',borderRadius:'6px',background:'#ecfdf5',display:'grid',placeItems:'center',fontSize:'10px',fontWeight:800,color:'#065f46'}}>{String(i+1).padStart(2,'0')}</span><span style={{flex:1}}><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{p.qty} sold</small></span><b style={{fontSize:'12px'}}>{format(p.rev)}</b></div>) : <div className="empty-state"><b>No sales yet</b><small>Top products will appear after sales</small></div>}
          </div>
        </div>

        <div className="card">
          <div className="section-head"><div><h2>Customer purchase leads</h2><p className="sub">What your most valuable customers mostly buy</p></div><button className="btn small ghost" onClick={()=>setView('leads')}>View leads <ArrowRight size={13}/></button></div>
          <div className="dashboard-lead-list">{customerLeadPreview.length?customerLeadPreview.map(({customer,favourite})=><button key={customer.id} onClick={()=>setView('leads')}><div className="avatar cashier">{initials(customer.name)}</div><span><b>{customer.name}</b><small>Mostly buys {favourite[0]} · {favourite[1]} units</small></span><strong>{format(customer.totalSpent)}</strong></button>):<div className="empty-state compact"><Users size={18}/><b>No named-customer purchases yet</b><small>Purchase preferences will appear after checkout.</small></div>}</div>
        </div>

        <div className="card">
          <div className="section-head"><div><h2>Maintenance schedule</h2><p className="sub">Upcoming and overdue equipment care</p></div><button className="btn small ghost" onClick={()=>setView('maintenance')}>Manage <ArrowRight size={13}/></button></div>
          <div className="dashboard-maintenance-list">{upcomingMaintenance.length?upcomingMaintenance.map(m=><button key={m.id} onClick={()=>setView('maintenance')}><span className={`dashboard-maintenance-icon ${m.dueDate<todayKey()?'overdue':''}`}><Wrench size={14}/></span><span><b>{m.asset}</b><small>{m.title}</small></span><span><b>{m.dueDate<todayKey()?'Overdue':readableDate(m.dueDate)}</b><small>{m.vendor||'In-house'}</small></span></button>):<div className="empty-state compact"><CheckCircle2 size={18}/><b>No open maintenance</b><small>New service plans will appear here.</small></div>}</div>
        </div>
      </div>
    </div>
  );
}

function POSPage({products,allProducts,categories,cat,setCat,search,setSearch,cart,setCart,addToCart,updateQty,removeFromCart,customers,selectedCustomerId,setSelectedCustomerId,subtotal,discount,total,itemCount,discountOn,setDiscountOn,showPay,setShowPay,mobileCart,setMobileCart,completeSale,giftCards,onAddProduct,isOwner,discountPercent}){
  const searchRef = useRef(null);
  const focusSearch = ()=>{ const el=searchRef.current; if(el){ el.focus(); el.select() } };
  // ⌘K / Ctrl+K jumps the cursor to the product search
  useEffect(()=>{
    const onKey=(e)=>{ if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); focusSearch() } };
    window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey);
  },[]);
  // Enter on a search that matches one product (or an exact barcode/SKU) adds it and clears the box for the next search
  const onSearchKey = (e)=>{
    if(e.key!=='Enter') return;
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if(q){
      const exact = products.filter(p=>(p.barcode && p.barcode.toLowerCase()===q) || (p.sku && p.sku.toLowerCase()===q));
      const hit = exact.length===1 ? exact[0] : (products.length===1 ? products[0] : null);
      if(hit){ addToCart(hit); setSearch(''); }
    }
    focusSearch();
  };
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><span className="kicker-dot"/> POINT OF SALE</div><h1>Make a sale</h1></div><div className="kpi-row"><span className="kpi"><Package size={14}/> {allProducts.length} items</span><span className="kpi"><Users size={14}/> {customers.length-1} customers</span></div></div>

      <div className="pos">
        <div className="catalog">
          <div className="card" style={{padding:'12px'}}>
            <div className="search-row">
              <div className="search"><Search size={16} color="#6b7d76"/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={onSearchKey} placeholder="Search name, SKU, barcode…"/><span style={{fontSize:'10px',color:'#94a8a1',border:'1px solid #e7ece8',padding:'2px 6px',borderRadius:'4px'}}>⌘K</span></div>
              {isOwner && <button className="btn small" onClick={onAddProduct}><Plus size={14}/> Add item</button>}
            </div>
            <div className="chips" style={{marginTop:'10px'}}>
              {categories.map(c=><button key={c} className={`chip-btn ${cat===c?'active':''}`} onClick={()=>setCat(c)}>{c}{c==='All'&&` (${allProducts.length})`}</button>)}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px',fontSize:'11px',color:'#6b7d76'}}><span>{products.length} products</span><span>Tap to add to sale</span></div>
          </div>

          <div className="products">
            {products.map(p=>(
              <button key={p.id} className="prod" onClick={()=>{addToCart(p); focusSearch()}} disabled={p.stock<1}>
                <div className="prod-top"><span className={`stock ${isOwner&&p.stock<=reorderOf(p)?'low':''}`}>{p.stock<1?'Out of stock':(isOwner&&p.stock<=reorderOf(p)?`${p.stock} left`:'In stock')}</span>
                  {(()=>{ const e=expiryOf(p); return e.state==='expired'? <span className="status bad" style={{fontSize:'9px'}}><i/>Expired</span> : e.state==='soon'? <span className="status warn" style={{fontSize:'9px'}}><i/>Exp {e.days}d</span> : null })()}
                </div>
                <b>{p.name}</b><small>{p.brand} · {p.category}</small>
                <div className="prod-foot"><strong>{format(p.price)}</strong><span className="add">Add</span></div>
              </button>
            ))}
          </div>
          {products.length===0 && <div className="empty-state"><Package size={20}/><b>No products found</b><small>Try different search or add new item</small></div>}
        </div>

        <div className={`card cart ${mobileCart?'open':''}`}>
          <div className="cart-head"><div><h2>Current sale <span className="count">{itemCount}</span></h2><small style={{color:'#6b7d76',fontSize:'11px'}}>New transaction · {shortTime()}</small></div><div style={{display:'flex',gap:'6px'}}><button className="btn small ghost" onClick={()=>{ if(cart.length && confirm('Clear sale?')){ setCart([]); setDiscountOn(false) } }} disabled={!cart.length} style={{color:'#b91c1c'}}>Clear</button><button className="btn icon small" onClick={()=>setMobileCart(false)}><X size={14}/></button></div></div>

          <div className="customer">
            <UserRound size={16} color="#6b7d76"/>
            <select value={selectedCustomerId} onChange={e=>setSelectedCustomerId(e.target.value)}>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.balance>0?` · Owes ${format(c.balance)}`:''}</option>)}
            </select>
            <ChevronDown size={14} color="#6b7d76"/>
          </div>

          <div className="cart-list">
            {cart.length? cart.map(i=>(
              <div className="cart-item" key={i.id}>
                <div style={{flex:1,minWidth:0}}><b>{i.name}</b><small>{format(i.price)} · {i.brand||i.category}</small><div className="qty"><button onClick={()=>updateQty(i.id,-1)}><Minus size={12}/></button><span>{i.qty}</span><button onClick={()=>updateQty(i.id,1)}><Plus size={12}/></button></div></div>
                <div className="line-total"><b>{format(i.price*i.qty)}</b><button onClick={()=>removeFromCart(i.id)}><X size={14}/></button></div>
              </div>
            )) : <div className="empty"><span style={{width:'40px',height:'40px',borderRadius:'50%',background:'#f3f4f6',display:'grid',placeItems:'center',margin:'0 auto'}}><ShoppingCart size={18}/></span><b>Sale empty</b><small>Tap products to add</small></div>}
          </div>

          <div style={{padding:'10px 14px',borderTop:'1px solid #e7ece8',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600}}><input type="checkbox" checked={discountOn} onChange={e=>setDiscountOn(e.target.checked)}/> Apply {discountPercent}% discount</label>
            <span style={{fontSize:'11px',color:'#6b7d76'}}>{discountOn?`-${format(discount)}`:''}</span>
          </div>

          <div className="totals">
            <div className="totals-row"><span>Subtotal</span><b>{format(subtotal)}</b></div>
            {discountOn && <div className="totals-row" style={{color:'#0f766e'}}><span>Discount {discountPercent}%</span><b>-{format(discount)}</b></div>}
            <div className="totals-row total"><span>Total due</span><b>{format(total)}</b></div>
          </div>

          <div className="pay-label">PAYMENT METHOD</div>
          <div className="pay-grid">
            {paymentMethods.map(pm=>(
              <button key={pm.id} className="pay-btn" onClick={()=>setShowPay(pm.id)} disabled={!cart.length}>
                <pm.icon size={16}/>{pm.label}
              </button>
            ))}
          </div>

          <button className="checkout" disabled={!cart.length} onClick={()=>setShowPay('Cash')}><span>Charge {format(total)}</span><ArrowRight size={18}/></button>
          {isOwner && <div className="secure"><ShieldCheck size={12}/> All sales combine to the owner</div>}
        </div>
      </div>
    </div>
  );
}

function InventoryPage({products,search,setSearch,cat,setCat,categories,isOwner,stockMoves,onEdit,onDelete,onAdd,onStock}){
  const [stockFilter,setStockFilter]=useState('All');
  const [expiryFilter,setExpiryFilter]=useState('All');
  const [allMoves,setAllMoves]=useState(false);
  // Value every movement at the item's cost price and, for sales, its profit.
  const moveRows = stockMoves.map(m=>{
    const prod = products.find(p=>p.id===m.productId);
    const unitCost = Number(m.cost ?? prod?.cost ?? 0);
    const unitPrice = Number(m.unitPrice ?? prod?.price ?? 0);
    const qty = Number(m.qty||0);
    const costValue = unitCost * qty;
    const profit = m.type==='sale' ? (unitPrice-unitCost)*Math.abs(qty) : 0;
    return {...m, unitCost, unitPrice, qty, costValue, profit};
  });
  const sortedMoves = [...moveRows].sort((a,b)=> (b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  const visibleMoves = allMoves ? sortedMoves : sortedMoves.slice(0,15);
  const moveTotals = visibleMoves.reduce((t,m)=>{
    t.qty += m.qty;
    if(m.qty>0) t.qtyIn += m.qty; else t.qtyOut += m.qty;
    t.costValue += m.costValue;
    t.profit += m.profit;
    t.unitCost += m.unitCost;
    t.revenue += m.type==='sale' ? m.unitPrice*Math.abs(m.qty) : 0;
    if(m.type==='sale'){ t.sales += 1; t.soldUnits += Math.abs(m.qty); t.soldCost += Math.abs(m.costValue); }
    if(m.type==='restock'){ t.restocks += 1; t.restockUnits += m.qty; t.restockCost += m.costValue; }
    if(m.type==='adjustment'){ t.adjustments += 1; t.adjUnits += m.qty; t.adjCost += m.costValue; }
    return t;
  },{qty:0,qtyIn:0,qtyOut:0,costValue:0,profit:0,revenue:0,unitCost:0,sales:0,soldUnits:0,soldCost:0,restocks:0,restockUnits:0,restockCost:0,adjustments:0,adjUnits:0,adjCost:0});
  const moveMargin = moveTotals.revenue ? (moveTotals.profit/moveTotals.revenue*100) : 0;
  const moveAvgUnitCost = visibleMoves.length ? moveTotals.unitCost / visibleMoves.length : 0;
  const moveProducts = new Set(visibleMoves.map(m=>m.productId)).size;
  const moveEdits = products.filter(p=>visibleMoves.some(m=>m.productId===p.id)).reduce((t,p)=>t+Number(p.edits||0),0);
  const filtered = products.filter(p=>{
    const matchCat = cat==='All'||p.category===cat;
    const q = search.toLowerCase();
    const matchesText = matchCat && `${p.name} ${p.brand} ${p.sku} ${p.category} ${p.supplier||''}`.toLowerCase().includes(q);
    const matchesStock = stockFilter==='All' || (stockFilter==='Low' && p.stock<=reorderOf(p)) || (stockFilter==='Out' && p.stock===0);
    const exp = expiryOf(p).state;
    const matchesExpiry = expiryFilter==='All' || (expiryFilter==='Expired' && exp==='expired') || (expiryFilter==='Soon' && exp==='soon') || (expiryFilter==='None' && exp==='none');
    return matchesText && matchesStock && matchesExpiry;
  });
  const low = products.filter(p=>p.stock<=reorderOf(p)).length;
  const out = products.filter(p=>p.stock===0).length;
  const stockValue = products.reduce((s,p)=>s+Number(p.cost||0)*Number(p.stock||0),0);
  const expired = products.filter(p=>expiryOf(p).state==='expired').length;
  const expiringSoon = products.filter(p=>expiryOf(p).state==='soon').length;
  const noExpiry = products.filter(p=>expiryOf(p).state==='none').length;
  const expiredValue = products.filter(p=>expiryOf(p).state==='expired').reduce((s,p)=>s+Number(p.cost||0)*Number(p.stock||0),0);
  const totals = filtered.reduce((t,p)=>{
    const cost = Number(p.cost||0), price = Number(p.price||0), qty = Number(p.stock||0);
    t.stock += qty;
    t.reorder += reorderOf(p);
    t.cost += cost;
    t.price += price;
    t.profit += price - cost;
    t.costValue += cost * qty;
    t.priceValue += price * qty;
    if(qty===0) t.out += 1;
    else if(qty<=reorderOf(p)) t.low += 1;
    else t.inStock += 1;
    const exp = expiryOf(p);
    if(exp.state==='expired'){ t.expired += 1; t.expiredValue += cost*qty; }
    else if(exp.state==='soon') t.soon += 1;
    else if(exp.state==='none') t.noExpiry += 1;
    else t.expiryOk += 1;
    return t;
  },{stock:0,reorder:0,cost:0,price:0,profit:0,costValue:0,priceValue:0,low:0,out:0,inStock:0,expired:0,soon:0,expiryOk:0,noExpiry:0,expiredValue:0});
  const totalMargin = totals.price ? (totals.profit/totals.price*100) : 0;
  const totalCats = new Set(filtered.map(p=>p.category)).size;
  // Action totals: what the Stock / ± Adj / Edit buttons have done for these items.
  const filteredIds = new Set(filtered.map(p=>p.id));
  const actionTotals = stockMoves.filter(m=>filteredIds.has(m.productId)).reduce((t,m)=>{
    const qty = Number(m.qty||0);
    if(m.type==='restock'){ t.stockUnits += qty; t.stockClicks += 1 }
    else if(m.type==='adjustment'){ t.adjUnits += qty; t.adjClicks += 1 }
    else if(m.type==='sale'){ t.salesUnits += Math.abs(qty); t.sales += 1 }
    return t;
  },{stockUnits:0,stockClicks:0,adjUnits:0,adjClicks:0,salesUnits:0,sales:0});
  const editTotal = filtered.reduce((t,p)=>t+Number(p.edits||0),0);
  // Product movement summary: PRODUCT / TYPE / QTY / UNIT COST / VALUE AT COST /
  // PROFIT for every product, with the Stock / ± Adj / Edit totals summed on
  // each product's subtotal line and again in the grand totals row.
  const [showMoveSummary,setShowMoveSummary]=useState(true);
  const [onlyWithMoves,setOnlyWithMoves]=useState(false);
  const movementAll = stockRollupFor(products, stockMoves, filtered.map(p=>p.id));
  const movementSummary = onlyWithMoves ? movementAll.filter(row=>row.moves>0) : movementAll;
  const rowsWithMoves = movementAll.filter(row=>row.moves>0).length;
  const moveTotalsRow = movementSummary.reduce((t,row)=>{
    ['sale','restock','adjustment'].forEach(k=>{
      const b = row[k];
      t[k].count += b.count; t[k].units += b.units; t[k].value += b.value; t[k].profit += b.profit; t[k].costSum += b.costSum;
    });
    t.stockUnits += row.actions.stockUnits; t.stockClicks += row.actions.stockClicks;
    t.adjUnits += row.actions.adjUnits; t.adjClicks += row.actions.adjClicks;
    t.edits += row.actions.edits;
    t.moves += row.moves;
    t.unitCostSum += Number(row.product.cost||0);
    t.onHand += Number(row.product.stock||0);
    return t;
  },{sale:emptyMoveBucket(),restock:emptyMoveBucket(),adjustment:emptyMoveBucket(),stockUnits:0,stockClicks:0,adjUnits:0,adjClicks:0,edits:0,moves:0,unitCostSum:0,onHand:0});
  const moveNetQty = moveTotalsRow.sale.units + moveTotalsRow.restock.units + moveTotalsRow.adjustment.units;
  const moveNetValue = moveTotalsRow.sale.value + moveTotalsRow.restock.value + moveTotalsRow.adjustment.value;
  const moveSaleRevenue = movementSummary.reduce((s,row)=>s+Math.abs(row.sale.value)+row.sale.profit,0);
  const moveProfitMargin = moveSaleRevenue ? (moveTotalsRow.sale.profit/moveSaleRevenue*100) : 0;
  const money = (n)=> n>0 ? `+${format(n)}` : n<0 ? `-${format(Math.abs(n))}` : format(0);
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Package size={12}/> {isOwner?'STOCK & ITEM LIST':'ITEM LIST'}</div><h1>{isOwner?'Stock management & item records':'Item list'}</h1>{!isOwner && <p>Browse products, prices and availability. Cost, profit and reorder tracking are managed by the owner.</p>}</div>{isOwner && <button className="btn primary" onClick={onAdd}><Plus size={16}/> Add item</button>}</div>
      <div className="kpi-row" style={{marginBottom:'12px'}}>
        <span className="kpi"><Package size={14}/> <b>{products.length}</b> total items</span>
        {isOwner && <span className="kpi" style={{color:low?'#92400e':'#065f46',background:low?'#fef3c7':'#ecfdf5'}}><AlertTriangle size={14}/> <b>{low}</b> low stock</span>}
        {isOwner && <span className="kpi" style={{color:out?'#991b1b':'#065f46',background:out?'#fef2f2':'#ecfdf5'}}><TrendingDown size={14}/> <b>{out}</b> out of stock</span>}
        <span className="kpi" style={{color:expired?'#991b1b':'#065f46',background:expired?'#fef2f2':'#ecfdf5'}}><AlarmClock size={14}/> <b>{expired}</b> expired</span>
        <span className="kpi" style={{color:expiringSoon?'#92400e':'#065f46',background:expiringSoon?'#fffbeb':'#ecfdf5'}}><CalendarDays size={14}/> <b>{expiringSoon}</b> expiring ≤{EXPIRY_SOON_DAYS}d</span>
        {isOwner && <span className="kpi"><Wallet size={14}/> Stock value <b>{format(stockValue)}</b></span>}
        {isOwner && expiredValue>0 && <span className="kpi" style={{color:'#991b1b',background:'#fef2f2'}}><AlarmClock size={14}/> Expired stock <b>{format(expiredValue)}</b></span>}
        {isOwner && <span className="kpi"><History size={14}/> <b>{stockMoves.length}</b> stock moves</span>}
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="search" style={{maxWidth:'380px'}}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={selectOnEnter} placeholder={isOwner?'Search items, SKU, brand, supplier…':'Search items, SKU, brand…'}/></div>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option>All</option>{categories.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select>
          {isOwner && <div className="chips">{['All','Low','Out'].map(f=><button key={f} className={`chip-btn ${stockFilter===f?'active':''}`} onClick={()=>setStockFilter(f)}>{f==='All'?'All stock':f==='Low'?'Low stock':'Out of stock'}</button>)}</div>}
          <div className="chips">
            {[['All','All expiry'],['Expired',`Expired (${expired})`],['Soon',`Expiring soon (${expiringSoon})`],['None',`No expiry (${noExpiry})`]].map(([v,label])=>
              <button key={v} className={`chip-btn ${expiryFilter===v?'active':''}`} onClick={()=>setExpiryFilter(v)} style={v!=='All'&&expiryFilter===v?(v==='Expired'?{background:'#fef2f2',color:'#991b1b',borderColor:'#fecaca'}:{}):undefined}>{label}</button>)}
          </div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>STOCK</th>{isOwner&&<th>REORDER AT</th>}{isOwner&&<th>COST</th>}<th>PRICE</th>{isOwner&&<th>PROFIT</th>}<th>EXPIRY</th><th>STATUS</th>{isOwner&&<th></th>}</tr></thead><tbody>
          {filtered.map(p=>{
            const profit = p.price - (p.cost||0);
            const margin = p.price? (profit/p.price*100):0;
            return <tr key={p.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:'8px'}}><span><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{p.brand}{isOwner&&p.supplier?` · ${p.supplier}`:''}</small></span></div></td>
              <td>{p.sku}</td><td>{p.category}</td>
              <td><b style={{color:isOwner&&p.stock<=reorderOf(p)?'#92400e':'#065f46'}}>{p.stock}</b> units</td>
              {isOwner&&<td>{reorderOf(p)}</td>}
              {isOwner&&<td>{format(p.cost||0)}</td>}
              <td><b>{format(p.price)}</b></td>
              {isOwner&&<td><span style={{color:profit>0?'#065f46':'#991b1b'}}>{format(profit)} ({margin.toFixed(0)}%)</span></td>}
              <td>{(()=>{ const e=expiryOf(p); return <span className={`status ${e.state==='expired'?'bad':e.state==='soon'?'warn':e.state==='none'?'neutral':'ok'}`} title={p.expiry?`Expires ${readableDate(p.expiry)}`:''}><i/>{e.state==='none'?'Not set':(p.expiry?`${readableDate(p.expiry)} · ${e.label}`:e.label)}</span> })()}</td>
              <td><span className={`status ${p.stock===0?'bad':(isOwner&&p.stock<=reorderOf(p))?'warn':'ok'}`}><i/>{p.stock===0?'Out':(isOwner&&p.stock<=reorderOf(p))?'Low':'In stock'}</span></td>
              {isOwner&&<td><div style={{display:'flex',gap:'4px'}}>
                <button className="btn small" title="Restock in" onClick={()=>onStock(p,'restock')}><Plus size={12}/> Stock</button>
                <button className="btn small" title="Adjust (damage/loss/count)" onClick={()=>onStock(p,'adjust')}>± Adj</button>
                <button className="btn small" onClick={()=>onEdit(p)} title={p.edits?`Edited ${p.edits} time${p.edits===1?'':'s'}${p.updatedAt?` · last ${readableDate(String(p.updatedAt).slice(0,10))}`:''}`:'Not edited yet'}><Edit2 size={12}/> Edit{p.edits?<small style={{fontSize:'9px',fontWeight:800,color:'#0f766e'}}>{p.edits}</small>:null}</button>
                <button className="btn small" style={{color:'#b91c1c'}} onClick={()=>{if(confirm(`Delete ${p.name}?`)) onDelete(p.id)}}><Trash2 size={12}/></button>
              </div></td>}
            </tr>
          })}
        </tbody>
        {filtered.length>0 && <tfoot>
          <tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{filtered.length} item{filtered.length===1?'':'s'}{filtered.length!==products.length?` of ${products.length}`:''}</small></td>
            <td style={{color:'#6b7d76'}}>—</td>
            <td><b>{totalCats}</b> <small style={{fontSize:'10px',color:'#6b7d76'}}>categor{totalCats===1?'y':'ies'}</small></td>
            <td><b>{totals.stock.toLocaleString()}</b> units</td>
            {isOwner&&<td><b>{totals.reorder.toLocaleString()}</b> units</td>}
            {isOwner&&<td><b>{format(totals.cost)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>stock value {format(totals.costValue)}</small></td>}
            <td><b>{format(totals.price)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>retail value {format(totals.priceValue)}</small></td>
            {isOwner&&<td><b style={{color:totals.profit>0?'#065f46':'#991b1b'}}>{format(totals.profit)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{totalMargin.toFixed(0)}% · on hand {format(totals.priceValue-totals.costValue)}</small></td>}
            <td><span style={{fontSize:'10px',fontWeight:700,color:'#991b1b'}}>{totals.expired} expired</span> <span style={{fontSize:'10px',fontWeight:700,color:'#92400e'}}>· {totals.soon} soon</span>{isOwner && totals.expiredValue>0 && <small style={{display:'block',fontSize:'10px',color:'#991b1b'}}>{format(totals.expiredValue)} at cost</small>}</td>
            <td><span style={{fontSize:'10px',fontWeight:700,color:'#065f46'}}>{totals.inStock} in</span> <span style={{fontSize:'10px',fontWeight:700,color:'#92400e'}}>· {totals.low} low</span> <span style={{fontSize:'10px',fontWeight:700,color:'#991b1b'}}>· {totals.out} out</span></td>
            {isOwner&&<td style={{fontSize:'9px',lineHeight:1.5,whiteSpace:'nowrap'}}>
              <span style={{display:'block',fontWeight:800,color:'#1e40af'}}>Stock <span style={{color:'#065f46'}}>+{actionTotals.stockUnits}</span> <small style={{color:'#6b7d76',fontWeight:600}}>({actionTotals.stockClicks})</small></span>
              <span style={{display:'block',fontWeight:800,color:'#92400e'}}>Adj <span style={{color:actionTotals.adjUnits<0?'#991b1b':'#065f46'}}>{actionTotals.adjUnits>0?'+':''}{actionTotals.adjUnits}</span> <small style={{color:'#6b7d76',fontWeight:600}}>({actionTotals.adjClicks})</small></span>
              <span style={{display:'block',fontWeight:800,color:editTotal?'#0f766e':'#6b7d76'}}>{editTotal} edit{editTotal===1?'':'s'}</span>
            </td>}
          </tr>
        </tfoot>}
        </table></div>
        {filtered.length===0 && <div className="empty-state"><b>No items</b><small>Try different filter</small></div>}
        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 2px 2px',fontSize:'11px',color:'#6b7d76'}}><span>Showing {filtered.length} of {products.length}</span><span>{isOwner?'Owner controls inventory':'Owner controls product records'}</span></div>
      </div>

      {isOwner && <div className="card" style={{marginTop:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',gap:'8px',flexWrap:'wrap'}}>
          <div><h2>Product movement summary</h2><p className="sub">Every product with its movement type, units, unit cost, value at cost and profit — plus the Stock, ± Adj and Edit totals summed for each product</p></div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            <button className={`btn small ${onlyWithMoves?'primary':'ghost'}`} onClick={()=>setOnlyWithMoves(v=>!v)} title="Show only products with stock movements">{onlyWithMoves?'All products':`Only with moves (${rowsWithMoves})`}</button>
            <button className="btn small" onClick={()=>setShowMoveSummary(v=>!v)}>{showMoveSummary?'Hide':'Show'} summary</button>
          </div>
        </div>
        {showMoveSummary && <>
          <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>TYPE</th><th>QTY</th><th>UNIT COST</th><th>VALUE AT COST</th><th>PROFIT</th><th>STOCK</th><th>± ADJ</th><th>EDITS</th></tr></thead><tbody>
            {movementSummary.map(row=>{
              const types = ['sale','restock','adjustment'].filter(k=>row[k].count>0);
              const netQty = row.sale.units + row.restock.units + row.adjustment.units;
              const netValue = row.sale.value + row.restock.value + row.adjustment.value;
              const costSum = row.sale.costSum + row.restock.costSum + row.adjustment.costSum;
              return [
                ...types.map(k=>{
                  const b = row[k];
                  return <tr key={`${row.product.id}-${k}`} style={{background:'#fcfdfc'}}>
                    <td style={{paddingLeft:'18px',color:'#6b7d76',fontSize:'12px'}}>{row.product.name}</td>
                    <td><span className={`status ${k==='restock'?'info':k==='sale'?'ok':'warn'}`}><i/>{moveTypeLabel(k)}</span></td>
                    <td><b style={{color:b.units>0?'#065f46':'#991b1b'}}>{b.units>0?`+${b.units}`:b.units}</b> <small style={{fontSize:'10px',color:'#6b7d76'}}>{b.count} move{b.count===1?'':'s'}</small></td>
                    <td>{format(bucketAvgCost(b))}</td>
                    <td><b style={{color:b.value>0?'#065f46':b.value<0?'#991b1b':'#6b7d76'}}>{money(b.value)}</b></td>
                    <td>{k==='sale' ? <b style={{color:b.profit>0?'#065f46':b.profit<0?'#991b1b':'#6b7d76'}}>{format(b.profit)}</b> : <span style={{color:'#94a8a1',fontSize:'11px'}}>—</span>}</td>
                    <td style={{color:'#cbd5d1'}}>·</td><td style={{color:'#cbd5d1'}}>·</td><td style={{color:'#cbd5d1'}}>·</td>
                  </tr>
                }),
                <tr key={`${row.product.id}-sum`} style={{background:'#f6faf8',borderTop:'1px solid #e7ece8'}}>
                  <td><b style={{fontSize:'12px'}}>{row.product.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>subtotal · {row.moves} move{row.moves===1?'':'s'} · {row.product.stock} in stock</small></td>
                  <td><b style={{fontSize:'11px',color:'#0f766e'}}>Product total</b></td>
                  <td><b style={{color:netQty>0?'#065f46':netQty<0?'#991b1b':'#6b7d76'}}>{netQty>0?`+${netQty}`:netQty}</b></td>
                  <td><b>{format(costSum)}</b></td>
                  <td><b style={{color:netValue>0?'#065f46':netValue<0?'#991b1b':'#6b7d76'}}>{money(netValue)}</b></td>
                  <td><b style={{color:row.sale.profit>0?'#065f46':row.sale.profit<0?'#991b1b':'#6b7d76'}}>{format(row.sale.profit)}</b></td>
                  <td><b style={{color:'#1e40af',fontSize:'11px'}}>+{row.actions.stockUnits}<small style={{color:'#6b7d76',fontWeight:600}}> ({row.actions.stockClicks})</small></b></td>
                  <td><b style={{color:'#92400e',fontSize:'11px'}}>{row.actions.adjUnits>0?'+':''}{row.actions.adjUnits}<small style={{color:'#6b7d76',fontWeight:600}}> ({row.actions.adjClicks})</small></b></td>
                  <td><b style={{color:row.actions.edits?'#0f766e':'#6b7d76',fontSize:'11px'}}>{row.actions.edits}</b></td>
                </tr>
              ];
            })}
          </tbody>
          {movementSummary.length>0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{movementSummary.length} product{movementSummary.length===1?'':'s'} · {moveTotalsRow.moves} moves · {moveTotalsRow.onHand.toLocaleString()} units on hand</small></td>
            <td style={{fontSize:'10px',lineHeight:1.5,color:'#6b7d76'}}>
              <span style={{display:'block',fontWeight:800,color:'#065f46'}}>{moveTotalsRow.sale.count} sale{moveTotalsRow.sale.count===1?'':'s'}</span>
              <span style={{display:'block',fontWeight:800,color:'#1e40af'}}>{moveTotalsRow.restock.count} restock{moveTotalsRow.restock.count===1?'':'s'}</span>
              <span style={{display:'block',fontWeight:800,color:'#92400e'}}>{moveTotalsRow.adjustment.count} adj</span>
            </td>
            <td><b style={{color:moveNetQty>0?'#065f46':moveNetQty<0?'#991b1b':'#6b7d76'}}>{moveNetQty>0?`+${moveNetQty}`:moveNetQty} net</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>in +{moveTotalsRow.restock.units} · out {Math.abs(moveTotalsRow.sale.units+moveTotalsRow.adjustment.units)}</small></td>
            <td><b>{format(moveTotalsRow.unitCostSum)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>sum of item costs</small></td>
            <td><b style={{color:moveNetValue>0?'#065f46':moveNetValue<0?'#991b1b':'#6b7d76'}}>{money(moveNetValue)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>sold out {format(Math.abs(moveTotalsRow.sale.value)+Math.abs(moveTotalsRow.adjustment.value))} · in {format(moveTotalsRow.restock.value)}</small></td>
            <td><b style={{color:moveTotalsRow.sale.profit>0?'#065f46':moveTotalsRow.sale.profit<0?'#991b1b':'#6b7d76'}}>{format(moveTotalsRow.sale.profit)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{moveProfitMargin.toFixed(0)}% margin</small></td>
            <td><b style={{color:'#1e40af'}}>Stock +{moveTotalsRow.stockUnits}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{moveTotalsRow.stockClicks} click{moveTotalsRow.stockClicks===1?'':'s'}</small></td>
            <td><b style={{color:'#92400e'}}>±Adj {moveTotalsRow.adjUnits>0?'+':''}{moveTotalsRow.adjUnits}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{moveTotalsRow.adjClicks} click{moveTotalsRow.adjClicks===1?'':'s'}</small></td>
            <td><b style={{color:'#0f766e'}}>{moveTotalsRow.edits}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>edit{moveTotalsRow.edits===1?'':'s'}</small></td>
          </tr></tfoot>}
          </table></div>
          {movementSummary.length===0 && <div className="empty-state"><Package size={20}/><b>No products match the filters</b><small>Clear the search or category filter to see the movement summary</small></div>}
        </>}
      </div>}

      {isOwner && <div className="card" style={{marginTop:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px',gap:'8px',flexWrap:'wrap'}}><div><h2>Stock movement log</h2><p className="sub">Every unit in and out — sales, restocks and adjustments, valued at cost price</p></div><div style={{display:'flex',gap:'6px',alignItems:'center'}}>{moveRows.length>15 && <button className="btn small ghost" onClick={()=>setAllMoves(v=>!v)}>{allMoves?`Show latest 15`:`View all ${moveRows.length}`}</button>}<History size={16} color="#6b7d76"/></div></div>
        <div className="table-wrap"><table><thead><tr><th>DATE</th><th>PRODUCT</th><th>TYPE</th><th>QTY</th><th>UNIT COST</th><th>VALUE AT COST</th><th>PROFIT</th><th>BY</th><th>NOTE</th></tr></thead><tbody>
          {visibleMoves.map(m=>{
            const t = stockMoveTypes[m.type]||stockMoveTypes.adjustment;
            return <tr key={m.id}>
              <td><b style={{fontSize:'12px'}}>{m.date===todayKey()?'Today':readableDate(m.date)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{m.time}</small></td>
              <td><b style={{fontSize:'12px'}}>{m.productName}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>sells at {format(m.unitPrice)}</small></td>
              <td><span className={`status ${m.type==='restock'?'info':m.type==='sale'?'ok':'warn'}`}><i/>{t.label}</span></td>
              <td><b style={{color:m.qty>0?'#065f46':'#991b1b'}}>{m.qty>0?`+${m.qty}`:m.qty}</b></td>
              <td>{format(m.unitCost)}</td>
              <td><b style={{color:m.costValue>=0?'#065f46':'#991b1b'}}>{m.costValue>0?`+${format(m.costValue)}`:m.costValue<0?`-${format(Math.abs(m.costValue))}`:format(0)}</b></td>
              <td>{m.type==='sale'
                ? <b style={{color:m.profit>0?'#065f46':m.profit<0?'#991b1b':'#6b7d76'}}>{format(m.profit)}</b>
                : <span style={{color:'#94a8a1',fontSize:'11px'}}>—</span>}</td>
              <td>{m.by}</td><td style={{color:'#6b7d76',maxWidth:'220px',overflow:'hidden',textOverflow:'ellipsis'}}>{m.note||'—'}</td>
            </tr>
          })}
        </tbody>
        {visibleMoves.length>0 && <tfoot><tr>
          <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{visibleMoves.length} of {moveRows.length} moves · {moveProducts} product{moveProducts===1?'':'s'}</small></td>
          <td style={{fontSize:'10px',color:'#6b7d76',lineHeight:1.5}}>
            <span style={{display:'block'}}>{moveTotals.sales} sale{moveTotals.sales===1?'':'s'} · {moveTotals.restocks} restock{moveTotals.restocks===1?'':'s'} · {moveTotals.adjustments} adj</span>
            <span style={{display:'block'}}>Stock <b style={{color:'#1e40af'}}>+{moveTotals.restockUnits}</b> · Adj <b style={{color:'#92400e'}}>{moveTotals.adjUnits>0?'+':''}{moveTotals.adjUnits}</b> · <b style={{color:'#0f766e'}}>{moveEdits} edit{moveEdits===1?'':'s'}</b></span>
          </td>
          <td style={{fontSize:'10px',color:'#6b7d76'}}>
            <span style={{fontWeight:700,color:'#1e40af'}}>in +{moveTotals.qtyIn}</span>{' · '}
            <span style={{fontWeight:700,color:'#991b1b'}}>out {moveTotals.qtyOut}</span>
          </td>
          <td><b style={{color:moveTotals.qty>=0?'#065f46':'#991b1b'}}>{moveTotals.qty>0?`+${moveTotals.qty}`:moveTotals.qty} net</b></td>
          <td><b>{format(moveTotals.unitCost)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>avg {format(moveAvgUnitCost)}</small></td>
          <td><b style={{color:moveTotals.costValue>=0?'#065f46':'#991b1b'}}>{moveTotals.costValue>0?`+${format(moveTotals.costValue)}`:`-${format(Math.abs(moveTotals.costValue))}`}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>in {format(moveTotals.restockCost)} · out {format(Math.abs(moveTotals.soldCost+moveTotals.adjCost))}</small></td>
          <td><b style={{color:moveTotals.profit>0?'#065f46':moveTotals.profit<0?'#991b1b':'#6b7d76'}}>{format(moveTotals.profit)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{moveMargin.toFixed(0)}% · on {format(moveTotals.revenue)}</small></td>
          <td style={{color:'#6b7d76',fontSize:'10px'}}>{new Set(visibleMoves.map(m=>m.by)).size} staff</td>
          <td style={{color:'#6b7d76',fontSize:'10px'}}>{visibleMoves.filter(m=>m.note).length} with notes</td>
        </tr></tfoot>}
        </table></div>
        {stockMoves.length===0 && <div className="empty-state"><History size={20}/><b>No stock moves yet</b><small>Restocks, sales and adjustments will appear here</small></div>}
      </div>}
    </div>
  );
}

function CustomersPage({customers,sales,products=[],isOwner,onEdit,onAdd,onPayAccount}){
  const [q,setQ]=useState('');
  const [payModal,setPayModal]=useState(null);
  const [payAmount,setPayAmount]=useState('');
  const filtered = customers.filter(c=>{
    if(c.isWalkIn) return false;
    return `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase());
  });
  const totalReceivable = filtered.reduce((s,c)=>s+Number(c.balance||0),0);
  const totals = filtered.reduce((t,c)=>{
    t.balance += Number(c.balance||0);
    t.spent += Number(c.totalSpent||0);
    t.visits += Number(c.visits||0);
    if(Number(c.balance||0)>0) t.owing += 1;
    t.units += sales.filter(s=>s.customerId===c.id).reduce((a,s)=>a+saleUnits(s),0);
    t.profit += sales.filter(s=>s.customerId===c.id).reduce((a,s)=>a+saleProfit(s,products),0);
    return t;
  },{balance:0,spent:0,visits:0,owing:0,units:0,profit:0});
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Users size={12}/> CUSTOMER LIST</div><h1>Customer list</h1></div><button className="btn primary" onClick={onAdd}><UserPlus size={16}/> Add customer</button></div>
      <div className="kpi-row" style={{marginBottom:'12px'}}><span className="kpi"><b>{filtered.length}</b> customers</span><span className="kpi" style={{background:'#fffbeb'}}><Wallet size={14}/> <b>{format(totalReceivable)}</b> owed</span>{isOwner && <span className="kpi"><TrendingUp size={14}/> Combined to owner</span>}</div>
      <div className="card">
        <div className="toolbar"><div className="search" style={{maxWidth:'360px'}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={selectOnEnter} placeholder="Search customer, phone…"/></div><button className="btn small" onClick={()=>{const blob=new Blob([JSON.stringify(customers,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='customers.json'; a.click(); URL.revokeObjectURL(url)}}><Download size={14}/> Export</button></div>
        <div className="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>BALANCE (OWES)</th><th>TOTAL SPENT</th><th>VISITS</th><th>STATUS</th><th></th></tr></thead><tbody>
          {filtered.map(c=>{
            const custSales = sales.filter(s=>s.customerId===c.id);
            return <tr key={c.id}><td><div style={{display:'flex',alignItems:'center',gap:'8px'}}><div className="avatar cashier" style={{width:'28px',height:'28px',fontSize:'10px'}}>{initials(c.name)}</div><span><b style={{fontSize:'12px'}}>{c.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{c.email||c.address}</small></span></div></td><td>{c.phone||'—'}</td><td><b style={{color:c.balance>0?'#991b1b':'#065f46'}}>{format(c.balance)}</b></td><td>{format(c.totalSpent)}</td><td>{c.visits||custSales.length}</td><td><span className={`status ${c.balance>0?'warn':'ok'}`}><i/>{c.balance>0?'Owes':'Clear'}</span></td><td><div style={{display:'flex',gap:'4px'}}><button className="btn small" onClick={()=>onEdit(c)}><Edit2 size={12}/> Edit</button>{c.balance>0 && isOwner && <button className="btn small primary" onClick={()=>{setPayModal(c);setPayAmount(String(c.balance))}}><DollarSign size={12}/> Pay</button>}</div></td></tr>
          })}
        </tbody>
        {filtered.length>0 && <tfoot><tr>
          <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{filtered.length} customer{filtered.length===1?'':'s'} · {totals.owing} owing · {totals.units.toLocaleString()} products bought</small></td>
          <td style={{color:'#6b7d76'}}>—</td>
          <td><b style={{color:totals.balance>0?'#991b1b':'#065f46'}}>{format(totals.balance)}</b></td>
          <td><b>{format(totals.spent)}</b></td>
          <td><b>{totals.visits.toLocaleString()}</b></td>
          <td></td><td></td>
        </tr></tfoot>}
        </table></div>
      </div>

      {payModal && (
        <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) setPayModal(null)}}>
          <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#ecfdf5',color:'#065f46',display:'grid',placeItems:'center'}}><Wallet size={18}/></div><div><h3>Record customer payment</h3><p>{payModal.name} owes {format(payModal.balance)}</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={()=>setPayModal(null)}><X size={14}/></button></div>
            <div className="modal-body">
              <div className="field"><label>Amount received (GH₵)</label><input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} min="0" step="0.01"/></div>
              <div style={{padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px',fontSize:'12px'}}><div style={{display:'flex',justifyContent:'space-between'}}><span>Current balance</span><b>{format(payModal.balance)}</b></div><div style={{display:'flex',justifyContent:'space-between',marginTop:'6px'}}><span>After payment</span><b style={{color:'#065f46'}}>{format(Math.max(0, payModal.balance - Number(payAmount||0)))}</b></div></div>
            </div>
            <div className="modal-foot"><button className="btn" onClick={()=>setPayModal(null)}>Cancel</button><button className="btn primary" onClick={()=>{ if(Number(payAmount)>0){ onPayAccount(payModal.id, Number(payAmount)); setPayModal(null);} }}><Check size={14}/> Record payment</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Month calendar for sales history: per-day revenue, click a day or drag a range.
function SalesCalendar({sales,products=[],from,to,onSelect,onClear,isOwner}){
  const [cursor,setCursor]=useState(()=> (from||to||todayKey()).slice(0,7));
  useEffect(()=>{ if(from) setCursor(from.slice(0,7)) },[from]);
  const daily = useMemo(()=>{
    const map=new Map();
    sales.forEach(s=>{
      const cur = map.get(s.date) || {total:0,count:0,units:0,profit:0};
      cur.total += Number(s.total||0);
      cur.count += 1;
      cur.units += saleUnits(s);
      cur.profit += saleProfit(s,products);
      map.set(s.date,{...cur});
    });
    return map;
  },[sales,products]);
  const [year,month] = cursor.split('-').map(Number);
  const monthLabel = new Date(year,month-1,1).toLocaleDateString('en-GH',{month:'long',year:'numeric'});
  const firstDow = (new Date(year,month-1,1).getDay()+6)%7; // Monday first
  const daysInMonth = new Date(year,month,0).getDate();
  const dayKey = (d)=>`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const monthKeys = Array.from({length:daysInMonth},(_,i)=>dayKey(i+1));
  const monthStats = monthKeys.reduce((t,k)=>{ const d=daily.get(k); if(d){ t.total+=d.total; t.count+=d.count; t.units+=d.units; t.profit+=d.profit } return t },{total:0,count:0,units:0,profit:0});
  const shiftMonth = (n)=>{ const d=new Date(year,month-1+n,1); setCursor(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) };
  const selStart = from || '';
  const selEnd = to || from || '';
  const isSelected = (k)=> selStart && k>=selStart && k<=selEnd;
  // First click starts a range, a second click completes it; clicking a new day
  // while a complete range is shown starts over.
  const pick = (k)=>{
    if(!from || (from && to)) onSelect(k,'');
    else onSelect(from<=k?from:k, from<=k?k:from);
  };
  const today = todayKey();
  const totalSales = sales.length;
  return (
    <div style={{marginTop:'12px'}}>
      <div className="cal-head">
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <button className="btn icon small" onClick={()=>shiftMonth(-1)} title="Previous month"><ChevronDown size={14} style={{transform:'rotate(90deg)'}}/></button>
          <b style={{fontSize:'13px',minWidth:'140px',textAlign:'center'}}>{monthLabel}</b>
          <button className="btn icon small" onClick={()=>shiftMonth(1)} title="Next month"><ChevronDown size={14} style={{transform:'rotate(-90deg)'}}/></button>
          <button className="btn small ghost" onClick={()=>setCursor(today.slice(0,7))}>This month</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',fontSize:'11px',color:'#6b7d76'}}>
          <span><b style={{color:'#0f766e'}}>{format(monthStats.total)}</b> · {monthStats.count} sale{monthStats.count===1?'':'s'} · {monthStats.units} units{isOwner?` · profit ${format(monthStats.profit)}`:''}</span>
          {(from||to) && <button className="btn small ghost" onClick={onClear}><X size={12}/> Clear date filter</button>}
        </div>
      </div>
      <div className="cal-grid">
        {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d=><div key={d} className="cal-dow">{d}</div>)}
        {Array.from({length:firstDow}).map((_,i)=><div key={'pad'+i} className="cal-day muted"/>)}
        {monthKeys.map(k=>{
          const d = daily.get(k);
          const day = Number(k.slice(-2));
          return <button key={k}
            className={`cal-day ${d?'has-sales':''} ${k===today?'today':''} ${isSelected(k)?'sel':''}`}
            onClick={()=>pick(k)}
            title={d?`${d.count} sale${d.count===1?'':'s'} · ${format(d.total)}${d.units?` · ${d.units} units`:''}`:'No sales'}>
            <b>{day}</b>
            {d ? <><small style={{fontWeight:700}}>{format(d.total)}</small><small>{d.count} sale{d.count===1?'':'s'}</small></> : <small style={{opacity:.5}}>—</small>}
          </button>
        })}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',gap:'8px',flexWrap:'wrap',fontSize:'10px',color:'#6b7d76',marginTop:'8px'}}>
        <span>Click a day to filter it · then click another day to select a range (click the same day again for a single day){totalSales?` · ${totalSales} sale${totalSales===1?'':'s'} in this filtered list`:''}</span>
        <span>{selStart? (selEnd && selEnd!==selStart ? `${readableDate(selStart)} → ${readableDate(selEnd)}` : readableDate(selStart)) : 'All dates'}</span>
      </div>
    </div>
  );
}

function InvoicesPage({sales:salesAll,products=[],isOwner,filter,setFilter,onViewInvoice,onViewReceipt,onEditSale,employees}){
  const [range,setRange]=useState({from:'',to:''});
  const [showCalendar,setShowCalendar]=useState(true);
  const sales = useMemo(()=>{
    if(!range.from) return salesAll;
    const end = range.to || range.from;
    return salesAll.filter(s=>s.date>=range.from && s.date<=end);
  },[salesAll,range]);
  const clearRange = ()=>{ setRange({from:'',to:''}); setFilter(f=>({...f,date:'All'})) };
  const presetRange = (id)=>{
    const now = new Date();
    const iso = (d)=>d.toISOString().slice(0,10);
    if(id==='all') return clearRange();
    if(id==='Today') return setRange({from:todayKey(),to:todayKey()});
    if(id==='Yesterday'){ const d=new Date(now); d.setDate(d.getDate()-1); return setRange({from:iso(d),to:iso(d)}) }
    if(id==='Week'){ const d=new Date(now); d.setDate(d.getDate()-6); return setRange({from:iso(d),to:todayKey()}) }
    if(id==='Month') return setRange({from:now.toISOString().slice(0,7)+'-01',to:todayKey()});
  };
  const total = sales.reduce((s,x)=>s+Number(x.total||0),0);
  const totals = sales.reduce((t,x)=>{
    t.items += saleUnits(x);
    t.total += Number(x.total||0);
    t.cost += saleCost(x,products);
    t.profit += saleProfit(x,products);
    return t;
  },{items:0,total:0,cost:0,profit:0});
  const totalMargin = totals.total ? (totals.profit/totals.total*100) : 0;
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><FileText size={12}/> {isOwner?'SALES HISTORY · OWNER':'MY SALES · TODAY ONLY'}</div><h1>{isOwner?'Sales history & receipts':'Today’s sales'}</h1><p>{isOwner?'Every invoice from every cashier — open one to correct it, or filter by calendar date, employee, payment and search.':'Only the sales you complete today appear here. Earlier sales are visible to the owner only.'}</p></div><div className="kpi-row"><span className="kpi"><b>{sales.length}</b> invoices</span><span className="kpi"><b>{format(total)}</b> total</span>{range.from && <span className="kpi" style={{background:'#e6f4f1',color:'#0f766e'}}><CalendarDays size={14}/> <b>{range.to && range.to!==range.from?`${readableDate(range.from)} → ${readableDate(range.to)}`:readableDate(range.from)}</b></span>}<span className="kpi"><Package size={14}/> <b>{totals.items.toLocaleString()}</b> products bought</span>{isOwner && <span className="kpi" style={{background:'#ecfdf5'}}><PiggyBank size={14}/> <b>{format(totals.profit)}</b> profit</span>}<button className="btn small" onClick={()=>{ const header=['Invoice','Date','Time','Seller','Customer','Units bought','Payment','Total',...(isOwner?['Profit']:[])]; const rows=sales.map(s=>[s.invoiceNumber,s.date,s.time,s.cashier,s.customerName,saleUnits(s),s.payment,s.total,...(isOwner?[saleProfit(s,products).toFixed(2)]:[])]); const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`sales-${range.from?(range.to&&range.to!==range.from?`${range.from}_to_${range.to}`:range.from):todayKey()}.csv`; a.click(); URL.revokeObjectURL(url)}}><Download size={14}/> Export CSV</button></div></div>

      {!isOwner && (
        <div className="card" style={{marginBottom:'14px',display:'flex',gap:'12px',alignItems:'flex-start',background:'#f9fbf9'}}>
          <div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#eef2f0',color:'#0f2320',display:'grid',placeItems:'center',flex:'none'}}><Lock size={17}/></div>
          <div><b style={{fontSize:'13px'}}>Your sales history is private to the owner</b>
            <p className="sub" style={{marginTop:'3px'}}>You can review and print the sales you made <b>today</b>. Sales from earlier days, other cashiers&apos; sales and every past receipt are hidden — the owner can see, correct or delete them.</p></div>
        </div>
      )}

      {isOwner && <div className="card" style={{marginBottom:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          <div><h2 style={{display:'flex',alignItems:'center',gap:'7px'}}><CalendarDays size={16} color="#0f766e"/> Sales calendar</h2><p className="sub">Click a day, or click two days to select a range — the table and totals follow</p></div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            {[['Today','Today'],['Yesterday','Yesterday'],['Week','Last 7 days'],['Month','This month'],['all','All dates']].map(([id,label])=>
              <button key={id} className="btn small ghost" onClick={()=>presetRange(id)}>{label}</button>)}
            <button className="btn small" onClick={()=>setShowCalendar(v=>!v)}>{showCalendar?'Hide':'Show'} calendar</button>
          </div>
        </div>
        {showCalendar && <SalesCalendar sales={salesAll} products={products} isOwner={isOwner} from={range.from} to={range.to}
          onSelect={(a,b)=>setRange({from:a,to:b})} onClear={clearRange}/>}
      </div>}

      <div className="card">
        <div className="toolbar">
          <div className="search" style={{maxWidth:'320px'}}><Search size={16}/><input value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} onKeyDown={selectOnEnter} placeholder="Search invoice, customer, seller…"/></div>
          {isOwner && <select value={filter.cashier||'All'} onChange={e=>setFilter(f=>({...f,cashier:e.target.value}))} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option value="All">All sellers</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}{e.role==='owner'?' (owner)':''}</option>)}</select>}
          <select value={filter.payment} onChange={e=>setFilter(f=>({...f,payment:e.target.value}))} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option>All</option><option>Cash</option><option>MoMo</option><option>Gift</option></select>
          {isOwner && <select value={filter.date} onChange={e=>{ setFilter(f=>({...f,date:e.target.value})); setRange({from:'',to:''}) }} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option value="All">All dates</option><option value="Today">Today</option><option value="Week">Last 7 days</option><option value="Month">This month</option></select>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>DATE</th><th>CUSTOMER</th><th>SELLER</th><th>PAYMENT</th><th>ITEMS</th><th>TOTAL</th>{isOwner&&<th>PROFIT</th>}<th>STATUS</th><th></th></tr></thead><tbody>
          {sales.map(s=>{ const profit = saleProfit(s,products); return <tr key={s.id}><td><b style={{color:'#0f766e',fontSize:'12px'}}>{s.invoiceNumber}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{s.id}</small>{s.editCount>0 && <small style={{display:'block',fontSize:'10px',color:'#92400e',fontWeight:700}} title={`Corrected by ${s.editedBy} · last ${new Date(s.editedAt).toLocaleString('en-GH')}`}>✎ corrected ×{s.editCount}</small>}</td><td><b>{s.date===todayKey()?'Today':readableDate(s.date)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{s.time}</small></td><td>{s.customerName}</td><td>{s.cashier}</td><td><span className={`badge-pay ${s.payment.toLowerCase()}`}>{s.payment}</span></td><td><b>{saleUnits(s)}</b> <small style={{fontSize:'10px',color:'#6b7d76'}}>bought</small></td><td><b>{format(s.total)}</b></td>{isOwner&&<td><b style={{color:profit>0?'#065f46':profit<0?'#991b1b':'#6b7d76'}}>{format(profit)}</b></td>}<td><span className="status ok"><i/>Paid</span></td><td><div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}><button className="btn small" onClick={()=>onViewInvoice(s)}><Eye size={12}/> View</button><button className="btn small primary" onClick={()=>onViewReceipt(s)}><Printer size={12}/> Print receipt</button>{isOwner && <button className="btn small" onClick={()=>onEditSale(s)} title="Owner only — correct or delete this recorded sale"><Edit2 size={12}/> Correct</button>}</div></td></tr>})}
        </tbody>
        {sales.length>0 && <tfoot><tr>
          <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{sales.length} invoice{sales.length===1?'':'s'}</small></td>
          <td style={{color:'#6b7d76'}}>—</td><td style={{color:'#6b7d76'}}>—</td><td style={{color:'#6b7d76'}}>—</td><td style={{color:'#6b7d76'}}>—</td>
          <td><b>{totals.items.toLocaleString()}</b> <small style={{fontSize:'10px',color:'#6b7d76'}}>bought</small></td>
          <td><b>{format(totals.total)}</b></td>
          {isOwner&&<td><b style={{color:totals.profit>0?'#065f46':'#991b1b'}}>{format(totals.profit)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{totalMargin.toFixed(0)}% · cost {format(totals.cost)}</small></td>}
          <td style={{fontSize:'10px',color:'#6b7d76'}}>all paid</td><td></td>
        </tr></tfoot>}
        </table></div>
        {sales.length===0 && <div className="empty-state"><FileText size={20}/><b>No sales found</b><small>{range.from?'No sales on the selected date range — pick another day on the calendar':'Try different filters'}</small></div>}
      </div>
    </div>
  );
}

function GiftAccountPage({giftCards,customers,sales,onAdd,onPayAccount}){
  const [tab,setTab]=useState('gift');
  const activeGift = giftCards.filter(g=>g.status==='active');
  const totalGift = activeGift.reduce((s,g)=>s+Number(g.balance||0),0);
  const receivable = customers.filter(c=>!c.isWalkIn && c.balance>0);
  const totalRec = receivable.reduce((s,c)=>s+Number(c.balance||0),0);

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Gift size={12}/> GIFT CARDS &amp; MONEY OWED</div><h1>Gift cards &amp; money owed</h1></div><button className="btn primary" onClick={onAdd}><Plus size={16}/> New gift card</button></div>

      <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
        <button className={`btn ${tab==='gift'?'primary':'ghost'}`} onClick={()=>setTab('gift')}><Gift size={14}/> Gift Cards · {format(totalGift)}</button>
        <button className={`btn ${tab==='account'?'primary':'ghost'}`} onClick={()=>setTab('account')}><Wallet size={14}/> Money Owed · {format(totalRec)}</button>
      </div>

      {tab==='gift' && (
        <div className="card">
          <div className="table-wrap"><table><thead><tr><th>CODE</th><th>CUSTOMER</th><th>BALANCE</th><th>ORIGINAL</th><th>EXPIRY</th><th>STATUS</th><th>USAGE</th></tr></thead><tbody>
            {giftCards.map(g=>{
              const used = sales.filter(s=>s.payment==='Gift' && s.paymentDetail?.code===g.code).length;
              return <tr key={g.id}><td><b style={{fontFamily:'monospace',fontSize:'12px'}}>{g.code}</b></td><td>{g.customerName||'—'}</td><td><b style={{color:g.balance>0?'#065f46':'#991b1b'}}>{format(g.balance)}</b></td><td>{format(g.original)}</td><td>{readableDate(g.expiry)}</td><td><span className={`status ${g.status==='active'?'ok':g.status==='used'?'bad':'warn'}`}><i/>{g.status}</span></td><td>{used} sales</td></tr>
            })}
          </tbody>
          {giftCards.length>0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{giftCards.length} card{giftCards.length===1?'':'s'} · {giftCards.filter(g=>g.status==='active').length} active</small></td>
            <td style={{color:'#6b7d76'}}>—</td>
            <td><b>{format(giftCards.reduce((s,g)=>s+Number(g.balance||0),0))}</b></td>
            <td><b>{format(giftCards.reduce((s,g)=>s+Number(g.original||0),0))}</b></td>
            <td style={{color:'#6b7d76',fontSize:'10px'}}>{format(giftCards.reduce((s,g)=>s+Math.max(0,Number(g.original||0)-Number(g.balance||0)),0))} redeemed</td>
            <td></td>
            <td><b>{sales.filter(s=>s.payment==='Gift').length}</b> {sales.filter(s=>s.payment==='Gift').length===1?'sale':'sales'}</td>
          </tr></tfoot>}
          </table></div>
        </div>
      )}

      {tab==='account' && (
        <div className="grid" style={{gridTemplateColumns:'1fr'}}>
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}><h2>Money owed by customers</h2><span className="chip"><Wallet size={14}/>{format(totalRec)} owed</span></div>
            <div className="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>BALANCE</th><th>LAST SALE</th><th></th></tr></thead><tbody>
              {receivable.map(c=>{
                const last = sales.filter(s=>s.customerId===c.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
                return <tr key={c.id}><td><b>{c.name}</b></td><td>{c.phone}</td><td><b style={{color:'#991b1b'}}>{format(c.balance)}</b></td><td>{last?`${readableDate(last.date)} · ${format(last.total)}`:'—'}</td><td><button className="btn small primary" onClick={()=>{ const amt=prompt(`Payment amount for ${c.name} (owes ${format(c.balance)}):`, String(c.balance)); if(amt && Number(amt)>0) onPayAccount(c.id, Number(amt))}}><DollarSign size={12}/> Collect</button></td></tr>
              })}
            </tbody>
            {receivable.length>0 && <tfoot><tr>
              <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{receivable.length} account{receivable.length===1?'':'s'}</small></td>
              <td style={{color:'#6b7d76'}}>—</td>
              <td><b style={{color:'#991b1b'}}>{format(totalRec)}</b></td>
              <td style={{color:'#6b7d76'}}>—</td><td></td>
            </tr></tfoot>}
            </table></div>
            {receivable.length===0 && <div className="empty-state"><CheckCircle2 size={20}/><b>All accounts clear</b><small>No customers owe</small></div>}
          </div>
          <div className="card" style={{background:'#fffbeb',borderColor:'#fde68a'}}>
            <h2 style={{display:'flex',alignItems:'center',gap:'8px'}}><ShieldCheck size={16}/> Owner combined money tracking</h2>
            <p className="sub" style={{marginTop:'6px',lineHeight:1.5}}>Amounts customers owe are money expected by the owner. When a customer pays, record it here and the balance reduces. Total owed {format(totalRec)} is money still to collect. All staff sales are already included in the owner combined total.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffPage({employees,sales,attendance,currentUser,onEdit,onAdd,onViewSales,onCredentials}){
  const [tab,setTab]=useState('team');
  const [attFilter,setAttFilter]=useState('All');
  const today = todayKey();
  const clockedInToday = attendance.filter(a=>a.date===today && !a.out);
  const attRows = attendance
    .filter(a=> attFilter==='All' || (attFilter==='Open' && !a.out) || (attFilter==='Today' && a.date===today))
    .slice().sort((a,b)=> (b.date+(b.in||'')).localeCompare(a.date+(a.in||'')));
  const totalHoursToday = attendance.filter(a=>a.date===today).reduce((s,a)=>s+Number(a.hours||0),0);
  const attHours = attRows.reduce((s,a)=>s+Number(a.hours||0),0);
  const attOpen = attRows.filter(a=>!a.out).length;
  const payroll = employees.reduce((s,e)=>s+Number(e.salary||0),0);

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Users size={12}/> STAFF TRACKING</div><h1>Staff tracking, attendance &amp; control</h1></div><button className="btn primary" onClick={onAdd}><UserPlus size={16}/> Create staff account</button></div>

      <div className="kpi-row" style={{marginBottom:'12px'}}>
        <span className="kpi"><Users size={14}/> <b>{employees.length}</b> staff</span>
        <span className="kpi" style={{background:clockedInToday.length?'#ecfdf5':'#f3f4f6'}}><AlarmClock size={14}/> <b>{clockedInToday.length}</b> clocked in now</span>
        <span className="kpi"><Clock3 size={14}/> <b>{totalHoursToday}</b> hours today</span>
        <span className="kpi"><Wallet size={14}/> Payroll <b>{format(payroll)}</b>/month</span>
      </div>

      <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
        <button className={`btn ${tab==='team'?'primary':'ghost'}`} onClick={()=>setTab('team')}><Users size={14}/> Team & performance</button>
        <button className={`btn ${tab==='attendance'?'primary':'ghost'}`} onClick={()=>setTab('attendance')}><ClipboardList size={14}/> Attendance log</button>
      </div>

      {tab==='team' && (
        <>
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',marginBottom:'14px'}}>
            {employees.map(emp=>{
              const empSales = sales.filter(s=>s.cashierId===emp.id || s.cashier===emp.name);
              const empTotal = empSales.reduce((s,x)=>s+Number(x.total||0),0);
              const empItems = empSales.reduce((s,x)=>s+Number(x.itemCount||0),0);
              const weekStart = daysAgo(7);
              const weekHours = attendance.filter(a=>a.employeeId===emp.id && a.date>=weekStart).reduce((s,a)=>s+Number(a.hours||0),0);
              const openShift = attendance.find(a=>a.employeeId===emp.id && a.date===today && !a.out);
              return <div key={emp.id} className="card" style={{padding:'14px'}}>
                <div style={{display:'flex',gap:'10px',alignItems:'center'}}><div className={`avatar ${emp.role==='owner'?'owner':'cashier'}`} style={{width:'40px',height:'40px'}}>{emp.initials}</div><div style={{flex:1}}><b style={{fontSize:'13px'}}>{emp.name}{currentUser?.id===emp.id?' (you)':''}</b><small style={{display:'block',fontSize:'11px',color:'#6b7d76'}}>{emp.role} · {emp.shift}{emp.username?` · signs in as @${emp.username}`:' · no username set'}</small></div><span className={`status ${openShift?'ok':emp.status==='On shift'?'info':'neutral'}`}><i/>{openShift?`In ${openShift.in}`:emp.status}</span></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'12px'}}>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>SALES COUNT</small><b style={{display:'block',fontSize:'14px'}}>{empSales.length}</b></div>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>TOTAL TO OWNER</small><b style={{display:'block',fontSize:'14px'}}>{format(empTotal)}</b></div>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>ITEMS SOLD</small><b style={{display:'block',fontSize:'14px'}}>{empItems}</b></div>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>HOURS (7 DAYS)</small><b style={{display:'block',fontSize:'14px'}}>{weekHours}h</b></div>
                </div>
                <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}><button className="btn small primary" onClick={()=>onViewSales(emp)}><FileText size={12}/> Sales history</button><button className="btn small" onClick={()=>onEdit(emp)}><Edit2 size={12}/> Edit</button><button className="btn small" onClick={()=>onCredentials(emp)} title={`Change ${currentUser?.id===emp.id?'your own':emp.name+"'s"} username or password`}><KeyRound size={12}/> Login</button><span style={{fontSize:'11px',color:'#6b7d76',marginLeft:'auto',alignSelf:'center'}}>{emp.phone}</span></div>
              </div>
            })}
          </div>

        </>
      )}

      {tab==='attendance' && (
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            <div><h2>Attendance log</h2><p className="sub">Clock-in/out history and worked hours</p></div>
            <div style={{display:'flex',gap:'6px'}}>
              {['All','Today','Open'].map(f=><button key={f} className={`btn small ${attFilter===f?'primary':'ghost'}`} onClick={()=>setAttFilter(f)}>{f}</button>)}
              <button className="btn small" onClick={()=>{ const header=['Date','Staff','Clock in','Clock out','Hours','Status']; const rows=attRows.map(a=>[a.date,a.name,a.in,a.out||'',a.hours??'',a.out?'Complete':'On shift']); const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`attendance-${todayKey()}.csv`; a.click(); URL.revokeObjectURL(url)}}><Download size={12}/> Export</button>
            </div>
          </div>
          <div className="table-wrap"><table><thead><tr><th>DATE</th><th>STAFF</th><th>CLOCK IN</th><th>CLOCK OUT</th><th>HOURS</th><th>STATUS</th></tr></thead><tbody>
            {attRows.map(a=>(
              <tr key={a.id}>
                <td><b style={{fontSize:'12px'}}>{a.date===today?'Today':readableDate(a.date)}</b></td>
                <td><div style={{display:'flex',alignItems:'center',gap:'8px'}}><div className="avatar cashier" style={{width:'26px',height:'26px',fontSize:'9px'}}>{initials(a.name)}</div><b style={{fontSize:'12px'}}>{a.name}</b></div></td>
                <td>{a.in}</td>
                <td>{a.out||'—'}</td>
                <td><b>{a.hours!=null?`${a.hours}h`:'—'}</b></td>
                <td><span className={`status ${a.out?'ok':'info'}`}><i/>{a.out?'Complete':'On shift'}</span></td>
              </tr>
            ))}
          </tbody>
          {attRows.length>0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{attRows.length} record{attRows.length===1?'':'s'}</small></td>
            <td style={{fontSize:'10px',color:'#6b7d76'}}>{new Set(attRows.map(a=>a.name)).size} staff</td>
            <td style={{color:'#6b7d76'}}>—</td><td style={{color:'#6b7d76'}}>—</td>
            <td><b>{Number(attHours.toFixed(2))}h</b></td>
            <td style={{fontSize:'10px',color:'#6b7d76'}}>{attOpen} open shift{attOpen===1?'':'s'}</td>
          </tr></tfoot>}
          </table></div>
          {attRows.length===0 && <div className="empty-state"><ClipboardList size={20}/><b>No attendance records</b><small>Use “Clock in” in the top bar to start a shift</small></div>}
          <div style={{marginTop:'10px',fontSize:'11px',color:'#6b7d76'}}>Staff clock in and out from the top bar of any workspace. Hours are calculated automatically.</div>
        </div>
      )}
    </div>
  );
}

function ReportsPage({sales,products,customers,giftCards,expenses}){
  const [range,setRange]=useState('week');
  const now=new Date();
  const inRange = (d)=>{
    if(range==='today') return d===todayKey();
    if(range==='week'){ const day=new Date(); day.setDate(day.getDate()-7); return d>=day.toISOString().slice(0,10) }
    if(range==='month') return d.startsWith(now.toISOString().slice(0,7));
    return true;
  };
  const filtered = sales.filter(s=>inRange(s.date));
  const filteredExp = expenses.filter(e=>inRange(e.date));
  const total = filtered.reduce((s,x)=>s+Number(x.total||0),0);
  const expenseTotal = filteredExp.reduce((s,e)=>s+Number(e.amount||0),0);
  const cogs = filtered.reduce((sum,s)=>{
    let c=0; s.items?.forEach(it=>{ const prod=products.find(pr=>pr.id===it.productId); c+=(prod?.cost||0)*it.qty }); return sum+c;
  },0);
  const unitsBought = filtered.reduce((sum,x)=>sum+saleUnits(x),0);
  const grossProfit = total - cogs;
  const netProfit = grossProfit - expenseTotal;
  const byPayment = paymentMethods.map(pm=>({method:pm.id,total:filtered.filter(s=>s.payment===pm.id).reduce((s,x)=>s+Number(x.total||0),0),count:filtered.filter(s=>s.payment===pm.id).length}));
  const receivable = customers.reduce((s,c)=>s+Number(c.balance||0),0);
  const giftLiab = giftCards.filter(g=>g.status==='active').reduce((s,g)=>s+Number(g.balance||0),0);

  // daily bars last 7 days (revenue vs expenses)
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const key=d.toISOString().slice(0,10); const daySales=sales.filter(s=>s.date===key); const dayExp=expenses.filter(e=>e.date===key); return {key,label:d.toLocaleDateString('en-GH',{weekday:'short'}),total:daySales.reduce((s,x)=>s+Number(x.total||0),0),exp:dayExp.reduce((s,e)=>s+Number(e.amount||0),0)} });
  const maxDay = Math.max(1,...days.map(d=>Math.max(d.total,d.exp)));

  // expense breakdown by category
  const byCategory = expenseCategories.map(cat=>({cat,total:filteredExp.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.amount||0),0),count:filteredExp.filter(e=>e.category===cat).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const maxCat = Math.max(1,...byCategory.map(c=>c.total));

  const exportReport = ()=>{
    const lines = [
      ['POSI Business Report', range.toUpperCase(), todayKey()],
      [],
      ['Metric','Amount (GH\u20b5)'],
      ['Revenue', total.toFixed(2)],
      ['Cost of goods sold', cogs.toFixed(2)],
      ['Gross profit', grossProfit.toFixed(2)],
      ['Expenses', expenseTotal.toFixed(2)],
      ['Net profit', netProfit.toFixed(2)],
      ['Money owed by customers', receivable.toFixed(2)],
      ['Gift card liability', giftLiab.toFixed(2)],
      [],
      ['Expenses by category','Amount (GH\u20b5)','Entries'],
      ...byCategory.map(c=>[c.cat,c.total.toFixed(2),c.count]),
      [],
      ['Invoice','Date','Cashier','Payment','Units bought','Cost of goods','Profit','Total'],
      ...filtered.map(s=>{
        const c = saleCost(s, products);
        return [s.invoiceNumber,s.date,s.cashier,s.payment,saleUnits(s),c.toFixed(2),(Number(s.total||0)-c).toFixed(2),Number(s.total).toFixed(2)];
      }),
      ['TOTAL','','','',unitsBought,cogs.toFixed(2),grossProfit.toFixed(2),total.toFixed(2)],
      [],
      ['Expense','Date','Category','Note','Amount'],
      ...filteredExp.map(e=>[e.id,e.date,e.category,e.note,Number(e.amount).toFixed(2)]),
    ];
    const csv = lines.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    const a=document.createElement('a'); a.href=url; a.download=`business-report-${range}-${todayKey()}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><BarChart3 size={12}/> BUSINESS REPORT</div><h1>Business report — revenue, expenses & profit</h1><p>Revenue, cost of goods, expenses and net profit with payment and category breakdowns. All cashier accounts combined.</p></div><div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>{['today','week','month','all'].map(r=><button key={r} className={`btn small ${range===r?'primary':'ghost'}`} onClick={()=>setRange(r)}>{r.toUpperCase()}</button>)}<button className="btn small" onClick={exportReport}><Download size={12}/> Export CSV</button></div></div>

      <div className="grid metrics" style={{marginBottom:'14px'}}>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><DollarSign size={16}/></div></div><div className="metric-label">Revenue ({range})</div><div className="metric-value">{format(total)}</div><div className="metric-note">{filtered.length} invoices · <b>{unitsBought.toLocaleString()}</b> products bought</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon dark"><TrendingUp size={16}/></div></div><div className="metric-label">Gross profit (after COGS)</div><div className="metric-value">{format(grossProfit)}</div><div className="metric-note">{total?`${(grossProfit/total*100).toFixed(1)}% margin · COGS ${format(cogs)}`:`COGS ${format(cogs)}`} · summed over {filtered.length} invoices</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon amber"><Coins size={16}/></div></div><div className="metric-label">Expenses ({range})</div><div className="metric-value">{format(expenseTotal)}</div><div className="metric-note"><button className="link-btn" onClick={()=>document.getElementById('exp-breakdown')?.scrollIntoView({behavior:'smooth'})}>{filteredExp.length} entries · {byCategory.length} categories</button></div></div>
        <div className="card metric-card"><div className="metric-top"><div className={`metric-icon ${netProfit>=0?'green':'blue'}`}><TrendingDown size={16}/></div></div><div className="metric-label">Net profit (after expenses)</div><div className="metric-value" style={{color:netProfit>=0?'#065f46':'#991b1b'}}>{format(netProfit)}</div><div className="metric-note">{netProfit>=0?'Profitable in this period':'Running a loss in this period'}</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon amber"><Wallet size={16}/></div></div><div className="metric-label">Money owed by customers</div><div className="metric-value">{format(receivable)}</div><div className="metric-note">Owed to owner</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon violet"><Gift size={16}/></div></div><div className="metric-label">Gift liability</div><div className="metric-value">{format(giftLiab)}</div><div className="metric-note">Active gift cards</div></div>
      </div>

      <div className="grid layout-2">
        <div className="card">
          <h2>Revenue vs expenses — last 7 days</h2><p className="sub">Daily income against daily spending</p>
          <div className="bars dual">
            {days.map(d=><div key={d.key} className="bar"><div className="dual-tracks"><div className="bar-track"><div className="bar-fill" style={{height:`${(d.total/maxDay)*100}%`}}/></div><div className="bar-track"><div className="bar-fill exp" style={{height:`${(d.exp/maxDay)*100}%`}}/></div></div><small>{d.label}</small><b style={{fontSize:'9px'}}>{d.total?format(d.total).replace('GH\u20b5','').trim():'0'}</b></div>)}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px',fontSize:'11px',color:'#6b7d76',flexWrap:'wrap',gap:'6px'}}><span><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'2px',background:'#0f766e',marginRight:'4px'}}/>Revenue 7d: {format(days.reduce((s,d)=>s+d.total,0))}</span><span><span style={{display:'inline-block',width:'8px',height:'8px',borderRadius:'2px',background:'#d97706',marginRight:'4px'}}/>Expenses 7d: {format(days.reduce((s,d)=>s+d.exp,0))}</span></div>
        </div>

        <div className="card">
          <h2>Payment breakdown — owner combined</h2><p className="sub">Cash, MoMo, Gift</p>
          <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
            {byPayment.map(bp=>{
              const pct = total? (bp.total/total*100):0;
              return <div key={bp.method}><div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'4px'}}><span><span className={`badge-pay ${bp.method.toLowerCase()}`}>{bp.method}</span> {bp.count} invoices</span><b>{format(bp.total)} · {pct.toFixed(1)}%</b></div><div className="progress"><i style={{width:`${pct}%`}}/></div></div>
            })}
          </div>
        </div>

        <div className="card" id="exp-breakdown">
          <h2>Expenses by category</h2><p className="sub">Where the money went ({range})</p>
          {byCategory.length? (
            <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
              {byCategory.map(c=>{
                const pct = expenseTotal? (c.total/expenseTotal*100):0;
                return <div key={c.cat}><div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'4px'}}><span>{c.cat} · {c.count} {c.count===1?'entry':'entries'}</span><b>{format(c.total)} · {pct.toFixed(1)}%</b></div><div className="progress"><i style={{width:`${(c.total/maxCat)*100}%`,background:'linear-gradient(90deg,#d97706,#fbbf24)'}}/></div></div>
              })}
            </div>
          ) : <div className="empty-state"><Coins size={20}/><b>No expenses in this period</b><small>Record expenses to see the breakdown</small></div>}
        </div>

        <div className="card">
          <h2>Net position</h2><p className="sub">Owner combined accounting</p>
          <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'8px',fontSize:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px',background:'#ecfdf5',borderRadius:'8px'}}><span>Cash + MoMo collected</span><b>{format(byPayment.filter(b=>['Cash','MoMo'].includes(b.method)).reduce((s,b)=>s+b.total,0))}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px',background:'#fffbeb',borderRadius:'8px'}}><span>Money owed by customers (to collect)</span><b>{format(receivable)}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px',background:'#fef2f2',borderRadius:'8px'}}><span>Less: expenses paid</span><b>-{format(expenseTotal)}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px',background:'#ede9fe',borderRadius:'8px'}}><span>Gift card liability (prepaid, owed as goods)</span><b>{format(giftLiab)}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'12px',background:'#0f2320',color:'#fff',borderRadius:'8px',fontWeight:800}}><span>Net position (revenue + receivable − expenses)</span><b>{format(total+receivable-expenseTotal)}</b></div>
          </div>
        </div>

        <div className="card">
          <h2>Top products by revenue</h2><p className="sub">From combined sales</p>
          <div style={{marginTop:'10px'}}>
            {(()=>{
              const m=new Map(); filtered.forEach(s=>s.items?.forEach(it=>{ const cur=m.get(it.name)||{name:it.name,qty:0,rev:0}; cur.qty+=it.qty; cur.rev+=it.lineTotal; m.set(it.name,cur)})); const top=[...m.values()].sort((a,b)=>b.rev-a.rev).slice(0,5);
              return top.length? top.map((p,i)=><div key={p.name} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0',borderTop:'1px solid #f1f5f1'}}><span style={{width:'20px',height:'20px',borderRadius:'6px',background:'#f3f4f6',display:'grid',placeItems:'center',fontSize:'10px',fontWeight:'800'}}>{i+1}</span><span style={{flex:1}}><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{p.qty} units</small></span><b>{format(p.rev)}</b></div>) : <div className="empty-state"><b>No data</b></div>
            })()}
          </div>
        </div>

        <div className="card">
          <h2>Recent expenses ({range})</h2><p className="sub">Latest recorded spending</p>
          <div style={{marginTop:'10px'}}>
            {filteredExp.length? filteredExp.slice(0,6).map(e=><div key={e.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0',borderTop:'1px solid #f1f5f1'}}><span className="badge-pay" style={{background:'#fffbeb',color:'#92400e'}}>{e.category}</span><span style={{flex:1,minWidth:0}}><b style={{fontSize:'12px',display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.note||'Expense'}</b><small style={{fontSize:'10px',color:'#6b7d76'}}>{readableDate(e.date)} · {e.payment} · {e.by}</small></span><b style={{fontSize:'12px',color:'#991b1b'}}>-{format(e.amount)}</b></div>) : <div className="empty-state"><b>No expenses</b><small>Recorded expenses will appear here</small></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagesPage({messages,employees,currentUser,isOwner,onSend,onMarkRead}){
  const [filter,setFilter]=useState('all');
  const inbox = messages.filter(m=> isOwner || m.to==='all' || m.to===currentUser.id || m.fromId===currentUser.id);
  const filtered = inbox.filter(m=>{
    if(filter==='unread') return !m.readBy?.includes(currentUser.id) && m.to!=='self' && m.fromId!==currentUser.id;
    if(filter==='sent') return m.fromId===currentUser.id;
    return true;
  });
  const unread = inbox.filter(m=> !m.readBy?.includes(currentUser.id) && m.fromId!==currentUser.id).length;

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><MessageSquare size={12}/> {isOwner?'OWNER MESSAGES TO EMPLOYEES':'MESSAGES'}</div><h1>{isOwner?'Messages — owner to employees':'Messages'}</h1>{isOwner && <p>Owner can broadcast to all or send to specific employee. Employees see inbox. Combined account shop communication.</p>}</div>{isOwner && <button className="btn primary" onClick={onSend}><Send size={16}/> New message</button>}</div>

      <div className="kpi-row" style={{marginBottom:'12px'}}><span className="kpi"><b>{inbox.length}</b> total</span><span className="kpi" style={{background:unread?'#fef3c7':'#ecfdf5'}}><Mail size={14}/> <b>{unread}</b> unread</span><div style={{marginLeft:'auto',display:'flex',gap:'6px'}}>{['all','unread','sent'].map(f=><button key={f} className={`btn small ${filter===f?'primary':'ghost'}`} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>

      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {filtered.map(m=>{
          const isUnread = !m.readBy?.includes(currentUser.id) && m.fromId!==currentUser.id;
          return <div key={m.id} className={`msg ${isUnread?'unread':''}`} onClick={()=>onMarkRead(m.id,currentUser.id)}>
            {isUnread && <span className="msg-dot"/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'8px',alignItems:'center'}}><b>{m.subject}</b><small style={{fontSize:'10px',color:'#6b7d76'}}>{readableDate(m.date)} · {m.time}</small></div>
              <small>From: {m.from} → To: {m.toName} {m.fromId===currentUser.id && '(You sent)'}</small>
              <p>{m.body}</p>
              {isOwner && <small style={{marginTop:'6px',color:'#6b7d76'}}>Read by: {m.readBy?.length? employees.filter(e=>m.readBy.includes(e.id)).map(e=>e.name).join(', ') : 'No one yet'}</small>}
            </div>
          </div>
        })}
        {filtered.length===0 && <div className="empty-state"><MessageSquare size={20}/><b>No messages</b><small>{filter==='unread'?'All caught up':'No messages in this filter'}</small></div>}
      </div>

      {isOwner && <div className="card" style={{marginTop:'14px',background:'#f6fffe',borderColor:'#ccede8'}}>
        <h2 style={{display:'flex',alignItems:'center',gap:'8px'}}><ShieldCheck size={16}/> Owner message control</h2>
        <p className="sub" style={{marginTop:'6px'}}>Only the owner can send messages to staff. Messages are shop-wide — use for shift notes, payment reminders and stock alerts. Employees can read messages but cannot send or reply.</p>
      </div>}
    </div>
  );
}

function StaffSalesModal({employee,sales,products=[],onClose,onViewInvoice,onViewReceipt,onEdit}){
  const empSales = sales.filter(s=>s.cashierId===employee.id || s.cashier===employee.name);
  const total = empSales.reduce((s,x)=>s+Number(x.total||0),0);
  const items = empSales.reduce((s,x)=>s+saleUnits(x),0);
  const profit = empSales.reduce((s,x)=>s+saleProfit(x,products),0);
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal wide"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#dbeafe',color:'#1e40af',display:'grid',placeItems:'center'}}><FileText size={18}/></div><div><h3>{employee.name} — sales history</h3><p>Every sale recorded by this employee · combined to owner</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <div className="modal-body">
          <div className="kpi-row">
            <span className="kpi"><FileText size={14}/> <b>{empSales.length}</b> invoices</span>
            <span className="kpi"><Wallet size={14}/> <b>{format(total)}</b> total</span>
            <span className="kpi"><Package size={14}/> <b>{items}</b> products bought</span>
            <span className="kpi" style={{background:'#ecfdf5'}}><PiggyBank size={14}/> <b>{format(profit)}</b> profit</span>
            <button className="btn small" style={{marginLeft:'auto'}} onClick={()=>{ const header=['Invoice','Date','Time','Customer','Payment','Items','Total']; const rows=empSales.map(s=>[s.invoiceNumber,s.date,s.time,s.customerName,s.payment,s.itemCount,s.total]); const csv=[header,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`sales-${employee.name.replaceAll(' ','-')}-${todayKey()}.csv`; a.click(); URL.revokeObjectURL(url)}}><Download size={12}/> Export CSV</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>DATE</th><th>CUSTOMER</th><th>PAYMENT</th><th>ITEMS</th><th>TOTAL</th><th></th></tr></thead><tbody>
            {empSales.map(s=>(
              <tr key={s.id}>
                <td><b style={{color:'#0f766e',fontSize:'12px'}}>{s.invoiceNumber}</b>{s.editCount>0 && <small style={{display:'block',fontSize:'10px',color:'#92400e',fontWeight:700}}>✎ corrected ×{s.editCount}</small>}</td>
                <td><b style={{fontSize:'12px'}}>{s.date===todayKey()?'Today':readableDate(s.date)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{s.time}</small></td>
                <td>{s.customerName}</td>
                <td><span className={`badge-pay ${s.payment.toLowerCase()}`}>{s.payment}</span></td>
                <td>{s.itemCount}</td>
                <td><b>{format(s.total)}</b></td>
                <td><div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}><button className="btn small" onClick={()=>onViewInvoice(s)}><Eye size={12}/> View</button><button className="btn small primary" onClick={()=>onViewReceipt(s)}><Printer size={12}/> Print receipt</button>{onEdit && <button className="btn small" onClick={()=>onEdit(s)} title="Owner only — correct or delete this sale"><Edit2 size={12}/> Correct</button>}</div></td>
              </tr>
            ))}
          </tbody>
          {empSales.length>0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{empSales.length} invoice{empSales.length===1?'':'s'}</small></td>
            <td style={{color:'#6b7d76'}}>—</td><td style={{color:'#6b7d76'}}>—</td><td style={{color:'#6b7d76'}}>—</td>
            <td><b>{items.toLocaleString()}</b> bought</td>
            <td><b>{format(total)}</b></td><td></td>
          </tr></tfoot>}
          </table></div>
          {empSales.length===0 && <div className="empty-state"><FileText size={20}/><b>No sales yet</b><small>Sales made by {employee.name} will appear here</small></div>}
        </div>
        <div className="modal-foot"><button className="btn primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function ExpensesPage({expenses,onEdit,onAdd,onDelete}){
  const [q,setQ]=useState('');
  const [cat,setCat]=useState('All');
  const [range,setRange]=useState('All');
  const filtered = expenses.filter(e=>{
    const matchesQ = `${e.category} ${e.note} ${e.payment} ${e.by}`.toLowerCase().includes(q.toLowerCase());
    const matchesCat = cat==='All'||e.category===cat;
    let matchesRange = true;
    if(range==='Today') matchesRange = e.date===todayKey();
    if(range==='Week'){ const d=new Date(); d.setDate(d.getDate()-7); matchesRange = e.date>=d.toISOString().slice(0,10) }
    if(range==='Month') matchesRange = e.date.startsWith(new Date().toISOString().slice(0,7));
    return matchesQ && matchesCat && matchesRange;
  });
  const total = filtered.reduce((s,e)=>s+Number(e.amount||0),0);
  const todayTotal = expenses.filter(e=>e.date===todayKey()).reduce((s,e)=>s+Number(e.amount||0),0);
  const weekTotal = expenses.filter(e=>{ const d=new Date(); d.setDate(d.getDate()-7); return e.date>=d.toISOString().slice(0,10) }).reduce((s,e)=>s+Number(e.amount||0),0);
  const monthTotal = expenses.filter(e=>e.date.startsWith(new Date().toISOString().slice(0,7))).reduce((s,e)=>s+Number(e.amount||0),0);
  const byCategory = expenseCategories.map(c=>({cat:c,total:filtered.filter(e=>e.category===c).reduce((s,e)=>s+Number(e.amount||0),0),count:filtered.filter(e=>e.category===c).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const maxCat = Math.max(1,...byCategory.map(c=>c.total));
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Coins size={12}/> EXPENSES</div><h1>Expenses & business spending</h1></div><button className="btn primary" onClick={onAdd}><Plus size={16}/> Record expense</button></div>
      <div className="kpi-row" style={{marginBottom:'12px'}}>
        <span className="kpi"><CalendarDays size={14}/> Today <b>{format(todayTotal)}</b></span>
        <span className="kpi"><Clock3 size={14}/> Last 7 days <b>{format(weekTotal)}</b></span>
        <span className="kpi"><BarChart3 size={14}/> This month <b>{format(monthTotal)}</b></span>
        <span className="kpi" style={{background:'#fffbeb'}}><Wallet size={14}/> Filtered total <b>{format(total)}</b></span>
        <span className="kpi"><ClipboardList size={14}/> <b>{filtered.length}</b> entries</span>
      </div>

      <div className="grid layout-2" style={{marginBottom:'14px',alignItems:'start'}}>
        <div className="card">
          <div className="toolbar">
            <div className="search" style={{maxWidth:'320px'}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={selectOnEnter} placeholder="Search note, category, staff…"/></div>
            <select value={cat} onChange={e=>setCat(e.target.value)} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option>All</option>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select>
            <select value={range} onChange={e=>setRange(e.target.value)} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option value="All">All dates</option><option value="Today">Today</option><option value="Week">Last 7 days</option><option value="Month">This month</option></select>
            <button className="btn small" onClick={()=>{ const header=['ID','Date','Category','Note','Payment','Recorded by','Amount']; const rows=filtered.map(e=>[e.id,e.date,e.category,e.note,e.payment,e.by,e.amount]); const csv=[header,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`expenses-${todayKey()}.csv`; a.click(); URL.revokeObjectURL(url)}}><Download size={14}/> Export CSV</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>DATE</th><th>CATEGORY</th><th>NOTE</th><th>PAYMENT</th><th>RECORDED BY</th><th>AMOUNT</th><th></th></tr></thead><tbody>
            {filtered.map(e=>(
              <tr key={e.id}>
                <td><b style={{fontSize:'12px'}}>{e.date===todayKey()?'Today':readableDate(e.date)}</b></td>
                <td><span className="badge-pay" style={{background:'#fffbeb',color:'#92400e'}}>{e.category}</span></td>
                <td>{e.note||'—'}</td>
                <td><span className={`badge-pay ${String(e.payment||'').toLowerCase()}`}>{e.payment}</span></td>
                <td>{e.by}</td>
                <td><b style={{color:'#991b1b'}}>{format(e.amount)}</b></td>
                <td><div style={{display:'flex',gap:'4px'}}><button className="btn small" onClick={()=>onEdit(e)}><Edit2 size={12}/> Edit</button><button className="btn small" style={{color:'#b91c1c'}} onClick={()=>{if(confirm('Delete this expense?')) onDelete(e.id)}}><Trash2 size={12}/></button></div></td>
              </tr>
            ))}
          </tbody>
          {filtered.length>0 && <tfoot><tr>
            <td><b>Totals</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{filtered.length} entr{filtered.length===1?'y':'ies'}</small></td>
            <td style={{fontSize:'10px',color:'#6b7d76'}}>{byCategory.length} categor{byCategory.length===1?'y':'ies'}</td>
            <td style={{color:'#6b7d76'}}>—</td>
            <td style={{fontSize:'10px',color:'#6b7d76'}}>
              {paymentMethods.filter(pm=>filtered.some(e=>e.payment===pm.id)).map(pm=>`${pm.label} ${format(filtered.filter(e=>e.payment===pm.id).reduce((s,e)=>s+Number(e.amount||0),0))}`).join(' · ')||'—'}
            </td>
            <td style={{fontSize:'10px',color:'#6b7d76'}}>{new Set(filtered.map(e=>e.by)).size} staff</td>
            <td><b style={{color:'#991b1b'}}>{format(total)}</b></td>
            <td></td>
          </tr></tfoot>}
          </table></div>
          {filtered.length===0 && <div className="empty-state"><Coins size={20}/><b>No expenses found</b><small>Try different filters or record a new expense</small></div>}
        </div>

        <div className="card">
          <h2>Spending by category</h2><p className="sub">Current filter selection</p>
          {byCategory.length? (
            <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'12px'}}>
              {byCategory.map(c=>{
                const pct = total? (c.total/total*100):0;
                return <div key={c.cat}><div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',marginBottom:'4px'}}><span>{c.cat} · {c.count} {c.count===1?'entry':'entries'}</span><b>{format(c.total)} · {pct.toFixed(1)}%</b></div><div className="progress"><i style={{width:`${(c.total/maxCat)*100}%`,background:'linear-gradient(90deg,#d97706,#fbbf24)'}}/></div></div>
              })}
            </div>
          ) : <div className="empty-state"><b>No data</b><small>Category breakdown appears once expenses are recorded</small></div>}
          <div style={{marginTop:'14px',padding:'10px',borderRadius:'8px',background:'#fffbeb',border:'1px solid #fde68a',fontSize:'11px',color:'#92400e',display:'flex',gap:'8px'}}><AlertTriangle size={14}/><span><b>Tip:</b> keep transport and supplies costs logged so business reports show true net profit.</span></div>
        </div>
      </div>
    </div>
  );
}

// Modals

function StockModal({stock,onClose,onSave}){
  const {product,mode}=stock;
  const isRestock = mode==='restock';
  const [qty,setQty]=useState(isRestock?'10':'1');
  const [note,setNote]=useState('');
  const [cost,setCost]=useState(product.cost??'');
  const submit=(e)=>{
    e.preventDefault();
    onSave({product, mode, qty, note, cost: isRestock? cost : undefined});
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:isRestock?'#dbeafe':'#fef3c7',color:isRestock?'#1e40af':'#92400e',display:'grid',placeItems:'center'}}>{isRestock?<Plus size={18}/>:<AlertTriangle size={18}/>}</div><div><h3>{isRestock?'Restock — stock in':'Adjust stock'}</h3><p>{product.name} · current stock {product.stock} units</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>{isRestock?'Quantity to add *':'Adjustment quantity (use minus for losses)'}</label><input type="number" step="1" value={qty} onChange={e=>setQty(e.target.value)} required/></div>
          {isRestock && <div className="field"><label>Unit cost (GH₵) — updates product cost</label><input type="number" step="0.01" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></div>}
          <div className="field"><label>{isRestock?'Supplier / note':'Reason (damage, loss, count correction…)'}</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder={isRestock?'e.g. Royal Farms delivery':'e.g. 2 packs damaged'}/></div>
          <div style={{padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px',fontSize:'12px',display:'flex',justifyContent:'space-between'}}><span>Stock after this change</span><b>{Math.max(0, product.stock + (isRestock?Math.abs(Number(qty)||0):-Math.abs(Number(qty)||0)))} units</b></div>
          <div style={{fontSize:'11px',color:'#6b7d76'}}>This change is recorded in the stock movement log with your name and the time.</div>
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary"><Check size={14}/>{isRestock?'Add stock':'Save adjustment'}</button></div></form>
      </div>
    </div>
  );
}

function ExpenseModal({expense,onClose,onSave,employees}){
  const [form,setForm]=useState(expense||{date:todayKey(),category:'Supplies',amount:'',payment:'Cash',note:''});
  const [err,setErr]=useState('');
  const submit=(e)=>{
    e.preventDefault();
    if(!form.amount || Number(form.amount)<=0){ setErr('Enter a valid amount'); return }
    onSave({
      id: expense?.id || uid('x'),
      date: form.date || todayKey(),
      category: form.category,
      amount: Number(form.amount),
      payment: form.payment,
      note: (form.note||'').trim(),
      by: expense?.by || employees?.find(e=>e.role==='owner')?.name || 'Owner',
    });
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#fffbeb',color:'#92400e',display:'grid',placeItems:'center'}}><Coins size={18}/></div><div><h3>{expense?'Edit expense':'Record expense'}</h3><p>Business spending — shows in reports</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="two"><div className="field"><label>Date *</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required/></div><div className="field"><label>Category *</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></div></div>
          <div className="two"><div className="field"><label>Amount (GH₵) *</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} required/></div><div className="field"><label>Paid by</label><select value={form.payment} onChange={e=>setForm(f=>({...f,payment:e.target.value}))}><option>Cash</option><option>MoMo</option><option>Gift</option></select></div></div>
          <div className="field"><label>Note</label><input value={form.note||''} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Electricity top-up (ECG)"/></div>
          {err && <div style={{color:'#b91c1c',fontSize:'12px'}}>{err}</div>}
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary"><Check size={14}/>{expense?'Save changes':'Record expense'}</button></div></form>
      </div>
    </div>
  );
}

function ProductModal({product,categories,defaultLowStock=5,onClose,onSave}){
  const [form,setForm]=useState(product||{name:'',sku:'',category:'Other',brand:'',price:'',cost:'',stock:'',barcode:'',supplier:'',expiry:'',lowStockAt:defaultLowStock});
  const [err,setErr]=useState('');
  const submit = (e)=>{
    e.preventDefault();
    if(!form.name.trim()||form.price===''||Number(form.price)<0){ setErr('Enter name and valid price'); return }
    if(form.stock===''||Number(form.stock)<0){ setErr('Enter valid stock'); return }
    const p = {
      id: product?.id||uid('p'),
      name: form.name.trim(),
      sku: form.sku.trim()||`SKU-${Date.now().toString().slice(-4)}`,
      category: form.category,
      brand: form.brand.trim()||form.category,
      price: Number(form.price),
      cost: Number(form.cost||0),
      stock: Math.floor(Number(form.stock)),
      barcode: form.barcode.trim(),
      supplier: form.supplier?.trim()||'',
      lowStockAt: Math.max(0, Math.floor(Number(form.lowStockAt ?? 5))),
      expiry: (form.expiry||'').trim(),
    };
    onSave(p);
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#e6f4f1',color:'#0f766e',display:'grid',placeItems:'center'}}><Package size={18}/></div><div><h3>{product?'Edit item':'Add item'}</h3><p>Item list — owner controls inventory</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Product name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Paracetamol 500mg" required/></div>
          <div className="field"><label>Brand / size</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="e.g. 5kg"/></div>
          <div className="two"><div className="field"><label>Selling price (GH₵) *</label><input type="number" step="0.01" min="0" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required/></div><div className="field"><label>Cost price (for profit)</label><input type="number" step="0.01" min="0" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="0"/></div></div>
          <div className="two"><div className="field"><label>Stock quantity *</label><input type="number" min="0" step="1" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} required/></div><div className="field"><label>Reorder level (low stock alert at)</label><input type="number" min="0" step="1" value={form.lowStockAt??5} onChange={e=>setForm(f=>({...f,lowStockAt:e.target.value}))}/></div></div>
          <div className="two"><div className="field"><label>SKU</label><input value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="Auto if empty"/></div><div className="field"><label>Supplier (optional)</label><input value={form.supplier||''} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} placeholder="e.g. Royal Farms"/></div></div>
          <div className="field"><label>Expiry date</label><input type="date" value={form.expiry||''} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/><small>Items inside {EXPIRY_SOON_DAYS} days of expiry are flagged automatically. Leave empty if not applicable.</small></div>
          <div className="field"><label>Barcode (optional)</label><input value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))} placeholder="Scan or enter"/></div>
          {err && <div style={{color:'#b91c1c',fontSize:'12px'}}>{err}</div>}
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary"><Check size={14}/>{product?'Save changes':'Add item'}</button></div></form>
      </div>
    </div>
  );
}

function CustomerModal({customer,onClose,onSave}){
  const [form,setForm]=useState(customer||{name:'',phone:'',email:'',address:'',balance:0});
  const [err,setErr]=useState('');
  const submit=(e)=>{
    e.preventDefault();
    if(!form.name.trim()){ setErr('Name required'); return }
    onSave({id:customer?.id||uid('c'), name:form.name.trim(), phone:form.phone.trim(), email:form.email.trim(), address:form.address.trim(), balance: Number(customer?.balance||form.balance||0), totalSpent: Number(customer?.totalSpent||0), visits: Number(customer?.visits||0), isWalkIn:false});
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#dbeafe',color:'#1e40af',display:'grid',placeItems:'center'}}><Users size={18}/></div><div><h3>{customer?'Edit customer':'Add customer'}</h3><p>Customer list — balances combine to owner</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></div>
          <div className="two"><div className="field"><label>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="0244..."/></div><div className="field"><label>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="optional"/></div></div>
          <div className="field"><label>Address</label><input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Location"/></div>
          {customer && <div className="field"><label>Balance (GH₵ owes)</label><input type="number" step="0.01" value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))}/></div>}
          {err && <div style={{color:'#b91c1c',fontSize:'12px'}}>{err}</div>}
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary"><Check size={14}/>{customer?'Save':'Add customer'}</button></div></form>
      </div>
    </div>
  );
}

function EmployeeModal({employee,employees=[],onClose,onSave}){
  const isNew = !employee;
  const [form,setForm]=useState(employee?{...employee,password:''}:{name:'',role:'cashier',phone:'',email:'',shift:'08:00-16:00',status:'On shift',salary:1500,username:'',password:''});
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async (e)=>{
    e.preventDefault();
    if(busy) return;
    if(!form.name.trim()){ setErr('Name is required'); return }
    const uname = normalizeUsername(form.username);
    if(!uname){ setErr('Every account needs a username — the employee signs in with it'); return }
    if(!/^[a-z0-9._-]{3,}$/.test(uname)){ setErr('Username must be at least 3 characters: letters, numbers, dot, dash or underscore'); return }
    if(employees.some(x=>x.id!==employee?.id && normalizeUsername(x.username)===uname)){ setErr(`Username “${uname}” is already used by another account`); return }
    if(isNew && (!form.password || form.password.length<6)){ setErr('New accounts need a starting password of at least 6 characters'); return }
    if(form.password && form.password.length<6){ setErr('New password must be at least 6 characters'); return }
    setBusy(true);
    const passwordHash = form.password ? await hashPassword(form.password) : undefined;
    setBusy(false);
    onSave({id:employee?.id||uid('e'), name:form.name.trim(), role:form.role, phone:String(form.phone||'').trim(), email:String(form.email||'').trim(), shift:form.shift, status:form.status, salary:Number(form.salary||0), initials:initials(form.name), username:uname, ...(passwordHash?{passwordHash}:{})});
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#ede9fe',color:'#5b21b6',display:'grid',placeItems:'center'}}><UserCircle size={18}/></div><div><h3>{employee?'Edit staff account':'Create staff account'}</h3><p>Only the owner can create employee accounts and set their login</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></div>
          <div className="two"><div className="field"><label>Role</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}><option value="cashier">Cashier</option><option value="manager">Manager</option><option value="owner">Owner</option></select></div><div className="field"><label>Shift</label><input value={form.shift} onChange={e=>setForm(f=>({...f,shift:e.target.value}))}/></div></div>
          <div className="two"><div className="field"><label>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div><div className="field"><label>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div></div>
          <div className="two"><div className="field"><label>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option>On shift</option><option>Off duty</option><option>On leave</option></select></div><div className="field"><label>Salary (GH₵)</label><input type="number" value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))}/></div></div>
          <div className="pay-detail">
            <b style={{display:'flex',alignItems:'center',gap:'6px'}}><KeyRound size={14}/> Sign-in credentials (owner sets these)</b>
            <div className="field"><label>Username *</label><input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="e.g. ama" autoComplete="off" required/></div>
            <div className="field"><label>{isNew?'Starting password *':'Reset password (leave blank to keep current)'}</label><input type="text" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder={isNew?'At least 6 characters':'Leave blank to keep current password'} autoComplete="new-password"/></div>
            <small style={{fontSize:'11px',color:'#6b7d76'}}>Give the username and password to the employee. Only you, the owner, can change them later — from here or Staff Tracking → Login.</small>
          </div>
          {err && <div style={{color:'#b91c1c',fontSize:'12px'}} role="alert">{err}</div>}
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}><Check size={14}/>{busy?'Saving…':(employee?'Save':'Create staff account')}</button></div></form>
      </div>
    </div>
  );
}

// Owner-only: change an employee's username and/or reset their password.
// Used for the owner's own account too (from their card in Staff Tracking).
function CredentialsModal({employee,employees=[],onClose,onSave}){
  const [username,setUsername]=useState(employee.username||'');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async (e)=>{
    e.preventDefault();
    if(busy) return;
    const uname = normalizeUsername(username);
    if(!uname){ setErr('Username is required'); return }
    if(!/^[a-z0-9._-]{3,}$/.test(uname)){ setErr('Username must be at least 3 characters: letters, numbers, dot, dash or underscore'); return }
    if(employees.some(x=>x.id!==employee.id && normalizeUsername(x.username)===uname)){ setErr(`Username “${uname}” is already used by another account`); return }
    if(password && password.length<6){ setErr('New password must be at least 6 characters'); return }
    if(password && password!==confirm){ setErr('New password and confirmation do not match'); return }
    if(uname===normalizeUsername(employee.username) && !password){ setErr('Nothing to change — edit the username or type a new password'); return }
    setBusy(true);
    await onSave(employee,{username:uname,password:password||undefined});
    setBusy(false);
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#e6f4f1',color:'#0f766e',display:'grid',placeItems:'center'}}><KeyRound size={18}/></div><div><h3>Login for {employee.name}</h3><p>{employee.role} account · owner only — changes apply at their next sign-in</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Username *</label><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="off" required/></div>
          <div className="field"><label>New password (leave blank to keep current)</label><input type="text" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password"/></div>
          <div className="field"><label>Confirm new password</label><input type="text" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat the new password" autoComplete="new-password"/></div>
          {err && <div style={{color:'#b91c1c',fontSize:'12px'}} role="alert">{err}</div>}
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}><KeyRound size={14}/>{busy?'Saving…':'Save login'}</button></div></form>
      </div>
    </div>
  );
}

// Signed-in user changing their OWN password (must prove the current one).
// The owner changing their own password here is the same flow; resetting an
// employee's password without the old one is done via CredentialsModal.
function ChangePasswordModal({user,onClose,onSave}){
  const [current,setCurrent]=useState('');
  const [next,setNext]=useState('');
  const [confirm,setConfirm]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async (e)=>{
    e.preventDefault();
    if(busy) return;
    if(next.length<6){ setErr('New password must be at least 6 characters'); return }
    if(next!==confirm){ setErr('New password and confirmation do not match'); return }
    setBusy(true);
    const error = await onSave(current,next);
    setBusy(false);
    if(error) setErr(error);
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#e6f4f1',color:'#0f766e',display:'grid',placeItems:'center'}}><Lock size={18}/></div><div><h3>Change my password</h3><p>{user?.name}{user?.username?` · @${user.username}`:''} — your username can only be changed by the owner</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Current password *</label><input type="password" value={current} onChange={e=>setCurrent(e.target.value)} autoComplete="current-password" required autoFocus/></div>
          <div className="field"><label>New password *</label><input type="password" value={next} onChange={e=>setNext(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" required/></div>
          <div className="field"><label>Confirm new password *</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" required/></div>
          {err && <div style={{color:'#b91c1c',fontSize:'12px'}} role="alert">{err}</div>}
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}><Lock size={14}/>{busy?'Saving…':'Change password'}</button></div></form>
      </div>
    </div>
  );
}

function GiftModal({customers,onClose,onSave}){
  const [form,setForm]=useState({code:`GIFT-${Math.random().toString(36).slice(2,6).toUpperCase()}-${String(Date.now()).slice(-3)}`,balance:'100',customerId:'',expiry:new Date(Date.now()+90*24*60*60*1000).toISOString().slice(0,10)});
  const submit=(e)=>{
    e.preventDefault();
    const cust = customers.find(c=>c.id===form.customerId);
    onSave({id:uid('g'),code:form.code.trim().toUpperCase(),balance:Number(form.balance),original:Number(form.balance),customerId:form.customerId,customerName:cust?.name||'',expiry:form.expiry,status:'active'});
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#ede9fe',color:'#5b21b6',display:'grid',placeItems:'center'}}><Gift size={18}/></div><div><h3>New gift card</h3><p>Gift payment — customer can pay with code</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Gift code *</label><input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} required style={{fontFamily:'monospace'}}/></div>
          <div className="two"><div className="field"><label>Amount (GH₵) *</label><input type="number" step="0.01" min="1" value={form.balance} onChange={e=>setForm(f=>({...f,balance:e.target.value}))} required/></div><div className="field"><label>Expiry</label><input type="date" value={form.expiry} onChange={e=>setForm(f=>({...f,expiry:e.target.value}))}/></div></div>
          <div className="field"><label>Customer (optional)</label><select value={form.customerId} onChange={e=>setForm(f=>({...f,customerId:e.target.value}))}><option value="">No customer / Walk-in</option>{customers.filter(c=>!c.isWalkIn).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary"><Gift size={14}/> Create gift card</button></div></form>
      </div>
    </div>
  );
}

function MessageModal({employees,currentUser,onClose,onSend}){
  const [form,setForm]=useState({to:'all',subject:'',body:''});
  const submit=(e)=>{
    e.preventDefault();
    if(!form.subject.trim()||!form.body.trim()) return;
    const toName = form.to==='all' ? 'All Staff' : employees.find(emp=>emp.id===form.to)?.name||'';
    onSend({id:uid('m'),from:currentUser.name,fromId:currentUser.id,to:form.to,toName,subject:form.subject.trim(),body:form.body.trim(),date:todayKey(),time:shortTime(),readBy:[currentUser.id]});
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal wide"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#e6f4f1',color:'#0f766e',display:'grid',placeItems:'center'}}><MessageSquare size={18}/></div><div><h3>New message — owner to employees</h3><p>Broadcast or direct to employee</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="two"><div className="field"><label>To *</label><select value={form.to} onChange={e=>setForm(f=>({...f,to:e.target.value}))}><option value="all">All Staff (broadcast)</option>{employees.filter(e=>e.role!=='owner').map(e=><option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}</select></div><div className="field"><label>Subject *</label><input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="e.g. Restock reminder" required/></div></div>
          <div className="field"><label>Message *</label><textarea value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} placeholder="Write message to employees…" required rows={5}/></div>
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary"><Send size={14}/> Send message</button></div></form>
      </div>
    </div>
  );
}

function PaymentModal({cart,subtotal,discount,total,customer,giftCards,onClose,onComplete,isOwner}){
  const [method,setMethod]=useState('Cash');
  const [cashTendered,setCashTendered]=useState(String(total));
  const [momoPhone,setMomoPhone]=useState(customer.phone||'');
  const [momoTxn,setMomoTxn]=useState('');
  const [giftCode,setGiftCode]=useState('');
  const [err,setErr]=useState('');

  useEffect(()=>{ setCashTendered(String(total)); },[total]);

  const gift = giftCards.find(g=>g.code===giftCode.trim().toUpperCase() && g.status==='active');
  const change = Number(cashTendered||0) - total;

  const submit = ()=>{
    setErr('');
    if(method==='Cash'){
      if(Number(cashTendered) < total){ setErr(`Cash GH\u20b5${cashTendered} less than total ${format(total)}`); return }
      onComplete('Cash',{tendered:Number(cashTendered),change});
    } else if(method==='MoMo'){
      if(!momoPhone.trim()){ setErr('Enter MoMo phone'); return }
      onComplete('MoMo',{phone:momoPhone.trim(),txn:momoTxn.trim()||`MOMO-${Date.now().toString().slice(-6)}`});
    } else if(method==='Gift'){
      if(!gift){ setErr('Invalid or used gift card'); return }
      if(gift.balance < total){ setErr(`Gift balance ${format(gift.balance)} insufficient`); return }
      onComplete('Gift',{code:gift.code,used:total,remaining:gift.balance-total});
    }
  };

  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal wide">
        <div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#0f2320',color:'#fff',display:'grid',placeItems:'center'}}><Wallet size={18}/></div><div><h3>Complete sale — {method}</h3><p>{customer.name} · {format(total)} · {cart.length} items{isOwner && ' · Combined to owner'}</p></div><button className="btn icon small no-print" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <div className="modal-body">
          <div style={{display:'flex',gap:'6px',overflow:'auto',paddingBottom:'4px'}}>
            {paymentMethods.map(pm=>(
              <button key={pm.id} className={`btn small ${method===pm.id?'primary':'ghost'}`} onClick={()=>setMethod(pm.id)}><pm.icon size={14}/>{pm.label}</button>
            ))}
          </div>

          <div className="pay-detail">
            <div className="pay-amount"><span>Total due</span><strong>{format(total)}</strong></div>
            <div style={{fontSize:'11px',color:'#6b7d76'}}>Customer: <b>{customer.name}</b> {customer.balance>0 && <span style={{color:'#991b1b'}}>· Owes {format(customer.balance)}</span>} · Subtotal {format(subtotal)}{discount>0 && ` · Discount -${format(discount)}`}</div>
          </div>

          {method==='Cash' && (
            <div className="pay-detail">
              <b><Banknote size={14} style={{verticalAlign:'-2px'}}/> Cash payment</b>
              <div className="two"><div className="field"><label>Cash tendered (GH\u20b5)</label><input type="number" step="0.01" value={cashTendered} onChange={e=>setCashTendered(e.target.value)}/></div><div className="field"><label>Change</label><input value={format(Math.max(0,change))} readOnly style={{background:'#f9fbf9',fontWeight:800}}/></div></div>
              {isOwner && <small style={{fontSize:'11px',color:'#6b7d76'}}>Cash sales combine directly to owner cash account.</small>}
            </div>
          )}
          {method==='MoMo' && (
            <div className="pay-detail">
              <b><Smartphone size={14}/> MoMo payment</b>
              <div className="two"><div className="field"><label>MoMo phone *</label><input value={momoPhone} onChange={e=>setMomoPhone(e.target.value)} placeholder="0244..."/></div><div className="field"><label>Transaction ID</label><input value={momoTxn} onChange={e=>setMomoTxn(e.target.value)} placeholder="Auto if empty"/></div></div>
              {isOwner && <small style={{fontSize:'11px',color:'#6b7d76'}}>Mobile Money sales combine to owner MoMo account.</small>}
            </div>
          )}
          {method==='Gift' && (
            <div className="pay-detail">
              <b><Gift size={14}/> Gift card payment</b>
              <div className="field"><label>Gift code *</label><input value={giftCode} onChange={e=>setGiftCode(e.target.value)} placeholder="e.g. GIFT-100-001" style={{fontFamily:'monospace',textTransform:'uppercase'}}/></div>
              {gift ? <div style={{padding:'8px',background:'#ecfdf5',borderRadius:'8px',fontSize:'12px',display:'flex',justifyContent:'space-between'}}><span>Balance: <b>{format(gift.balance)}</b></span><span>After: <b>{format(gift.balance-total)}</b></span></div> : giftCode && <div style={{fontSize:'11px',color:'#991b1b'}}>Gift card not found or used</div>}
              <small style={{fontSize:'11px',color:'#6b7d76'}}>Gift card liability reduces — prepaid amount used.</small>
            </div>
          )}

          {err && <div style={{padding:'10px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',color:'#991b1b',fontSize:'12px'}}>{err}</div>}

          <div style={{padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px'}}>
            <b style={{fontSize:'12px'}}>Sale items</b>
            <div style={{marginTop:'6px',display:'flex',flexDirection:'column',gap:'4px',maxHeight:'100px',overflow:'auto'}}>
              {cart.map(i=><div key={i.id} style={{display:'flex',justifyContent:'space-between',fontSize:'11px'}}><span>{i.name} × {i.qty}</span><b>{format(i.price*i.qty)}</b></div>)}
            </div>
          </div>
        </div>
        <div className="modal-foot"><button className="btn no-print" onClick={onClose}>Cancel</button><button className="btn primary no-print" onClick={submit}><Check size={16}/> Confirm {method} · {format(total)}</button></div>
      </div>
    </div>
  );
}

// Owner-only editor for an already recorded sale. Every change is reversible
// only by correcting again, so a reason is required and the before/after values
// are kept on the sale as a correction trail.
function SaleEditModal({sale,products,customers,employees,giftCards,onClose,onSave,onDelete}){
  const [form,setForm]=useState(()=>({
    date:sale.date||todayKey(),
    time:sale.time||shortTime(),
    customerId:sale.customerId||customers[0]?.id||'',
    cashierId:sale.cashierId||employees.find(e=>e.name===sale.cashier)?.id||'',
    payment:sale.payment||'Cash',
    giftCode:sale.paymentDetail?.code||giftCards.find(g=>g.status==='active')?.code||'',
    discount:Number(sale.discount||0),
    reason:'',
    items:(sale.items||[]).map(it=>({
      productId:it.productId,
      name:it.name,
      qty:Number(it.qty||0),
      unitPrice:Number(it.unitPrice||0),
      cost:Number(it.cost ?? products.find(p=>p.id===it.productId)?.cost ?? 0),
    })),
  }));
  const [addId,setAddId]=useState('');
  const [err,setErr]=useState('');
  const [confirmDelete,setConfirmDelete]=useState(false);
  const set = (patch)=>setForm(f=>({...f,...patch}));
  const setItem = (idx,patch)=>setForm(f=>({...f,items:f.items.map((it,i)=>i===idx?{...it,...patch}:it)}));
  const removeItem = (idx)=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}));
  const addItem = ()=>{
    const prod = products.find(p=>p.id===addId);
    if(!prod) return;
    if(form.items.some(it=>it.productId===prod.id)){ setErr(`${prod.name} is already on this sale — change its quantity instead`); return }
    setForm(f=>({...f,items:[...f.items,{productId:prod.id,name:prod.name,qty:1,unitPrice:Number(prod.price||0),cost:Number(prod.cost||0)}]}));
    setAddId(''); setErr('');
  };
  const subtotal = Number(form.items.reduce((s,it)=>s+Number(it.qty||0)*Number(it.unitPrice||0),0).toFixed(2));
  const discount = Math.min(subtotal, Math.max(0, Number(form.discount||0)));
  const total = Number((subtotal-discount).toFixed(2));
  const units = form.items.reduce((s,it)=>s+Number(it.qty||0),0);
  // Stock check: the quantities already on the sale are available to keep.
  const stockIssue = form.items.map(it=>{
    const oldQty = (sale.items||[]).filter(x=>x.productId===it.productId).reduce((s,x)=>s+Number(x.qty||0),0);
    const prod = products.find(p=>p.id===it.productId);
    const available = Number(prod?.stock||0)+oldQty;
    return Number(it.qty||0)>available ? `${it.name} — only ${available} available (${prod?.stock||0} in stock + ${oldQty} on this sale)` : null;
  }).filter(Boolean);
  const submit = ()=>{
    if(!form.items.length){ setErr('A sale needs at least one item'); return }
    if(form.items.some(it=>!Number(it.qty)||Number(it.qty)<1)){ setErr('Every item needs a quantity of at least 1'); return }
    if(form.items.some(it=>Number(it.unitPrice)<0)){ setErr('Unit prices cannot be negative'); return }
    if(stockIssue.length){ setErr(stockIssue[0]); return }
    if(String(form.reason||'').trim().length<3){ setErr('Add a short reason so the correction is on record'); return }
    if(form.payment==='Gift' && !form.giftCode){ setErr('Choose the gift card used for this sale'); return }
    const ok = onSave(sale, form);
    if(ok===false) setErr('Could not save this correction — check the details above');
  };
  const activeCards = giftCards.filter(g=>g.status==='active' || g.code===sale.paymentDetail?.code);
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal wide">
        <div className="modal-head">
          <div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#e6f4f1',color:'#0f766e',display:'grid',placeItems:'center'}}><Edit2 size={18}/></div>
          <div><h3>Correct sale {sale.invoiceNumber}</h3><p>Owner only · {sale.cashier} · {readableDate(sale.date)} {sale.time} · {format(sale.total)}</p></div>
          <button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button>
        </div>
        <div className="modal-body">
          <div style={{display:'flex',gap:'8px',alignItems:'flex-start',padding:'10px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'8px',fontSize:'12px',color:'#92400e'}}>
            <AlertTriangle size={15} style={{flex:'none',marginTop:'1px'}}/>
            <span>This changes the shop&apos;s record. Quantities are reconciled against stock automatically, customer spend and gift-card balances are updated, and the change is written to the activity timeline.</span>
          </div>

          <div className="two">
            <div className="field"><label>Seller</label>
              <select value={form.cashierId} onChange={e=>set({cashierId:e.target.value})}>
                {employees.map(e=><option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
              </select>
            </div>
            <div className="field"><label>Customer</label>
              <select value={form.customerId} onChange={e=>set({customerId:e.target.value})}>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="two">
            <div className="field"><label>Sale date</label><input type="date" value={form.date} onChange={e=>set({date:e.target.value})}/></div>
            <div className="field"><label>Sale time</label><input type="time" value={form.time} onChange={e=>set({time:e.target.value})}/></div>
          </div>
          <div className="two">
            <div className="field"><label>Payment method</label>
              <select value={form.payment} onChange={e=>set({payment:e.target.value})}>
                <option>Cash</option><option>MoMo</option><option>Gift</option>
              </select>
            </div>
            {form.payment==='Gift' ? (
              <div className="field"><label>Gift card</label>
                <select value={form.giftCode} onChange={e=>set({giftCode:e.target.value})}>
                  {activeCards.length===0 && <option value="">No gift cards available</option>}
                  {activeCards.map(g=><option key={g.id} value={g.code}>{g.code} · {format(g.balance)} left</option>)}
                </select>
              </div>
            ) : (
              <div className="field"><label>Discount (GH₵)</label><input type="number" min="0" step="0.01" value={form.discount} onChange={e=>set({discount:e.target.value})}/></div>
            )}
          </div>
          {form.payment==='Gift' && <div className="field"><label>Discount (GH₵)</label><input type="number" min="0" step="0.01" value={form.discount} onChange={e=>set({discount:e.target.value})}/></div>}

          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
              <b style={{fontSize:'12px'}}>Items on this sale</b>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                <select value={addId} onChange={e=>setAddId(e.target.value)} style={{minHeight:'32px',border:'1px solid #e7ece8',borderRadius:'8px',padding:'0 8px',fontSize:'12px'}}>
                  <option value="">Add an item…</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name} · {format(p.price)} · {p.stock} left</option>)}
                </select>
                <button className="btn small" onClick={addItem} disabled={!addId}><Plus size={12}/> Add</button>
              </div>
            </div>
            <div className="table-wrap" style={{marginTop:'8px'}}>
              <table>
                <thead><tr><th>PRODUCT</th><th>QTY</th><th>UNIT PRICE</th><th>LINE TOTAL</th><th></th></tr></thead>
                <tbody>
                  {form.items.map((it,idx)=>(
                    <tr key={it.productId||idx}>
                      <td><b style={{fontSize:'12px'}}>{it.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>cost {format(it.cost)}</small></td>
                      <td><input type="number" min="1" step="1" value={it.qty} onChange={e=>setItem(idx,{qty:e.target.value})} style={{width:'74px',minHeight:'32px',border:'1px solid #e7ece8',borderRadius:'8px',padding:'0 8px'}}/></td>
                      <td><input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e=>setItem(idx,{unitPrice:e.target.value})} style={{width:'96px',minHeight:'32px',border:'1px solid #e7ece8',borderRadius:'8px',padding:'0 8px'}}/></td>
                      <td><b>{format(Number(it.qty||0)*Number(it.unitPrice||0))}</b></td>
                      <td><button className="btn small danger" onClick={()=>removeItem(idx)} title="Remove this item"><Trash2 size={12}/></button></td>
                    </tr>
                  ))}
                  {form.items.length===0 && <tr><td colSpan={5} style={{color:'#6b7d76',fontSize:'12px'}}>No items — add at least one to keep this sale.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'10px'}}>
            <div style={{padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px',fontSize:'12px'}}>
              <b style={{fontSize:'12px'}}>Was recorded</b>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px'}}><span>Total</span><b>{format(sale.total)}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span>Seller</span><b>{sale.cashier}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span>Payment</span><b>{sale.payment}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span>Items</span><b>{saleUnits(sale)} units</b></div>
            </div>
            <div style={{padding:'10px',background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:'8px',fontSize:'12px'}}>
              <b style={{fontSize:'12px'}}>After correction</b>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'6px'}}><span>Total</span><b>{format(total)}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span>Seller</span><b>{employees.find(e=>e.id===form.cashierId)?.name||sale.cashier}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span>Payment</span><b>{form.payment}</b></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span>Items</span><b>{units} units</b></div>
            </div>
          </div>
          <div style={{fontSize:'11px',color:'#6b7d76'}}>Subtotal {format(subtotal)} · discount {format(discount)} · total <b style={{color:'#0f2320'}}>{format(total)}</b>{Number(total)!==Number(sale.total||0) && <> · difference <b style={{color:total>Number(sale.total||0)?'#065f46':'#991b1b'}}>{total>Number(sale.total||0)?'+':''}{format(total-Number(sale.total||0))}</b></>}</div>

          <div className="field"><label>Reason for correction *</label>
            <input value={form.reason} onChange={e=>set({reason:e.target.value})} placeholder="e.g. Wrong quantity at checkout — customer bought 2 not 3" required/>
          </div>
          {(sale.corrections||[]).length>0 && (
            <div style={{padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px',fontSize:'11px'}}>
              <b style={{fontSize:'12px'}}>Previous corrections</b>
              {[...(sale.corrections||[])].reverse().map(c=>(
                <div key={c.id} style={{marginTop:'6px',color:'#334155'}}>
                  <b>{c.by}</b> · {new Date(c.at).toLocaleString('en-GH')} · {format(c.before.total)} → {format(c.after.total)}
                  <div style={{color:'#6b7d76'}}>{c.reason}</div>
                </div>
              ))}
            </div>
          )}
          {err && <div role="alert" style={{padding:'10px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',color:'#991b1b',fontSize:'12px'}}>{err}</div>}
        </div>
        <div className="modal-foot" style={{flexWrap:'wrap',gap:'8px'}}>
          {confirmDelete ? (
            <div style={{display:'flex',gap:'6px',alignItems:'center',marginRight:'auto',flexWrap:'wrap'}}>
              <span style={{fontSize:'12px',color:'#991b1b',fontWeight:700}}>Delete {sale.invoiceNumber} and restore its stock?</span>
              <button className="btn small danger" onClick={()=>{ if(onDelete(sale)===false) setErr('Could not delete this sale'); }}><Trash2 size={12}/> Yes, delete</button>
              <button className="btn small" onClick={()=>setConfirmDelete(false)}>Keep sale</button>
            </div>
          ) : (
            <button className="btn small danger" style={{marginRight:'auto'}} onClick={()=>setConfirmDelete(true)}><Trash2 size={12}/> Delete sale</button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}><Check size={14}/> Save correction</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({sale,shop=SHOP,receiptFooter='',onClose,onPrintReceipt,onEditSale}){
  const subtotal = sale.subtotal||sale.total;
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="invoice"><div className="invoice-head"><div style={{display:'flex',alignItems:'center',gap:'10px'}}><div className="brand-mark" style={{width:'32px',height:'32px',fontSize:'14px'}}>P</div><div><b>{shop.name}</b><small style={{display:'block',fontSize:'11px',color:'#6b7d76'}}>{shop.address} · Tel {shop.phone} · Customer Invoice</small></div></div><button className="btn icon small no-print" onClick={onClose}><X size={14}/></button></div>
        <div className="invoice-body">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><span style={{fontSize:'10px',fontWeight:800,letterSpacing:'1px',color:'#0f766e'}}>PAID INVOICE</span><h2 style={{margin:'4px 0',fontSize:'20px',fontWeight:900}}>{sale.invoiceNumber}</h2><small style={{color:'#6b7d76'}}>{readableDate(sale.date)} at {sale.time}</small></div><span className="status ok"><i/> Paid · {sale.payment}</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',margin:'14px 0',padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px',fontSize:'11px'}}><div><small style={{color:'#6b7d76',fontWeight:700}}>BILL TO</small><b style={{display:'block'}}>{sale.customerName}</b></div><div><small style={{color:'#6b7d76',fontWeight:700}}>SELLER NAME</small><b style={{display:'block'}}>{sale.cashier}</b></div><div><small style={{color:'#6b7d76',fontWeight:700}}>PAYMENT</small><b style={{display:'block'}}>{sale.payment} {sale.paymentDetail?.phone||sale.paymentDetail?.code||''}</b></div></div>
          <div className="invoice-line head"><span>PRODUCT</span><span>QTY</span><span>UNIT</span><span>TOTAL</span></div>
          {sale.items?.map((it,i)=><div key={i} className="invoice-line"><span>{it.name}</span><span>{it.qty}</span><span>{format(it.unitPrice)}</span><span>{format(it.lineTotal)}</span></div>)}
          {(sale.items?.length||0)>0 && <div className="invoice-line" style={{borderTop:'1px solid #e7ece8',background:'#f9fbf9',fontWeight:800}}><span>Totals</span><span>{sale.items.reduce((s,it)=>s+Number(it.qty||0),0)}</span><span style={{color:'#6b7d76'}}>—</span><span>{format(sale.items.reduce((s,it)=>s+Number(it.lineTotal||0),0))}</span></div>}
          <div className="invoice-tot"><div><span>Subtotal</span><b>{format(subtotal)}</b></div>{sale.discount>0 && <div><span>Discount</span><b>-{format(sale.discount)}</b></div>}<div className="grand"><span>Total paid</span><b>{format(sale.total)}</b></div></div>
          {(sale.corrections||[]).length>0 && (
            <div style={{marginTop:'12px',padding:'10px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'8px',fontSize:'11px',color:'#92400e'}}>
              <b>Corrected {sale.corrections.length}×</b> · last by {sale.editedBy} on {new Date(sale.editedAt).toLocaleString('en-GH')}
              <div style={{marginTop:'4px'}}>{sale.corrections[sale.corrections.length-1].reason}</div>
            </div>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid #e7ece8',background:'#fcfdfc',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'11px',color:'#6b7d76',display:'flex',alignItems:'center',gap:'5px'}}><ShieldCheck size={12}/> {receiptFooter || `Thank you for shopping with ${shop.name}!`}</span><div style={{display:'flex',gap:'6px'}}>{onEditSale && <button className="btn small no-print" onClick={()=>onEditSale(sale)} title="Owner only — correct or delete this sale"><Edit2 size={14}/> Correct</button>}<button className="btn small no-print" onClick={()=>onPrintReceipt(sale)}><Printer size={14}/> Print receipt</button><button className="btn small primary no-print" onClick={()=>window.print()}><Printer size={14}/> Print invoice</button></div></div>
      </div>
    </div>
  );
}

function ReceiptModal({sale,shop=SHOP,receiptFooter='',onClose}){
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="receipt"><button className="btn icon small no-print" style={{float:'right'}} onClick={onClose}><X size={14}/></button>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',paddingBottom:'10px',borderBottom:'1px dashed #e7ece8'}}><div className="brand-mark" style={{width:'28px',height:'28px',fontSize:'12px'}}>P</div><div><b style={{fontSize:'12px'}}>{shop.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{shop.address}</small><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>Tel: {shop.phone}</small></div></div>
        <h3>PAYMENT RECEIPT</h3><small>Receipt no: {sale.invoiceNumber}</small>
        <div className="receipt-meta">
          <div><small>SELLER NAME</small><b>{sale.cashier}</b></div>
          <div><small>CUSTOMER</small><b>{sale.customerName}</b></div>
          <div><small>DATE</small><b>{readableDate(sale.date)}</b></div>
          <div><small>TIME</small><b>{sale.time}</b></div>
          <div><small>PAYMENT</small><b>{sale.payment}</b></div>
          <div><small>ITEMS</small><b>{sale.itemCount}</b></div>
        </div>
        {sale.items?.map((it,i)=><div key={i} className="receipt-item"><span>{it.name} × {it.qty}</span><b>{format(it.lineTotal)}</b></div>)}
        {sale.discount>0 && <div className="receipt-item"><span>Discount</span><b>-{format(sale.discount)}</b></div>}
        <div className="receipt-total"><span>Total amount</span><b>{format(sale.total)}</b></div>
        {(sale.corrections||[]).length>0 && <div style={{marginTop:'8px',padding:'6px 8px',border:'1px dashed #fcd34d',borderRadius:'6px',background:'#fffbeb',fontSize:'10px',color:'#92400e'}}><b>Corrected receipt</b> · {sale.editedBy} · {new Date(sale.editedAt).toLocaleDateString('en-GH')}<br/>{sale.corrections[sale.corrections.length-1].reason}</div>}
        <div style={{textAlign:'center',marginTop:'12px'}}><small>{receiptFooter || `Thank you for shopping with ${shop.name}!`}</small><br/><small>Sale ref {sale.id}</small><br/><button className="btn small primary no-print" style={{marginTop:'8px'}} onClick={()=>window.print()}><Printer size={14}/> Print receipt</button></div>
      </div>
    </div>
  );
}

function SetupScreen({onComplete}){
  const [form,setForm] = useState({shopName:'',address:'',phone:'',name:'',username:'',password:'',confirm:''});
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const submit = async e=>{
    e.preventDefault();
    if(busy) return;
    if(!form.shopName.trim() || !form.name.trim()) { setError('Enter your store name and owner name.'); return }
    if(normalizeUsername(form.username).length<3) { setError('Username must have at least 3 characters.'); return }
    if(form.password.length<8) { setError('Choose a password with at least 8 characters.'); return }
    if(form.password!==form.confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('');
    try{
      const setup = {
        settings:{...DEFAULT_SETTINGS,shopName:form.shopName.trim(),address:form.address.trim(),phone:form.phone.trim()},
        owner:{id:uid('owner'),name:form.name.trim(),role:'owner',username:normalizeUsername(form.username),passwordHash:await hashPassword(form.password),phone:form.phone.trim(),email:'',shift:'',status:'Off shift',salary:0,initials:initials(form.name.trim())}
      };
      // A single durable write makes setup recoverable even if this tab closes immediately.
      localStorage.setItem(SETUP_KEY,JSON.stringify(setup));
      onComplete(setup);
    }catch{ setError('Could not save your store. Allow browser storage and try again.'); }
    finally{ setBusy(false); }
  };
  return <div className="setup-page"><form className="login-card setup-card" onSubmit={submit}>
    <div className="eyebrow">POSI · YOUR NEW STORE</div>
    <h1>Start with a clean slate.</h1>
    <p>Create your store and its owner account. No sample products, sales or staff will be added.</p>
    <div className="setup-fields">{[
      ['shopName','Store name','text',true],['address','Store address','text',false],['phone','Contact phone','tel',false],
      ['name','Owner full name','text',true],['username','Owner username','text',true],['password','Password (8+ characters)','password',true],['confirm','Confirm password','password',true]
    ].map(([key,label,type,required])=><div className="field" key={key}><label htmlFor={'setup-'+key}>{label}</label><input id={'setup-'+key} type={type} required={required} minLength={key==='password'?8:key==='username'?3:undefined} autoComplete={type==='password'?'new-password':key==='username'?'username':'off'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></div>)}</div>
    <p className="setup-note">Stored only in this browser on this device. There is no cloud backup or password recovery service. Export backups regularly in Settings. Existing demo records stay separate and are not imported.</p>
    {error && <p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    <button className="btn primary" disabled={busy} type="submit">{busy?'Creating store…':'Create store & continue to sign in'} <ArrowRight size={16}/></button>
  </form></div>;
}

function Root(){
  const offline = useOfflineSupport();
  const [setup,setSetup] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem(SETUP_KEY)) || null }catch{ return null }
  });
  const restart = ()=>{
    if(!window.confirm('Start a completely new store? This permanently deletes this browser’s current shop accounts, inventory, sales and other shop records. Export a backup in Settings first if needed. This cannot be undone.')) return;
    try{
      // Remove the setup marker last; keep unrelated browser and legacy demo data untouched.
      Object.values(K).forEach(key=>localStorage.removeItem(key));
      localStorage.removeItem('posi-live-v1-assistant');
      sessionStorage.removeItem('posi-live-user-id');
      localStorage.removeItem(SETUP_KEY);
      setSetup(null);
    }catch{ window.alert('Could not reset browser storage. Please allow storage access and try again.'); }
  };
  return <>{setup ? <App offline={offline} setup={setup} onRestart={restart}/> : <SetupScreen onComplete={setSetup}/>}<OfflineBanner {...offline}/></>;
}

createRoot(document.getElementById('root')).render(<Root/>);
