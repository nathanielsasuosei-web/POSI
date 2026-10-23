import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, ShoppingCart, Package, Users, FileText, BarChart3, Gift, MessageSquare,
  Wallet, CreditCard, Banknote, Smartphone, Receipt, Ticket, UserCircle,
  Search, Plus, Minus, X, Check, LogOut, Store, Clock3, TrendingUp, AlertTriangle,
  ArrowRight, ChevronDown, Download, Printer, ShieldCheck, CalendarDays, UserRound,
  CheckCircle2, DollarSign, PiggyBank, Landmark, Mail, Send, Eye, Edit2, Trash2, UserPlus,
  Bell, ClipboardList, History, Coins, AlarmClock, TrendingDown,
  RefreshCw, CloudOff, Cloud, WifiOff, Loader2
} from 'lucide-react';
import { usePosiData } from './usePosiData';
import './style.css';

// helpers
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

const categories = ['All','Pain Relief','Cough & Cold','Antibiotics','Antimalarials','Vitamins','Baby & Mother','Personal Care','First Aid','Devices','Other'];
const expenseCategories = ['Rent','Utilities','Supplies','Transport','Salaries','Maintenance','Marketing','Other'];
const stockMoveTypes = {
  sale: { label:'Sale', color:'#065f46' },
  restock: { label:'Restock in', color:'#1e40af' },
  adjustment: { label:'Adjustment', color:'#92400e' },
};

const SHOP = { name:'Green Cross Drug Store', address:'12 Oxford Street, Osu, Accra', phone:'030 274 1122' };

const paymentMethods = [
  { id:'Cash', label:'Cash', icon: Banknote, desc:'Cash payment' },
  { id:'MoMo', label:'MoMo', icon: Smartphone, desc:'Mobile Money' },
  { id:'Gift', label:'Gift', icon: Gift, desc:'Gift card' },
];

function App(){
  const {
    products, sales, customers, employees, giftCards, messages, activities,
    attendance, expenses, stockMoves, sync, actions,
  } = usePosiData();

  const [role,setRole]=useState(()=>{ try{ return sessionStorage.getItem('pos-role')||null }catch{return null}});
  const [cashierId,setCashierId]=useState(()=>{ try{ return sessionStorage.getItem('pos-cashier')||'e2' }catch{return 'e2'}});
  const [view,setView]=useState(()=> role==='owner'?'dashboard':'pos');
  const [toast,setToast]=useState('');
  const [success,setSuccess]=useState(null);

  // POS state
  const [search,setSearch]=useState('');
  const [cat,setCat]=useState('All');
  const [cart,setCart]=useState([]);
  const [selectedCustomerId,setSelectedCustomerId]=useState('c1');
  const [discountOn,setDiscountOn]=useState(false);
  const [showPay,setShowPay]=useState(false);
  const [selectedInvoice,setSelectedInvoice]=useState(null);
  const [selectedReceipt,setSelectedReceipt]=useState(null);
  const [mobileCart,setMobileCart]=useState(false);

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
  const [filterSales,setFilterSales]=useState({search:'',payment:'All',date:'All',cashier:'All'});

  const currentEmployee = employees.find(e=>e.id===cashierId) || employees.find(e=>e.role==='cashier') || employees[0];
  const currentUser = role==='owner' ? employees.find(e=>e.role==='owner') : currentEmployee;
  const isOwner = role==='owner';

  // Keep the POS customer selection valid as the shared customer list changes.
  useEffect(()=>{
    if(!customers.length) return;
    if(customers.some(c=>c.id===selectedCustomerId)) return;
    setSelectedCustomerId((customers.find(c=>c.isWalkIn) || customers[0]).id);
  },[customers, selectedCustomerId]);

  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),2800); return ()=>clearTimeout(t)} },[toast]);
  useEffect(()=>{ if(success){ const t=setTimeout(()=>setSuccess(null),6000); return ()=>clearTimeout(t)} },[success]);

  const flash = (m)=>setToast(m);

  const signIn = (r,cId)=>{
    try{ sessionStorage.setItem('pos-role',r); sessionStorage.setItem('pos-cashier',cId||'e2') }catch{}
    setRole(r); setCashierId(cId||'e2'); setView(r==='owner'?'dashboard':'pos');
  };
  const signOut = ()=>{
    try{ sessionStorage.removeItem('pos-role'); sessionStorage.removeItem('pos-cashier') }catch{}
    setRole(null); setCart([]); setView('dashboard');
  };

  // Offline-first writes are applied locally first; when the API cannot be
  // reached the change is queued and replayed automatically.
  const syncNote = (result) => (result?.queued ? ' · saved on this device, syncing soon' : '');

  // Low stock alerts
  const lowStockItems = useMemo(()=> products
    .filter(p=>p.stock<=reorderOf(p))
    .sort((a,b)=>a.stock-b.stock),[products]);

  // Stock movements
  const applyStockChange = async ({product, mode, qty, note, cost})=>{
    if(!isOwner){ flash('Only the owner can manage stock'); return }
    const amount = Math.floor(Number(qty));
    if(!product || !amount){ flash('Enter a quantity'); return }
    const delta = mode==='restock' ? Math.abs(amount) : -Math.abs(amount);
    setStockModal(null);
    const result = await actions.adjustStock({product, mode, qty:amount, note, cost, by:currentUser?.name||'Staff', moveId:uid('sm')});
    if(!result.ok){ flash(`Stock not updated: ${result.error?.message||'server rejected the change'}`); return }
    flash((mode==='restock' ? `${product.name} restocked (+${delta})` : `${product.name} adjusted (${delta})`) + syncNote(result));
  };

  // Expenses
  const saveExpense = async (exp)=>{
    const editing = Boolean(editingExpense);
    setShowExpenseModal(false); setEditingExpense(null);
    const result = await actions.saveExpense(exp,{editing});
    if(!result.ok){ flash(`Expense not saved: ${result.error?.message||'server rejected the change'}`); return }
    flash((editing ? 'Expense updated' : 'Expense recorded') + syncNote(result));
  };
  const deleteExpense = async (id)=>{
    if(!isOwner){ flash('Only owner can delete expenses'); return }
    const result = await actions.deleteExpense(id);
    if(!result.ok){ flash(`Expense not deleted: ${result.error?.message||'server rejected the change'}`); return }
    flash('Expense deleted' + syncNote(result));
  };

  // Staff attendance (clock in / out)
  const todayAttendance = attendance.find(a=>a.employeeId===currentUser?.id && a.date===todayKey());
  const toggleClock = async ()=>{
    if(!todayAttendance){
      const entry = {id:uid('at'),employeeId:currentUser.id,name:currentUser.name,date:todayKey(),in:shortTime(),out:null,hours:null};
      const result = await actions.saveAttendance(entry);
      if(!result.ok){ flash(`Clock in failed: ${result.error?.message||'server rejected the change'}`); return }
      flash(`Clocked in at ${entry.in}` + syncNote(result));
    }else if(!todayAttendance.out){
      const out = shortTime();
      const hours = hoursBetween(todayAttendance.date, todayAttendance.in, out);
      const result = await actions.saveAttendance({...todayAttendance,out,hours});
      if(!result.ok){ flash(`Clock out failed: ${result.error?.message||'server rejected the change'}`); return }
      flash(`Clocked out · ${hours??0} hours today` + syncNote(result));
    }else{
      flash('Already clocked out for today');
    }
  };

  // Products
  const saveProduct = async (prod)=>{
    if(!isOwner){ flash('Only the owner can manage product records'); return }
    const editing = Boolean(editingProduct);
    setShowProductModal(false); setEditingProduct(null);
    const result = await actions.saveProduct(prod,{editing, actor: currentUser?.name});
    if(!result.ok){ flash(`Product not saved: ${result.error?.message||'server rejected the change'}`); return }
    flash((editing ? `${prod.name} updated` : `${prod.name} added to inventory`) + syncNote(result));
  };
  const deleteProduct = async (id)=>{
    if(!isOwner){ flash('Only owner can delete products'); return }
    const result = await actions.deleteProduct(id);
    if(!result.ok){ flash(`Product not removed: ${result.error?.message||'server rejected the change'}`); return }
    flash('Product removed' + syncNote(result));
  };

  // Customers
  const saveCustomer = async (cust)=>{
    const editing = Boolean(editingCustomer);
    setShowCustomerModal(false); setEditingCustomer(null);
    const result = await actions.saveCustomer(cust,{editing});
    if(!result.ok){ flash(`Customer not saved: ${result.error?.message||'server rejected the change'}`); return }
    flash((editing ? `${cust.name} updated` : `${cust.name} added`) + syncNote(result));
  };
  const payAccount = async (customerId, amount)=>{
    const result = await actions.payAccount(customerId, amount, currentUser?.name||'Staff');
    if(!result.ok){ flash(`Payment not recorded: ${result.error?.message||'server rejected the change'}`); return }
    flash(`Payment of ${format(amount)} recorded` + syncNote(result));
  };

  // Employees
  const saveEmployee = async (emp)=>{
    const editing = Boolean(editingEmployee);
    setShowEmployeeModal(false); setEditingEmployee(null);
    const result = await actions.saveEmployee(emp,{editing});
    if(!result.ok){ flash(`Staff account not saved: ${result.error?.message||'server rejected the change'}`); return }
    flash((editing ? `${emp.name} updated` : `${emp.name} added as ${emp.role}`) + syncNote(result));
  };

  // Gift Cards
  const saveGiftCard = async (gc)=>{
    setShowGiftModal(false);
    const result = await actions.createGiftCard(gc);
    if(!result.ok){ flash(`Gift card not created: ${result.error?.message||'server rejected the change'}`); return }
    flash(`Gift card ${gc.code} created with ${format(gc.balance)}` + syncNote(result));
  };

  // Messages
  const sendMessage = async (msg)=>{
    setShowMessageModal(false);
    const result = await actions.sendMessage(msg);
    if(!result.ok){ flash(`Message not sent: ${result.error?.message||'server rejected the change'}`); return }
    flash(`Message sent to ${msg.toName}` + syncNote(result));
  };
  const markRead = (msgId, empId)=>{
    if(messages.find(m=>m.id===msgId)?.readBy?.includes(empId)) return;
    actions.markRead(msgId, empId);
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
  const discount = discountOn ? subtotal*0.1 : 0;
  const total = subtotal - discount;
  const itemCount = cart.reduce((s,i)=>s+i.qty,0);
  const selectedCustomer = customers.find(c=>c.id===selectedCustomerId) || customers[0];

  const completeSale = async (payment, detail)=>{
    if(!cart.length) return;
    if(payment==='Gift'){
      const gc = giftCards.find(g=>g.code===detail.code && g.status==='active');
      if(!gc){ flash('Invalid gift card'); return }
      if(gc.balance < total){ flash(`Gift card balance ${format(gc.balance)} insufficient`); return }
    }

    const saleId = `POS-${String(Date.now()).slice(-6)}`;
    const invoiceNumber = saleId.replace('POS','INV');
    const sale = {
      id:saleId, invoiceNumber,
      date:todayKey(), time:shortTime(),
      cashier: currentUser?.name || 'Cashier',
      cashierId: currentUser?.id || cashierId,
      customerId: selectedCustomer?.id || '',
      customerName: selectedCustomer?.name || 'Walk-in customer',
      items: cart.map(i=>({productId:i.id,name:i.name,qty:i.qty,unitPrice:i.price,lineTotal:Number((i.price*i.qty).toFixed(2))})),
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      tax:0,
      total: Number(total.toFixed(2)),
      payment, paymentDetail: detail,
      itemCount, status:'paid'
    };

    const lowNow = cart.filter(i=>{
      const prod = products.find(p=>p.id===i.id);
      return prod && (prod.stock - i.qty) <= reorderOf(prod);
    }).map(i=>i.name);

    // Clear the till straight away; the sale is applied locally and pushed to
    // the API, or queued for later if the server is unreachable.
    setCart([]); setDiscountOn(false); setShowPay(false); setMobileCart(false);
    setSuccess(sale);
    const result = await actions.completeSale(sale);
    if(!result.ok){
      setSuccess(null);
      flash(`Sale not saved: ${result.error?.message||'server rejected the sale'}`);
      return;
    }
    if(result.queued) flash('Offline — sale saved on this device and will sync automatically');
    if(isOwner && lowNow.length){ setTimeout(()=>flash(`Low stock alert: ${lowNow.join(', ')} — restock soon`), 400); }
  };

  const todaySales = useMemo(()=> sales.filter(s=>s.date===todayKey()),[sales]);
  const visibleSales = useMemo(()=>{
    let list = isOwner ? sales : sales.filter(s=>s.cashierId===currentUser?.id || s.cashier===currentUser?.name);
    if(filterSales.search){
      const q=filterSales.search.toLowerCase();
      list = list.filter(s=> `${s.invoiceNumber} ${s.customerName} ${s.cashier} ${s.payment}`.toLowerCase().includes(q));
    }
    if(filterSales.payment!=='All') list=list.filter(s=>s.payment===filterSales.payment);
    if(isOwner && filterSales.cashier && filterSales.cashier!=='All'){
      const emp = employees.find(e=>e.id===filterSales.cashier);
      list = list.filter(s=>s.cashierId===filterSales.cashier || (emp && s.cashier===emp.name));
    }
    if(filterSales.date!=='All'){
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
    {id:'customers',label:'Customers',icon:Users},
    {id:'invoices',label:'Sales & Receipts',icon:FileText},
    {id:'expenses',label:'Expenses',icon:Coins},
    {id:'gift',label:'Gift Cards & Money Owed',icon:Gift},
    {id:'staff',label:'Staff Tracking',icon:UserCircle},
    {id:'reports',label:'Business Reports',icon:BarChart3},
    {id:'messages',label:'Messages',icon:MessageSquare},
  ];
  const navCashier = [
    {id:'pos',label:'POS',icon:ShoppingCart},
    {id:'inventory',label:'Items',icon:Package},
    {id:'customers',label:'Customers',icon:Users},
    {id:'invoices',label:'My Sales',icon:FileText},
    {id:'messages',label:'Messages',icon:MessageSquare},
  ];
  const nav = isOwner?navOwner:navCashier;

  if(sync.status==='loading') return <BootScreen sync={sync}/>;
  if(sync.status==='error') return <BootScreen sync={sync} error={sync.error}/>;
  if(!employees.length){
    return <BootScreen sync={sync} empty message={sync.status==='ready'
      ? 'The database is connected but has no staff accounts yet. Run “npm run seed” in the backend folder, or create an owner account.'
      : undefined}/>;
  }
  if(!role) return <LoginScreen employees={employees} onSignIn={signIn} sync={sync}/>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#"><div className="brand-mark">P</div><div className="brand-copy"><b>POSI<span>.</span></b><small>SHOP MANAGER</small></div></a>
        <div className="shop-card"><div className="shop-icon"><Store size={16}/></div><div className="shop-copy"><b>{SHOP.name}</b><small>{SHOP.address}</small></div><span className="shop-dot"/></div>

        <div className="nav-section">
          <div className="nav-label">MAIN MENU</div>
          <div className="nav-list">
            {nav.map(n=>(
              <button key={n.id} className={`nav-item ${view===n.id?'active':''}`} onClick={()=>setView(n.id)}>
                <n.icon size={18}/><span>{n.label}</span>
                {n.id==='inventory' && isOwner && lowStockItems.length>0 && <span className="badge">{lowStockItems.length}</span>}
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
          <div className="owner-note"><ShieldCheck size={16} style={{flex:'none',marginTop:'1px'}}/><span><b>{isOwner?'Owner control':'Cashier workspace'}</b><br/>All sales combine to the owner</span></div>
          <div className="profile">
            <div className={`avatar ${isOwner?'owner':'cashier'}`}>{currentUser?.initials||initials(currentUser?.name||'U')}</div>
            <div><b>{currentUser?.name}</b><small>{isOwner?'Store Owner':currentUser?.role}</small></div>
            <span className="role-pill">{isOwner?'OWNER':'CASHIER'}</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb"><span>Green Cross</span><span>›</span><b>{nav.find(n=>n.id===view)?.label||view}</b></div>
          <div className="top-actions">
            <SyncChip sync={sync}/>
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
                        <div className={`prod-img ${p.color}`} style={{width:'28px',height:'28px',fontSize:'9px'}}>{p.name.slice(0,2).toUpperCase()}</div>
                        <div style={{flex:1,minWidth:0}}><b style={{fontSize:'11px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{p.stock} left · reorder at {reorderOf(p)}</small></div>
                        <span className={`status ${p.stock===0?'bad':'warn'}`}><i/>{p.stock===0?'Out':'Low'}</span>
                        {isOwner && <button className="btn small" onClick={()=>{setStockModal({product:p,mode:'restock'});setAlertsOpen(false)}}>Restock</button>}
                      </div>
                    )) : <div style={{padding:'18px 10px',textAlign:'center',color:'#6b7d76',fontSize:'11px'}}><b style={{color:'#065f46',display:'block'}}>All stocked up</b>No low stock alerts</div>}
                  </div>
                  <button className="btn small" style={{width:'100%',marginTop:'8px'}} onClick={()=>{setView('inventory');setAlertsOpen(false)}}><Package size={13}/> Open stock management</button>
                </div>
              </>}
            </div>}
            <div className="user-menu"><div className={`avatar ${isOwner?'owner':'cashier'}`} style={{width:'28px',height:'28px',fontSize:'11px'}}>{currentUser?.initials||'U'}</div><span style={{fontSize:'12px',fontWeight:700,maxWidth:'110px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{currentUser?.name}</span></div>
            <button className="logout" onClick={signOut}><LogOut size={14}/> Sign out</button>
          </div>
        </header>

        <SyncBanner sync={sync}/>
        <div className="page">
          {view==='dashboard' && isOwner && <DashboardOwner sales={sales} todaySales={todaySales} products={products} customers={customers} employees={employees} activities={activities} messages={messages} giftCards={giftCards} expenses={expenses} setView={setView} onRestock={(p)=>setStockModal({product:p,mode:'restock'})} />}
          {view==='pos' && <POSPage
            products={filteredProducts} allProducts={products} categories={categories} cat={cat} setCat={setCat}
            search={search} setSearch={setSearch} cart={cart} setCart={setCart} addToCart={addToCart} updateQty={updateQty} removeFromCart={removeFromCart}
            customers={customers} selectedCustomerId={selectedCustomerId} setSelectedCustomerId={setSelectedCustomerId}
            subtotal={subtotal} discount={discount} total={total} itemCount={itemCount} discountOn={discountOn} setDiscountOn={setDiscountOn}
            showPay={showPay} setShowPay={setShowPay} mobileCart={mobileCart} setMobileCart={setMobileCart}
            completeSale={completeSale} giftCards={giftCards} isOwner={isOwner}
            onAddProduct={()=>{setEditingProduct(null);setShowProductModal(true)}}
          />}
          {view==='inventory' && <InventoryPage products={products} search={search} setSearch={setSearch} cat={cat} setCat={setCat} categories={categories} isOwner={isOwner} stockMoves={stockMoves} onEdit={(p)=>{setEditingProduct(p);setShowProductModal(true)}} onDelete={deleteProduct} onAdd={()=>{setEditingProduct(null);setShowProductModal(true)}} onStock={(p,mode)=>setStockModal({product:p,mode})} />}
          {view==='customers' && <CustomersPage customers={customers} sales={sales} isOwner={isOwner} onEdit={(c)=>{setEditingCustomer(c);setShowCustomerModal(true)}} onAdd={()=>{setEditingCustomer(null);setShowCustomerModal(true)}} onPayAccount={payAccount} />}
          {view==='invoices' && <InvoicesPage sales={visibleSales} isOwner={isOwner} filter={filterSales} setFilter={setFilterSales} onViewInvoice={setSelectedInvoice} onViewReceipt={setSelectedReceipt} employees={employees} />}
          {view==='expenses' && isOwner && <ExpensesPage expenses={expenses} onEdit={(e)=>{setEditingExpense(e);setShowExpenseModal(true)}} onAdd={()=>{setEditingExpense(null);setShowExpenseModal(true)}} onDelete={deleteExpense} />}
          {view==='gift' && isOwner && <GiftAccountPage giftCards={giftCards} customers={customers} sales={sales} onAdd={()=>setShowGiftModal(true)} onPayAccount={payAccount} />}
          {view==='staff' && isOwner && <StaffPage employees={employees} sales={sales} attendance={attendance} onEdit={(e)=>{setEditingEmployee(e);setShowEmployeeModal(true)}} onAdd={()=>{setEditingEmployee(null);setShowEmployeeModal(true)}} onViewSales={setStaffSales} />}
          {view==='reports' && isOwner && <ReportsPage sales={sales} products={products} customers={customers} giftCards={giftCards} expenses={expenses} />}
          {view==='messages' && <MessagesPage messages={messages} employees={employees} currentUser={currentUser} isOwner={isOwner} onSend={()=>setShowMessageModal(true)} onMarkRead={markRead} />}
        </div>

        <button className="fab" onClick={()=>setMobileCart(true)}><ShoppingCart size={18}/> View sale <span style={{background:'#ffffff22',padding:'2px 8px',borderRadius:'20px'}}>{itemCount}</span> <b>{format(total)}</b></button>
        <nav className="mnav">
          {nav.slice(0,5).map(n=>(
            <button key={n.id} className={view===n.id?'active':''} onClick={()=>setView(n.id)}><n.icon size={18}/><span>{n.label}</span></button>
          ))}
        </nav>
      </main>

      {/* Modals */}
      {showProductModal && <ProductModal product={editingProduct} categories={categories.filter(c=>c!=='All')} onClose={()=>{setShowProductModal(false);setEditingProduct(null)}} onSave={saveProduct} />}
      {showCustomerModal && <CustomerModal customer={editingCustomer} onClose={()=>{setShowCustomerModal(false);setEditingCustomer(null)}} onSave={saveCustomer} />}
      {showEmployeeModal && <EmployeeModal employee={editingEmployee} onClose={()=>{setShowEmployeeModal(false);setEditingEmployee(null)}} onSave={saveEmployee} />}
      {showGiftModal && <GiftModal customers={customers} onClose={()=>setShowGiftModal(false)} onSave={saveGiftCard} />}
      {showMessageModal && <MessageModal employees={employees} currentUser={currentUser} onClose={()=>setShowMessageModal(false)} onSend={sendMessage} />}
      {showExpenseModal && <ExpenseModal expense={editingExpense} onClose={()=>{setShowExpenseModal(false);setEditingExpense(null)}} onSave={saveExpense} employees={employees} />}
      {stockModal && <StockModal stock={stockModal} onClose={()=>setStockModal(null)} onSave={applyStockChange} />}
      {staffSales && <StaffSalesModal employee={staffSales} sales={sales} onClose={()=>setStaffSales(null)} onViewInvoice={(s)=>{setStaffSales(null);setSelectedInvoice(s)}} onViewReceipt={(s)=>{setStaffSales(null);setSelectedReceipt(s)}} />}
      {showPay && <PaymentModal cart={cart} subtotal={subtotal} discount={discount} total={total} customer={selectedCustomer} giftCards={giftCards} onClose={()=>setShowPay(false)} onComplete={completeSale} />}
      {selectedInvoice && <InvoiceModal sale={selectedInvoice} onClose={()=>setSelectedInvoice(null)} onPrintReceipt={(s)=>{setSelectedInvoice(null);setSelectedReceipt(s)}} />}
      {selectedReceipt && <ReceiptModal sale={selectedReceipt} onClose={()=>setSelectedReceipt(null)} />}
      {toast && <div className="toast"><CheckCircle2 size={16}/>{toast}</div>}
      {success && <div className="success"><span style={{width:'32px',height:'32px',borderRadius:'50%',background:'#ecfdf5',color:'#065f46',display:'grid',placeItems:'center'}}><Check size={16}/></span><span><b>Sale invoiced!</b><small>{success.invoiceNumber} · {format(success.total)}</small></span><button className="btn small primary" onClick={()=>{setSelectedReceipt(success);setSuccess(null)}}><Printer size={14}/>Print receipt</button><button className="btn small" onClick={()=>{setSelectedInvoice(success);setSuccess(null)}}><FileText size={14}/>Invoice</button><button className="btn icon small" onClick={()=>setSuccess(null)}><X size={14}/></button></div>}
    </div>
  );
}

// Components

// Sync + boot chrome ---------------------------------------------------------

function SyncChip({sync}){
  const { status, syncing, pending, lastSyncedAt } = sync;
  if(syncing) return <span className="chip syncing" title="Talking to the POSI server"><i/> Syncing…</span>;
  if(status==='ready'){
    const time = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit',hour12:false}) : null;
    return <span className={`chip ${pending?'offline':'online'}`} title={time?`Last synced at ${time}`:'Connected to the POSI server'}><i/> {pending?`${pending} queued`:'Synced'}</span>;
  }
  if(status==='error') return <span className="chip offline" title={sync.error||''}><WifiOff size={12}/> No server</span>;
  return <span className="chip offline" title={sync.error||''}><i/> {pending?`Offline · ${pending} queued`:'Offline'}</span>;
}

function SyncBanner({sync}){
  const offline = sync.status!=='ready';
  if(sync.issue){
    return <div className="sync-banner error"><CloudOff size={15}/><span><b>Sync problem.</b> {sync.issue}</span><button className="btn small" onClick={sync.retry}><RefreshCw size={12}/> Retry</button><button className="btn icon small" onClick={sync.dismissIssue}><X size={12}/></button></div>;
  }
  if(sync.pending){
    return <div className="sync-banner warn"><Cloud size={15}/><span><b>{sync.pending} change{sync.pending===1?'':'s'} waiting to sync.</b> Saved on this device — will upload when the server is reachable.</span><button className="btn small" onClick={sync.retry} disabled={sync.syncing}><RefreshCw size={12}/>{sync.syncing?'Syncing…':'Sync now'}</button></div>;
  }
  if(offline){
    return <div className="sync-banner"><WifiOff size={15}/><span><b>Working offline.</b> Showing the last data saved on this device{sync.error?` · ${sync.error}`:''}. Sales keep working and will sync when the connection returns.</span><button className="btn small" onClick={sync.refresh} disabled={sync.syncing}><RefreshCw size={12}/> Try again</button></div>;
  }
  return null;
}

function BootScreen({sync, error, empty=false, message}){
  const failed = Boolean(error);
  return (
    <div className="boot">
      <div className="boot-card">
        <div className="brand-mark" style={{width:'44px',height:'44px',fontSize:'18px'}}>P</div>
        <h1>{empty?'No staff accounts yet':failed?'Cannot reach the POSI server':'Connecting to the database'}</h1>
        {empty
          ? <p>{message||'The database is empty. Seed the demo datasets from the backend folder to get started.'}</p>
          : failed
            ? <p>{error}</p>
            : <p>Loading products, sales, staff and reports.</p>}
        {!empty && !failed && <div className="boot-progress"><Loader2 size={16} className="spin"/> Syncing…</div>}
        {failed && <button className="btn primary" onClick={()=>sync.refresh()}><RefreshCw size={14}/> Try again</button>}
        {failed && <small className="boot-note">Start the API with <code>npm run dev:api</code> (default http://localhost:8787) or set <code>VITE_API_BASE</code> to your deployed backend URL.</small>}
        {empty && <small className="boot-note"><code>cd backend &amp;&amp; npm run seed</code></small>}
      </div>
    </div>
  );
}

function LoginScreen({employees,onSignIn,sync}){
  const [role,setRole]=useState('owner');
  const [cashierId,setCashierId]=useState(employees.filter(e=>e.role==='cashier')[0]?.id||'e2');
  const connected = sync?.status==='ready';
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
        <div className="login-card">
          <span style={{fontSize:'10px',fontWeight:800,letterSpacing:'1px',color:'#0f766e'}}>GREEN CROSS DRUG STORE · ACCRA</span>
          <h2 style={{margin:'8px 0 4px',fontSize:'24px',fontWeight:900}}>Sign in to POSI</h2>
          <p style={{margin:0,color:'#6b7d76',fontSize:'13px'}}>Choose workspace. Owner sees combined accounts.</p>

          <div style={{display:'flex',flexDirection:'column',gap:'8px',margin:'20px 0'}}>
            <button className={`btn ${role==='owner'?'primary':'ghost'}`} style={{justifyContent:'flex-start',minHeight:'64px'}} onClick={()=>setRole('owner')}>
              <ShieldCheck size={20}/><span style={{textAlign:'left'}}><b>Owner workspace</b><small style={{display:'block',fontWeight:400,color:role==='owner'?'#a7f3d0':'#6b7d76'}}>Combined accounts, reports, employees, messages</small></span>{role==='owner'&&<Check size={16} style={{marginLeft:'auto'}}/>}
            </button>
            <button className={`btn ${role==='cashier'?'primary':'ghost'}`} style={{justifyContent:'flex-start',minHeight:'64px'}} onClick={()=>setRole('cashier')}>
              <ShoppingCart size={20}/><span style={{textAlign:'left'}}><b>Cashier workspace</b><small style={{display:'block',fontWeight:400,color:role==='cashier'?'#a7f3d0':'#6b7d76'}}>Fast POS, customers, sales history</small></span>{role==='cashier'&&<Check size={16} style={{marginLeft:'auto'}}/>}
            </button>
          </div>

          {role==='cashier' && (
            <div className="field"><label>Select cashier account</label>
              <select value={cashierId} onChange={e=>setCashierId(e.target.value)}>
                {employees.filter(e=>e.role!=='owner').map(e=><option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
              </select>
            </div>
          )}

          <button className="btn primary" style={{width:'100%',marginTop:'16px',justifyContent:'space-between'}} onClick={()=>onSignIn(role,cashierId)}>
            <span>Continue as {role}</span><ArrowRight size={18}/>
          </button>

          <div style={{marginTop:'14px',padding:'10px',borderRadius:'8px',background:'#f6fbf8',display:'flex',gap:'8px',fontSize:'11px',color:'#4a635c'}}>
            <ShieldCheck size={14} style={{flex:'none'}}/><span><b>Demo POS</b> — No password. Sales and stock are stored in the shop's PostgreSQL database, so every device on the counter sees the same records. {connected?`Connected to the server${sync.lastSyncedAt?` · synced ${new Date(sync.lastSyncedAt).toLocaleTimeString('en-GH',{hour:'2-digit',minute:'2-digit',hour12:false})}`:''}`:'Working offline from this device\u2019s saved data'}.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardOwner({sales,todaySales,products,customers,employees,activities,messages,giftCards,expenses,setView,onRestock}){
  const lowStock = products.filter(p=>p.stock<=reorderOf(p)).sort((a,b)=>a.stock-b.stock);
  const todayExpenses = expenses.filter(e=>e.date===todayKey());
  const todayExpenseTotal = todayExpenses.reduce((s,e)=>s+Number(e.amount||0),0);
  const totalToday = todaySales.reduce((s,x)=>s+Number(x.total||0),0);
  const weekSales = sales.filter(s=>{ const d=new Date(); d.setDate(d.getDate()-7); return s.date>=d.toISOString().slice(0,10) });
  const weekTotal = weekSales.reduce((s,x)=>s+Number(x.total||0),0);
  const accountReceivable = customers.reduce((s,c)=>s+Number(c.balance||0),0);
  const giftLiability = giftCards.filter(g=>g.status==='active').reduce((s,g)=>s+Number(g.balance||0),0);
  const byPayment = paymentMethods.map(pm=>({
    method:pm.id,
    total: sales.filter(s=>s.payment===pm.id).reduce((s,x)=>s+Number(x.total||0),0),
    count: sales.filter(s=>s.payment===pm.id).length
  }));
  const topProducts = (()=>{ const m=new Map(); sales.forEach(s=>s.items?.forEach(it=>{ const cur=m.get(it.name)||{name:it.name,qty:0,rev:0}; cur.qty+=it.qty; cur.rev+=it.lineTotal; m.set(it.name,cur)})); return [...m.values()].sort((a,b)=>b.qty-a.qty).slice(0,5) })();

  const combinedTotal = sales.reduce((s,x)=>s+Number(x.total||0),0);

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><span className="kicker-dot"/> OWNER OVERVIEW · {fullDate().toUpperCase()}</div><h1>Drug store overview — combined accounts</h1><p>All cashier sales, money owed, and inventory combined to owner. Monitor cash, MoMo and gift sales at a glance.</p></div><button className="btn primary" onClick={()=>setView('pos')}><ShoppingCart size={16}/> New Sale</button></div>

      <div className="grid metrics" style={{marginBottom:'14px'}}>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><Wallet size={16}/></div><span style={{fontSize:'10px',fontWeight:800,color:'#065f46',background:'#ecfdf5',padding:'3px 7px',borderRadius:'20px'}}>TODAY</span></div><div className="metric-label">Sales today (combined)</div><div className="metric-value">{format(totalToday)}</div><div className="metric-note"><em><TrendingUp size={12}/>+12%</em> {todaySales.length} transactions from all cashiers</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon dark"><DollarSign size={16}/></div></div><div className="metric-label">Total combined revenue</div><div className="metric-value">{format(combinedTotal)}</div><div className="metric-note">All payment methods combined to owner</div></div>
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
          </tbody></table></div>
          <div style={{marginTop:'10px',fontSize:'11px',color:'#6b7d76',display:'flex',justifyContent:'space-between'}}><span>Combined to owner: {format(combinedTotal)}</span><span>{sales.length} total invoices</span></div>
        </div>

        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><div><h2>Low stock alerts</h2><p className="sub">Items at or below reorder level</p></div><AlertTriangle size={16} color={lowStock.length?'#b45309':'#6b7d76'}/></div>
          {lowStock.length? (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {lowStock.slice(0,6).map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px',border:'1px solid #fde68a',background:'#fffbeb',borderRadius:'8px'}}>
                  <div className={`prod-img ${p.color}`} style={{width:'28px',height:'28px',fontSize:'9px'}}>{p.name.slice(0,2).toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#92400e'}}>{p.stock} left · reorder at {reorderOf(p)}</small></div>
                  <span className={`status ${p.stock===0?'bad':'warn'}`}><i/>{p.stock===0?'Out':'Low'}</span>
                  <button className="btn small" onClick={()=>onRestock(p)}>Restock</button>
                </div>
              ))}
              {lowStock.length>6 && <button className="btn small ghost" onClick={()=>setView('inventory')}>View all {lowStock.length} alerts</button>}
            </div>
          ) : <div className="empty-state"><b>Everything is stocked</b><small>Alerts appear when items reach their reorder level</small></div>}
        </div>

        <div className="card">
          <h2>Recent activity</h2><p className="sub">Latest shop updates</p>
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
      </div>
    </div>
  );
}

function POSPage({products,allProducts,categories,cat,setCat,search,setSearch,cart,setCart,addToCart,updateQty,removeFromCart,customers,selectedCustomerId,setSelectedCustomerId,subtotal,discount,total,itemCount,discountOn,setDiscountOn,showPay,setShowPay,mobileCart,setMobileCart,completeSale,giftCards,onAddProduct,isOwner}){
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><span className="kicker-dot"/> POINT OF SALE</div><h1>Make a sale — Cash, MoMo &amp; Gift</h1><p>Fast drug store checkout. Select customer, add items, choose payment. All sales combine to the owner.</p></div><div className="kpi-row"><span className="kpi"><Package size={14}/> {allProducts.length} items</span><span className="kpi"><Users size={14}/> {customers.length-1} customers</span></div></div>

      <div className="pos">
        <div className="catalog">
          <div className="card" style={{padding:'12px'}}>
            <div className="search-row">
              <div className="search"><Search size={16} color="#6b7d76"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, SKU, barcode…"/><span style={{fontSize:'10px',color:'#94a8a1',border:'1px solid #e7ece8',padding:'2px 6px',borderRadius:'4px'}}>⌘K</span></div>
              {isOwner && <button className="btn small" onClick={onAddProduct}><Plus size={14}/> Add item</button>}
            </div>
            <div className="chips" style={{marginTop:'10px'}}>
              {categories.map(c=><button key={c} className={`chip-btn ${cat===c?'active':''}`} onClick={()=>setCat(c)}>{c}{c==='All'&&` (${allProducts.length})`}</button>)}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px',fontSize:'11px',color:'#6b7d76'}}><span>{products.length} products</span><span>Tap to add to sale</span></div>
          </div>

          <div className="products">
            {products.map(p=>(
              <button key={p.id} className="prod" onClick={()=>addToCart(p)} disabled={p.stock<1}>
                <div className="prod-top"><div className={`prod-img ${p.color}`}>{p.name.slice(0,2).toUpperCase()}</div><span className={`stock ${isOwner&&p.stock<=reorderOf(p)?'low':''}`}>{p.stock<1?'Out of stock':(isOwner&&p.stock<=reorderOf(p)?`${p.stock} left`:'In stock')}</span></div>
                <b>{p.name}</b><small>{p.brand} · {p.category}</small>
                <div className="prod-foot"><strong>{format(p.price)}</strong><span className="add"><Plus size={14}/></span></div>
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
                <div style={{width:'36px',height:'36px',borderRadius:'8px',background:'#ecfdf5',display:'grid',placeItems:'center',fontSize:'10px',fontWeight:800,color:'#065f46'}}>{i.name.slice(0,2).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}><b>{i.name}</b><small>{format(i.price)} · {i.brand||i.category}</small><div className="qty"><button onClick={()=>updateQty(i.id,-1)}><Minus size={12}/></button><span>{i.qty}</span><button onClick={()=>updateQty(i.id,1)}><Plus size={12}/></button></div></div>
                <div className="line-total"><b>{format(i.price*i.qty)}</b><button onClick={()=>removeFromCart(i.id)}><X size={14}/></button></div>
              </div>
            )) : <div className="empty"><span style={{width:'40px',height:'40px',borderRadius:'50%',background:'#f3f4f6',display:'grid',placeItems:'center',margin:'0 auto'}}><ShoppingCart size={18}/></span><b>Sale empty</b><small>Tap products to add</small></div>}
          </div>

          <div style={{padding:'10px 14px',borderTop:'1px solid #e7ece8',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600}}><input type="checkbox" checked={discountOn} onChange={e=>setDiscountOn(e.target.checked)}/> Apply 10% discount</label>
            <span style={{fontSize:'11px',color:'#6b7d76'}}>{discountOn?`-${format(discount)}`:''}</span>
          </div>

          <div className="totals">
            <div className="totals-row"><span>Subtotal</span><b>{format(subtotal)}</b></div>
            {discountOn && <div className="totals-row" style={{color:'#0f766e'}}><span>Discount 10%</span><b>-{format(discount)}</b></div>}
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
          <div className="secure"><ShieldCheck size={12}/> All sales combine to the owner</div>
        </div>
      </div>
    </div>
  );
}

function InventoryPage({products,search,setSearch,cat,setCat,categories,isOwner,stockMoves,onEdit,onDelete,onAdd,onStock}){
  const [stockFilter,setStockFilter]=useState('All');
  const filtered = products.filter(p=>{
    const matchCat = cat==='All'||p.category===cat;
    const q = search.toLowerCase();
    const matchesText = matchCat && `${p.name} ${p.brand} ${p.sku} ${p.category} ${p.supplier||''}`.toLowerCase().includes(q);
    const matchesStock = stockFilter==='All' || (stockFilter==='Low' && p.stock<=reorderOf(p)) || (stockFilter==='Out' && p.stock===0);
    return matchesText && matchesStock;
  });
  const low = products.filter(p=>p.stock<=reorderOf(p)).length;
  const out = products.filter(p=>p.stock===0).length;
  const stockValue = products.reduce((s,p)=>s+Number(p.cost||0)*Number(p.stock||0),0);
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Package size={12}/> {isOwner?'STOCK & ITEM LIST':'ITEM LIST'}</div><h1>{isOwner?'Stock management & item records':'Item list'}</h1><p>{isOwner?'Manage products, reorder levels and stock. Restock in, record damage/loss, and follow every unit in the movement log. Low stock alerts and profit tracking are owner-only.':'Browse products, prices and availability. Cost, profit and reorder tracking are managed by the owner.'}</p></div>{isOwner && <button className="btn primary" onClick={onAdd}><Plus size={16}/> Add item</button>}</div>
      <div className="kpi-row" style={{marginBottom:'12px'}}>
        <span className="kpi"><Package size={14}/> <b>{products.length}</b> total items</span>
        {isOwner && <span className="kpi" style={{color:low?'#92400e':'#065f46',background:low?'#fef3c7':'#ecfdf5'}}><AlertTriangle size={14}/> <b>{low}</b> low stock</span>}
        {isOwner && <span className="kpi" style={{color:out?'#991b1b':'#065f46',background:out?'#fef2f2':'#ecfdf5'}}><TrendingDown size={14}/> <b>{out}</b> out of stock</span>}
        {isOwner && <span className="kpi"><Wallet size={14}/> Stock value <b>{format(stockValue)}</b></span>}
        {isOwner && <span className="kpi"><History size={14}/> <b>{stockMoves.length}</b> stock moves</span>}
      </div>
      <div className="card">
        <div className="toolbar">
          <div className="search" style={{maxWidth:'380px'}}><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={isOwner?'Search items, SKU, brand, supplier…':'Search items, SKU, brand…'}/></div>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option>All</option>{categories.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}</select>
          {isOwner && <div className="chips">{['All','Low','Out'].map(f=><button key={f} className={`chip-btn ${stockFilter===f?'active':''}`} onClick={()=>setStockFilter(f)}>{f==='All'?'All stock':f==='Low'?'Low stock':'Out of stock'}</button>)}</div>}
        </div>
        <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>STOCK</th>{isOwner&&<th>REORDER AT</th>}{isOwner&&<th>COST</th>}<th>PRICE</th>{isOwner&&<th>PROFIT</th>}<th>STATUS</th>{isOwner&&<th></th>}</tr></thead><tbody>
          {filtered.map(p=>{
            const profit = p.price - (p.cost||0);
            const margin = p.price? (profit/p.price*100):0;
            return <tr key={p.id}>
              <td><div style={{display:'flex',alignItems:'center',gap:'8px'}}><div className={`prod-img ${p.color}`} style={{width:'32px',height:'32px',fontSize:'9px'}}>{p.name.slice(0,2).toUpperCase()}</div><span><b style={{fontSize:'12px'}}>{p.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{p.brand}{isOwner&&p.supplier?` · ${p.supplier}`:''}</small></span></div></td>
              <td>{p.sku}</td><td>{p.category}</td>
              <td><b style={{color:isOwner&&p.stock<=reorderOf(p)?'#92400e':'#065f46'}}>{p.stock}</b> units</td>
              {isOwner&&<td>{reorderOf(p)}</td>}
              {isOwner&&<td>{format(p.cost||0)}</td>}
              <td><b>{format(p.price)}</b></td>
              {isOwner&&<td><span style={{color:profit>0?'#065f46':'#991b1b'}}>{format(profit)} ({margin.toFixed(0)}%)</span></td>}
              <td><span className={`status ${p.stock===0?'bad':(isOwner&&p.stock<=reorderOf(p))?'warn':'ok'}`}><i/>{p.stock===0?'Out':(isOwner&&p.stock<=reorderOf(p))?'Low':'In stock'}</span></td>
              {isOwner&&<td><div style={{display:'flex',gap:'4px'}}>
                <button className="btn small" title="Restock in" onClick={()=>onStock(p,'restock')}><Plus size={12}/> Stock</button>
                <button className="btn small" title="Adjust (damage/loss/count)" onClick={()=>onStock(p,'adjust')}>± Adj</button>
                <button className="btn small" onClick={()=>onEdit(p)}><Edit2 size={12}/> Edit</button>
                <button className="btn small" style={{color:'#b91c1c'}} onClick={()=>{if(confirm(`Delete ${p.name}?`)) onDelete(p.id)}}><Trash2 size={12}/></button>
              </div></td>}
            </tr>
          })}
        </tbody></table></div>
        {filtered.length===0 && <div className="empty-state"><b>No items</b><small>Try different filter</small></div>}
        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 2px 2px',fontSize:'11px',color:'#6b7d76'}}><span>Showing {filtered.length} of {products.length}</span><span>{isOwner?'Owner controls inventory':'Owner controls product records'}</span></div>
      </div>

      {isOwner && <div className="card" style={{marginTop:'14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><div><h2>Stock movement log</h2><p className="sub">Every unit in and out — sales, restocks and adjustments</p></div><History size={16} color="#6b7d76"/></div>
        <div className="table-wrap"><table><thead><tr><th>DATE</th><th>PRODUCT</th><th>TYPE</th><th>QTY</th><th>BY</th><th>NOTE</th></tr></thead><tbody>
          {stockMoves.slice(0,15).map(m=>{
            const t = stockMoveTypes[m.type]||stockMoveTypes.adjustment;
            return <tr key={m.id}>
              <td><b style={{fontSize:'12px'}}>{m.date===todayKey()?'Today':readableDate(m.date)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{m.time}</small></td>
              <td>{m.productName}</td>
              <td><span className={`status ${m.type==='restock'?'info':m.type==='sale'?'ok':'warn'}`}><i/>{t.label}</span></td>
              <td><b style={{color:m.qty>0?'#065f46':'#991b1b'}}>{m.qty>0?`+${m.qty}`:m.qty}</b></td>
              <td>{m.by}</td><td style={{color:'#6b7d76'}}>{m.note||'—'}</td>
            </tr>
          })}
        </tbody></table></div>
        {stockMoves.length===0 && <div className="empty-state"><History size={20}/><b>No stock moves yet</b><small>Restocks, sales and adjustments will appear here</small></div>}
      </div>}
    </div>
  );
}

function CustomersPage({customers,sales,isOwner,onEdit,onAdd,onPayAccount}){
  const [q,setQ]=useState('');
  const [payModal,setPayModal]=useState(null);
  const [payAmount,setPayAmount]=useState('');
  const filtered = customers.filter(c=>{
    if(c.isWalkIn) return false;
    return `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase());
  });
  const totalReceivable = filtered.reduce((s,c)=>s+Number(c.balance||0),0);
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Users size={12}/> CUSTOMER LIST</div><h1>Customer list &amp; money owed</h1><p>Track customers, balances and total spent. Payments reduce what customers owe. Combined to owner.</p></div><button className="btn primary" onClick={onAdd}><UserPlus size={16}/> Add customer</button></div>
      <div className="kpi-row" style={{marginBottom:'12px'}}><span className="kpi"><b>{filtered.length}</b> customers</span><span className="kpi" style={{background:'#fffbeb'}}><Wallet size={14}/> <b>{format(totalReceivable)}</b> owed</span><span className="kpi"><TrendingUp size={14}/> Combined to owner</span></div>
      <div className="card">
        <div className="toolbar"><div className="search" style={{maxWidth:'360px'}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customer, phone…"/></div><button className="btn small" onClick={()=>{const blob=new Blob([JSON.stringify(customers,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='customers.json'; a.click(); URL.revokeObjectURL(url)}}><Download size={14}/> Export</button></div>
        <div className="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>BALANCE (OWES)</th><th>TOTAL SPENT</th><th>VISITS</th><th>STATUS</th><th></th></tr></thead><tbody>
          {filtered.map(c=>{
            const custSales = sales.filter(s=>s.customerId===c.id);
            return <tr key={c.id}><td><div style={{display:'flex',alignItems:'center',gap:'8px'}}><div className="avatar cashier" style={{width:'28px',height:'28px',fontSize:'10px'}}>{initials(c.name)}</div><span><b style={{fontSize:'12px'}}>{c.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{c.email||c.address}</small></span></div></td><td>{c.phone||'—'}</td><td><b style={{color:c.balance>0?'#991b1b':'#065f46'}}>{format(c.balance)}</b></td><td>{format(c.totalSpent)}</td><td>{c.visits||custSales.length}</td><td><span className={`status ${c.balance>0?'warn':'ok'}`}><i/>{c.balance>0?'Owes':'Clear'}</span></td><td><div style={{display:'flex',gap:'4px'}}><button className="btn small" onClick={()=>onEdit(c)}><Edit2 size={12}/> Edit</button>{c.balance>0 && isOwner && <button className="btn small primary" onClick={()=>{setPayModal(c);setPayAmount(String(c.balance))}}><DollarSign size={12}/> Pay</button>}</div></td></tr>
          })}
        </tbody></table></div>
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

function InvoicesPage({sales,isOwner,filter,setFilter,onViewInvoice,onViewReceipt,employees}){
  const total = sales.reduce((s,x)=>s+Number(x.total||0),0);
  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><FileText size={12}/> SALES HISTORY</div><h1>{isOwner?'Sales history — every employee':'My sales history'}</h1><p>{isOwner?'All invoices from every employee combined to owner. Filter by employee or payment: cash, momo, gift.':'Your sales recorded to the owner.'}</p></div><div className="kpi-row"><span className="kpi"><b>{sales.length}</b> invoices</span><span className="kpi"><b>{format(total)}</b> total</span><button className="btn small" onClick={()=>{ const header=['Invoice','Date','Time','Seller','Customer','Items','Payment','Total']; const rows=sales.map(s=>[s.invoiceNumber,s.date,s.time,s.cashier,s.customerName,s.itemCount,s.payment,s.total]); const csv=[header,...rows].map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`sales-${todayKey()}.csv`; a.click(); URL.revokeObjectURL(url)}}><Download size={14}/> Export CSV</button></div></div>

      <div className="card">
        <div className="toolbar">
          <div className="search" style={{maxWidth:'320px'}}><Search size={16}/><input value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} placeholder="Search invoice, customer, seller…"/></div>
          {isOwner && <select value={filter.cashier||'All'} onChange={e=>setFilter(f=>({...f,cashier:e.target.value}))} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option value="All">All employees</option>{employees.filter(e=>e.role!=='owner').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>}
          <select value={filter.payment} onChange={e=>setFilter(f=>({...f,payment:e.target.value}))} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option>All</option><option>Cash</option><option>MoMo</option><option>Gift</option></select>
          <select value={filter.date} onChange={e=>setFilter(f=>({...f,date:e.target.value}))} style={{minHeight:'42px',border:'1px solid #e7ece8',borderRadius:'10px',padding:'0 10px'}}><option value="All">All dates</option><option value="Today">Today</option><option value="Week">Last 7 days</option><option value="Month">This month</option></select>
        </div>
        <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>DATE</th><th>CUSTOMER</th><th>SELLER</th><th>PAYMENT</th><th>ITEMS</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead><tbody>
          {sales.map(s=><tr key={s.id}><td><b style={{color:'#0f766e',fontSize:'12px'}}>{s.invoiceNumber}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{s.id}</small></td><td><b>{s.date===todayKey()?'Today':readableDate(s.date)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{s.time}</small></td><td>{s.customerName}</td><td>{s.cashier}</td><td><span className={`badge-pay ${s.payment.toLowerCase()}`}>{s.payment}</span></td><td>{s.itemCount}</td><td><b>{format(s.total)}</b></td><td><span className="status ok"><i/>Paid</span></td><td><div style={{display:'flex',gap:'4px'}}><button className="btn small" onClick={()=>onViewInvoice(s)}><Eye size={12}/> View</button><button className="btn small" onClick={()=>onViewReceipt(s)}><Receipt size={12}/> Receipt</button></div></td></tr>)}
        </tbody></table></div>
        {sales.length===0 && <div className="empty-state"><FileText size={20}/><b>No sales found</b><small>Try different filters</small></div>}
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
      <div className="page-head"><div><div className="eyebrow"><Gift size={12}/> GIFT CARDS &amp; MONEY OWED</div><h1>Gift cards &amp; money owed</h1><p>Manage gift cards (gift payment) and money customers owe. All combined to owner.</p></div><button className="btn primary" onClick={onAdd}><Plus size={16}/> New gift card</button></div>

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
          </tbody></table></div>
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
            </tbody></table></div>
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

function StaffPage({employees,sales,attendance,onEdit,onAdd,onViewSales}){
  const [tab,setTab]=useState('team');
  const [attFilter,setAttFilter]=useState('All');
  const today = todayKey();
  const clockedInToday = attendance.filter(a=>a.date===today && !a.out);
  const attRows = attendance
    .filter(a=> attFilter==='All' || (attFilter==='Open' && !a.out) || (attFilter==='Today' && a.date===today))
    .slice().sort((a,b)=> (b.date+(b.in||'')).localeCompare(a.date+(a.in||'')));
  const totalHoursToday = attendance.filter(a=>a.date===today).reduce((s,a)=>s+Number(a.hours||0),0);
  const payroll = employees.reduce((s,e)=>s+Number(e.salary||0),0);

  return (
    <div>
      <div className="page-head"><div><div className="eyebrow"><Users size={12}/> STAFF TRACKING</div><h1>Staff tracking, attendance &amp; control</h1><p>Owner creates staff accounts, sees every employee's sales history, and tracks clock-in/out hours and payroll. All sales combine to the owner.</p></div><button className="btn primary" onClick={onAdd}><UserPlus size={16}/> Create staff account</button></div>

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
                <div style={{display:'flex',gap:'10px',alignItems:'center'}}><div className={`avatar ${emp.role==='owner'?'owner':'cashier'}`} style={{width:'40px',height:'40px'}}>{emp.initials}</div><div style={{flex:1}}><b style={{fontSize:'13px'}}>{emp.name}</b><small style={{display:'block',fontSize:'11px',color:'#6b7d76'}}>{emp.role} · {emp.shift}</small></div><span className={`status ${openShift?'ok':emp.status==='On shift'?'info':'neutral'}`}><i/>{openShift?`In ${openShift.in}`:emp.status}</span></div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'12px'}}>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>SALES COUNT</small><b style={{display:'block',fontSize:'14px'}}>{empSales.length}</b></div>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>TOTAL TO OWNER</small><b style={{display:'block',fontSize:'14px'}}>{format(empTotal)}</b></div>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>ITEMS SOLD</small><b style={{display:'block',fontSize:'14px'}}>{empItems}</b></div>
                  <div style={{padding:'8px',background:'#f9fbf9',borderRadius:'8px',border:'1px solid #e7ece8'}}><small style={{fontSize:'10px',color:'#6b7d76'}}>HOURS (7 DAYS)</small><b style={{display:'block',fontSize:'14px'}}>{weekHours}h</b></div>
                </div>
                <div style={{display:'flex',gap:'6px',marginTop:'10px',flexWrap:'wrap'}}><button className="btn small primary" onClick={()=>onViewSales(emp)}><FileText size={12}/> Sales history</button><button className="btn small" onClick={()=>onEdit(emp)}><Edit2 size={12}/> Edit</button><span style={{fontSize:'11px',color:'#6b7d76',marginLeft:'auto',alignSelf:'center'}}>{emp.phone}</span></div>
              </div>
            })}
          </div>

          <div className="card">
            <h2>Owner control — combined accounts</h2><p className="sub">How employee sales combine</p>
            <div style={{marginTop:'12px',display:'flex',flexDirection:'column',gap:'8px',fontSize:'12px'}}>
              <div style={{display:'flex',gap:'10px',padding:'10px',background:'#f6fffe',border:'1px solid #ccede8',borderRadius:'8px'}}><span style={{width:'28px',height:'28px',borderRadius:'50%',background:'#0f2320',color:'#fff',display:'grid',placeItems:'center',flex:'none'}}>1</span><span><b>Employee makes sale</b> — cash, momo, or gift card. Sale recorded with seller name.</span></div>
              <div style={{display:'flex',gap:'10px',padding:'10px',background:'#f6fffe',border:'1px solid #ccede8',borderRadius:'8px'}}><span style={{width:'28px',height:'28px',borderRadius:'50%',background:'#0f2320',color:'#fff',display:'grid',placeItems:'center',flex:'none'}}>2</span><span><b>Automatically combined to owner</b> — owner dashboard sums all cashier totals. Payment breakdown shows cash vs momo vs gift.</span></div>
              <div style={{display:'flex',gap:'10px',padding:'10px',background:'#f6fffe',border:'1px solid #ccede8',borderRadius:'8px'}}><span style={{width:'28px',height:'28px',borderRadius:'50%',background:'#0f2320',color:'#fff',display:'grid',placeItems:'center',flex:'none'}}>3</span><span><b>Owner controls</b> — edit items, employees, customers, gift cards, view financial reports, send messages to employees.</span></div>
            </div>
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
          </tbody></table></div>
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
      ['Invoice','Date','Cashier','Payment','Total'],
      ...filtered.map(s=>[s.invoiceNumber,s.date,s.cashier,s.payment,Number(s.total).toFixed(2)]),
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
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon green"><DollarSign size={16}/></div></div><div className="metric-label">Revenue ({range})</div><div className="metric-value">{format(total)}</div><div className="metric-note">{filtered.length} invoices</div></div>
        <div className="card metric-card"><div className="metric-top"><div className="metric-icon dark"><TrendingUp size={16}/></div></div><div className="metric-label">Gross profit (after COGS)</div><div className="metric-value">{format(grossProfit)}</div><div className="metric-note">{total?`${(grossProfit/total*100).toFixed(1)}% margin · COGS ${format(cogs)}`:`COGS ${format(cogs)}`}</div></div>
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
      <div className="page-head"><div><div className="eyebrow"><MessageSquare size={12}/> OWNER MESSAGES TO EMPLOYEES</div><h1>Messages — owner to employees</h1><p>Owner can broadcast to all or send to specific employee. Employees see inbox. Combined account shop communication.</p></div>{isOwner && <button className="btn primary" onClick={onSend}><Send size={16}/> New message</button>}</div>

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

      <div className="card" style={{marginTop:'14px',background:'#f6fffe',borderColor:'#ccede8'}}>
        <h2 style={{display:'flex',alignItems:'center',gap:'8px'}}><ShieldCheck size={16}/> Owner message control</h2>
        <p className="sub" style={{marginTop:'6px'}}>Only the owner can send messages to staff. Messages are shop-wide — use for shift notes, payment reminders and stock alerts. Employees can read messages but cannot send or reply.</p>
      </div>
    </div>
  );
}

function StaffSalesModal({employee,sales,onClose,onViewInvoice,onViewReceipt}){
  const empSales = sales.filter(s=>s.cashierId===employee.id || s.cashier===employee.name);
  const total = empSales.reduce((s,x)=>s+Number(x.total||0),0);
  const items = empSales.reduce((s,x)=>s+Number(x.itemCount||0),0);
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal wide"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#dbeafe',color:'#1e40af',display:'grid',placeItems:'center'}}><FileText size={18}/></div><div><h3>{employee.name} — sales history</h3><p>Every sale recorded by this employee · combined to owner</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <div className="modal-body">
          <div className="kpi-row">
            <span className="kpi"><FileText size={14}/> <b>{empSales.length}</b> invoices</span>
            <span className="kpi"><Wallet size={14}/> <b>{format(total)}</b> total</span>
            <span className="kpi"><Package size={14}/> <b>{items}</b> items sold</span>
            <button className="btn small" style={{marginLeft:'auto'}} onClick={()=>{ const header=['Invoice','Date','Time','Customer','Payment','Items','Total']; const rows=empSales.map(s=>[s.invoiceNumber,s.date,s.time,s.customerName,s.payment,s.itemCount,s.total]); const csv=[header,...rows].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); const a=document.createElement('a'); a.href=url; a.download=`sales-${employee.name.replaceAll(' ','-')}-${todayKey()}.csv`; a.click(); URL.revokeObjectURL(url)}}><Download size={12}/> Export CSV</button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>DATE</th><th>CUSTOMER</th><th>PAYMENT</th><th>ITEMS</th><th>TOTAL</th><th></th></tr></thead><tbody>
            {empSales.map(s=>(
              <tr key={s.id}>
                <td><b style={{color:'#0f766e',fontSize:'12px'}}>{s.invoiceNumber}</b></td>
                <td><b style={{fontSize:'12px'}}>{s.date===todayKey()?'Today':readableDate(s.date)}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{s.time}</small></td>
                <td>{s.customerName}</td>
                <td><span className={`badge-pay ${s.payment.toLowerCase()}`}>{s.payment}</span></td>
                <td>{s.itemCount}</td>
                <td><b>{format(s.total)}</b></td>
                <td><div style={{display:'flex',gap:'4px'}}><button className="btn small" onClick={()=>onViewInvoice(s)}><Eye size={12}/> View</button><button className="btn small" onClick={()=>onViewReceipt(s)}><Receipt size={12}/> Receipt</button></div></td>
              </tr>
            ))}
          </tbody></table></div>
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
      <div className="page-head"><div><div className="eyebrow"><Coins size={12}/> EXPENSES</div><h1>Expenses & business spending</h1><p>Record rent, utilities, supplies, transport and more. Expenses feed into business reports so net profit is accurate.</p></div><button className="btn primary" onClick={onAdd}><Plus size={16}/> Record expense</button></div>
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
            <div className="search" style={{maxWidth:'320px'}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search note, category, staff…"/></div>
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
          </tbody></table></div>
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

function ProductModal({product,categories,onClose,onSave}){
  const [form,setForm]=useState(product||{name:'',sku:'',category:categories[0]||'Groceries',brand:'',price:'',cost:'',stock:'',barcode:'',supplier:'',lowStockAt:5});
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
      color: product?.color||['mint','peach','blue','violet'][Math.floor(Math.random()*4)],
    };
    onSave(p);
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#e6f4f1',color:'#0f766e',display:'grid',placeItems:'center'}}><Package size={18}/></div><div><h3>{product?'Edit item':'Add item'}</h3><p>Item list — owner controls inventory</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Product name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Paracetamol 500mg" required/></div>
          <div className="two"><div className="field"><label>Category *</label><select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></div><div className="field"><label>Brand / size</label><input value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="e.g. 5kg"/></div></div>
          <div className="two"><div className="field"><label>Selling price (GH₵) *</label><input type="number" step="0.01" min="0" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required/></div><div className="field"><label>Cost price (for profit)</label><input type="number" step="0.01" min="0" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="0"/></div></div>
          <div className="two"><div className="field"><label>Stock quantity *</label><input type="number" min="0" step="1" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))} required/></div><div className="field"><label>Reorder level (low stock alert at)</label><input type="number" min="0" step="1" value={form.lowStockAt??5} onChange={e=>setForm(f=>({...f,lowStockAt:e.target.value}))}/></div></div>
          <div className="two"><div className="field"><label>SKU</label><input value={form.sku} onChange={e=>setForm(f=>({...f,sku:e.target.value}))} placeholder="Auto if empty"/></div><div className="field"><label>Supplier (optional)</label><input value={form.supplier||''} onChange={e=>setForm(f=>({...f,supplier:e.target.value}))} placeholder="e.g. Royal Farms"/></div></div>
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

function EmployeeModal({employee,onClose,onSave}){
  const [form,setForm]=useState(employee||{name:'',role:'cashier',phone:'',email:'',shift:'08:00-16:00',status:'On shift',salary:1500});
  const submit=(e)=>{
    e.preventDefault();
    if(!form.name.trim()) return;
    onSave({id:employee?.id||uid('e'), name:form.name.trim(), role:form.role, phone:form.phone.trim(), email:form.email.trim(), shift:form.shift, status:form.status, salary:Number(form.salary||0), initials:initials(form.name)});
  };
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="modal"><div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#ede9fe',color:'#5b21b6',display:'grid',placeItems:'center'}}><UserCircle size={18}/></div><div><h3>{employee?'Edit staff account':'Create staff account'}</h3><p>Only the owner can create employee accounts</p></div><button className="btn icon small" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
        <form onSubmit={submit}><div className="modal-body">
          <div className="field"><label>Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/></div>
          <div className="two"><div className="field"><label>Role</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}><option value="cashier">Cashier</option><option value="owner">Owner</option></select></div><div className="field"><label>Shift</label><input value={form.shift} onChange={e=>setForm(f=>({...f,shift:e.target.value}))}/></div></div>
          <div className="two"><div className="field"><label>Phone</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div><div className="field"><label>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div></div>
          <div className="two"><div className="field"><label>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option>On shift</option><option>Off duty</option><option>On leave</option></select></div><div className="field"><label>Salary (GH₵)</label><input type="number" value={form.salary} onChange={e=>setForm(f=>({...f,salary:e.target.value}))}/></div></div>
        </div><div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary"><Check size={14}/>{employee?'Save':'Create staff account'}</button></div></form>
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

function PaymentModal({cart,subtotal,discount,total,customer,giftCards,onClose,onComplete}){
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
        <div className="modal-head"><div style={{width:'36px',height:'36px',borderRadius:'9px',background:'#0f2320',color:'#fff',display:'grid',placeItems:'center'}}><Wallet size={18}/></div><div><h3>Complete sale — {method}</h3><p>{customer.name} · {format(total)} · {cart.length} items · Combined to owner</p></div><button className="btn icon small no-print" style={{marginLeft:'auto'}} onClick={onClose}><X size={14}/></button></div>
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
              <small style={{fontSize:'11px',color:'#6b7d76'}}>Cash sales combine directly to owner cash account.</small>
            </div>
          )}
          {method==='MoMo' && (
            <div className="pay-detail">
              <b><Smartphone size={14}/> MoMo payment</b>
              <div className="two"><div className="field"><label>MoMo phone *</label><input value={momoPhone} onChange={e=>setMomoPhone(e.target.value)} placeholder="0244..."/></div><div className="field"><label>Transaction ID</label><input value={momoTxn} onChange={e=>setMomoTxn(e.target.value)} placeholder="Auto if empty"/></div></div>
              <small style={{fontSize:'11px',color:'#6b7d76'}}>Mobile Money sales combine to owner MoMo account.</small>
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

function InvoiceModal({sale,onClose,onPrintReceipt}){
  const subtotal = sale.subtotal||sale.total;
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="invoice"><div className="invoice-head"><div style={{display:'flex',alignItems:'center',gap:'10px'}}><div className="brand-mark" style={{width:'32px',height:'32px',fontSize:'14px'}}>P</div><div><b>{SHOP.name}</b><small style={{display:'block',fontSize:'11px',color:'#6b7d76'}}>{SHOP.address} · Tel {SHOP.phone} · Customer Invoice</small></div></div><button className="btn icon small no-print" onClick={onClose}><X size={14}/></button></div>
        <div className="invoice-body">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><span style={{fontSize:'10px',fontWeight:800,letterSpacing:'1px',color:'#0f766e'}}>PAID INVOICE</span><h2 style={{margin:'4px 0',fontSize:'20px',fontWeight:900}}>{sale.invoiceNumber}</h2><small style={{color:'#6b7d76'}}>{readableDate(sale.date)} at {sale.time}</small></div><span className="status ok"><i/> Paid · {sale.payment}</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',margin:'14px 0',padding:'10px',background:'#f9fbf9',border:'1px solid #e7ece8',borderRadius:'8px',fontSize:'11px'}}><div><small style={{color:'#6b7d76',fontWeight:700}}>BILL TO</small><b style={{display:'block'}}>{sale.customerName}</b></div><div><small style={{color:'#6b7d76',fontWeight:700}}>SELLER NAME</small><b style={{display:'block'}}>{sale.cashier}</b></div><div><small style={{color:'#6b7d76',fontWeight:700}}>PAYMENT</small><b style={{display:'block'}}>{sale.payment} {sale.paymentDetail?.phone||sale.paymentDetail?.code||''}</b></div></div>
          <div className="invoice-line head"><span>PRODUCT</span><span>QTY</span><span>UNIT</span><span>TOTAL</span></div>
          {sale.items?.map((it,i)=><div key={i} className="invoice-line"><span>{it.name}</span><span>{it.qty}</span><span>{format(it.unitPrice)}</span><span>{format(it.lineTotal)}</span></div>)}
          <div className="invoice-tot"><div><span>Subtotal</span><b>{format(subtotal)}</b></div>{sale.discount>0 && <div><span>Discount</span><b>-{format(sale.discount)}</b></div>}<div className="grand"><span>Total paid</span><b>{format(sale.total)}</b></div></div>
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid #e7ece8',background:'#fcfdfc',display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'11px',color:'#6b7d76',display:'flex',alignItems:'center',gap:'5px'}}><ShieldCheck size={12}/> Thank you for shopping with {SHOP.name}!</span><div style={{display:'flex',gap:'6px'}}><button className="btn small no-print" onClick={()=>onPrintReceipt(sale)}><Printer size={14}/> Print receipt</button><button className="btn small primary no-print" onClick={()=>window.print()}><Printer size={14}/> Print invoice</button></div></div>
      </div>
    </div>
  );
}

function ReceiptModal({sale,onClose}){
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget) onClose()}}>
      <div className="receipt"><button className="btn icon small no-print" style={{float:'right'}} onClick={onClose}><X size={14}/></button>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',paddingBottom:'10px',borderBottom:'1px dashed #e7ece8'}}><div className="brand-mark" style={{width:'28px',height:'28px',fontSize:'12px'}}>P</div><div><b style={{fontSize:'12px'}}>{SHOP.name}</b><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>{SHOP.address}</small><small style={{display:'block',fontSize:'10px',color:'#6b7d76'}}>Tel: {SHOP.phone}</small></div></div>
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
        <div style={{textAlign:'center',marginTop:'12px'}}><small>Thank you for shopping with {SHOP.name}!</small><br/><small>Sale ref {sale.id}</small><br/><button className="btn small primary no-print" style={{marginTop:'8px'}} onClick={()=>window.print()}><Printer size={14}/> Print receipt</button></div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
