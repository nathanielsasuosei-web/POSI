import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Barcode, Bell, Box, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, CreditCard, LayoutDashboard, LogOut, Menu, Minus, Package, Plus, Pill, Printer, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Stethoscope, Trash2, TrendingUp, UserRound, Users, Wallet, X } from 'lucide-react';
import './style.css';

const products = [
  { id: 1, name: 'Paracetamol 500mg', brand: 'Paracetamol · 20 tablets', price: 12.5, stock: 48, category: 'Pain relief', color: 'mint', icon: 'pill', expiry: 'Nov 2027' },
  { id: 2, name: 'Vitamin C 1000mg', brand: 'NutriLife · 30 tablets', price: 38, stock: 24, category: 'Vitamins', color: 'peach', icon: 'sun', expiry: 'Aug 2027' },
  { id: 3, name: 'Cetirizine 10mg', brand: 'AllerFree · 10 tablets', price: 18, stock: 6, category: 'Allergy', color: 'lavender', icon: 'drop', expiry: 'Jan 2027' },
  { id: 4, name: 'Amoxicillin 500mg', brand: 'AmoxiCare · 21 capsules', price: 42, stock: 15, category: 'Antibiotics', color: 'blue', icon: 'capsule', expiry: 'Jun 2027', rx: true },
  { id: 5, name: 'Ibuprofen 400mg', brand: 'IbuRelief · 20 tablets', price: 16, stock: 32, category: 'Pain relief', color: 'peach', icon: 'pill', expiry: 'Mar 2028' },
  { id: 6, name: 'Zinc 20mg', brand: 'Wellness+ · 30 tablets', price: 27.5, stock: 3, category: 'Vitamins', color: 'mint', icon: 'sun', expiry: 'Sep 2026' },
  { id: 7, name: 'Cough Syrup', brand: 'Tussin · 100ml', price: 32, stock: 18, category: 'Cold & flu', color: 'blue', icon: 'bottle', expiry: 'Dec 2027' },
  { id: 8, name: 'ORS Sachets', brand: 'Rehydra · 4 sachets', price: 8, stock: 57, category: 'First aid', color: 'lavender', icon: 'plus', expiry: 'May 2028' },
  { id: 9, name: 'Omeprazole 20mg', brand: 'Omez · 14 capsules', price: 25, stock: 21, category: 'Digestive', color: 'peach', icon: 'capsule', expiry: 'Jul 2027' },
  { id: 10, name: 'Hand Sanitizer', brand: 'PureGuard · 250ml', price: 22, stock: 12, category: 'Personal care', color: 'mint', icon: 'drop', expiry: 'Feb 2028' },
  { id: 11, name: 'Loratadine 10mg', brand: 'Clarity · 10 tablets', price: 20, stock: 8, category: 'Allergy', color: 'lavender', icon: 'pill', expiry: 'Oct 2027' },
  { id: 12, name: 'Multivitamin', brand: 'DailyCare · 30 tablets', price: 55, stock: 19, category: 'Vitamins', color: 'blue', icon: 'sun', expiry: 'Apr 2028' },
];
const categories = ['All products', 'Pain relief', 'Vitamins', 'Allergy', 'Cold & flu', 'Antibiotics', 'First aid', 'Digestive', 'Personal care'];
const format = n => `GH₵ ${n.toFixed(2)}`;

function ProductArt({ product }) {
  const Icon = product.icon === 'capsule' ? Pill : product.icon === 'bottle' ? Activity : product.icon === 'drop' ? Sparkles : product.icon === 'plus' ? Plus : product.icon === 'sun' ? Sparkles : Pill;
  return <div className={`product-art ${product.color}`}><Icon size={27} strokeWidth={1.7} /><span>{product.icon === 'bottle' ? '100ml' : product.icon === 'plus' ? 'ORS' : 'Rx'}</span></div>;
}
function App() {
  const [cart, setCart] = useState([{...products[0], qty: 2}, {...products[1], qty: 1}, {...products[7], qty: 2}]);
  const [category, setCategory] = useState('All products');
  const [search, setSearch] = useState('');
  const [activeNav, setActiveNav] = useState('Point of sale');
  const [payment, setPayment] = useState('Cash');
  const [showPay, setShowPay] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileCart, setMobileCart] = useState(false);
  const [customer, setCustomer] = useState('Walk-in customer');
  const [discount, setDiscount] = useState(false);
  const visibleProducts = useMemo(() => products.filter(p => (category === 'All products' || p.category === category) && `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(search.toLowerCase())), [category, search]);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal * (discount ? 0.9 : 1);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  const add = product => { setCart(prev => { const found = prev.find(i => i.id === product.id); return found ? prev.map(i => i.id === product.id ? {...i, qty: Math.min(i.qty + 1, i.stock)} : i) : [...prev, {...product, qty: 1}]; }); setNotice(`${product.name} added to sale`); setTimeout(() => setNotice(''), 1800); };
  const updateQty = (id, change) => setCart(prev => prev.map(i => i.id === id ? {...i, qty: i.qty + change} : i).filter(i => i.qty > 0));
  const checkout = () => { setShowPay(false); setShowSuccess(true); setCart([]); setTimeout(() => setShowSuccess(false), 4500); };
  const selectNav = name => { setActiveNav(name); if (name !== 'Point of sale') { setNotice(`${name} workspace coming soon`); setTimeout(() => setNotice(''), 2200); } };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Plus size={21} strokeWidth={3}/></div><div className="brand-copy"><b>posi<span>.</span></b><small>PHARMACY SUITE</small></div></div>
      <div className="store-select"><div className="store-icon"><Pill size={17}/></div><div><b>Green Cross Pharmacy</b><small>Accra, Ghana</small></div><ChevronDown size={15} className="store-chevron"/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav-list">
        {[['Point of sale', ShoppingCart], ['Dashboard', LayoutDashboard], ['Inventory', Package], ['Sales', TrendingUp], ['Customers', Users]].map(([name, Icon]) => <button key={name} className={`nav-item ${activeNav === name ? 'selected' : ''}`} onClick={() => selectNav(name)}><Icon size={18}/><span>{name}</span>{name === 'Inventory' && <span className="nav-count">3</span>}</button>)}
      </nav>
      <div className="nav-label tools-label">MANAGE</div>
      <nav className="nav-list"><button className="nav-item" onClick={() => selectNav('Reports')}><Activity size={18}/><span>Reports</span></button><button className="nav-item" onClick={() => selectNav('Settings')}><Settings size={18}/><span>Settings</span></button></nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17}/></div><b>Need a hand?</b><p>Visit our help centre for tips and guides.</p><button onClick={() => setNotice('Help centre opened in a new tab')}>Visit help centre <ArrowRight size={13}/></button></div><div className="profile"><div className="avatar">AM</div><div className="profile-info"><b>Abena Mensah</b><small>Pharmacist · Admin</small></div><MoreIcon/></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu"><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><b>{activeNav}</b></div><div className="top-actions"><div className="today"><Clock3 size={15}/><span>Tuesday, 15 October 2026</span></div><button className="icon-button alert-button" aria-label="Notifications" onClick={() => setNotice('You’re all caught up')}><Bell size={18}/><i/></button><div className="top-divider"/><div className="staff"><div className="avatar small-avatar">AM</div><span>Abena</span><ChevronDown size={14}/></div></div></header>
      <div className="page-content">
        <section className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> STORE OPEN <span className="eyebrow-sep">·</span> SHIFT 08:00 — 17:00</div><h1>Point of sale</h1><p className="subheading">A good day to care for your community.</p></div><div className="sales-summary"><div className="sales-icon"><Wallet size={18}/></div><div><small>Today’s sales</small><b>GH₵ 2,485.50</b></div><span className="trend"><ArrowUpRight size={13}/> 12.8%</span></div></section>
        <div className="pos-layout">
          <section className="catalog-panel">
            <div className="catalog-heading"><div><h2>New sale <span className="sale-dot"/></h2><p>Find a product or scan a barcode to get started.</p></div><button className="scan-button" onClick={() => setNotice('Barcode scanner ready')}><Barcode size={17}/> <span>Scan barcode</span></button></div>
            <div className="search-line"><div className="search-box"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name, brand or barcode..."/><kbd>⌘ K</kbd></div><button className="filter-button" onClick={() => {setCategory('All products'); setSearch('');}}><SlidersHorizontal size={17}/><span>Filters</span></button></div>
            <div className="category-scroll">{categories.map(c => <button key={c} className={`category-chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}{c === 'All products' && <span className="all-count">12</span>}</button>)}</div>
            <div className="results-meta"><span>{visibleProducts.length} products</span><button onClick={() => setNotice('Products sorted by popularity')}>Popular first <ChevronDown size={14}/></button></div>
            <div className="product-grid">{visibleProducts.map(product => <button key={product.id} className="product-card" onClick={() => add(product)} disabled={product.stock === 0}>
              <div className="card-art-row"><ProductArt product={product}/><span className={`stock-pill ${product.stock < 10 ? 'low-stock' : ''}`}><i/>{product.stock < 10 ? `${product.stock} left` : 'In stock'}</span></div>
              <div className="product-name-row"><div><b>{product.name}</b><small>{product.brand}</small></div><div className="add-circle"><Plus size={15}/></div></div>
              <div className="product-bottom"><strong>{format(product.price)}</strong>{product.rx && <span className="rx-label"><ShieldCheck size={12}/> Rx</span>}</div>
            </button>)}</div>
            {visibleProducts.length === 0 && <div className="empty-products"><Search size={25}/><b>No products found</b><span>Try another search or category.</span></div>}
            <div className="catalog-footer"><span>Showing {visibleProducts.length} of 248 products</span><div><button disabled><ChevronLeft size={15}/></button><b>1</b><button onClick={() => setNotice('You’re viewing the first page')}><ChevronRight size={15}/></button></div></div>
          </section>
          <aside className={`cart-panel ${mobileCart ? 'mobile-open' : ''}`}>
            <div className="cart-header"><div><h2>Current sale <span className="sale-count">{count}</span></h2><p>Sale #POS-02489 <span>·</span> Just now</p></div><button className="clear-button" onClick={() => setCart([])} disabled={!cart.length}>Clear all</button><button className="mobile-close" onClick={() => setMobileCart(false)}><X size={19}/></button></div>
            <div className="customer-select"><div className="customer-avatar"><UserRound size={16}/></div><select value={customer} onChange={e => setCustomer(e.target.value)}><option>Walk-in customer</option><option>Akosua Boateng</option><option>Kwame Owusu</option><option>New customer...</option></select><ChevronDown size={15}/></div>
            <div className="cart-list">{cart.length ? cart.map(item => <div className="cart-item" key={item.id}><ProductArt product={item}/><div className="cart-item-info"><b>{item.name}</b><small>{format(item.price)} <span>·</span> {item.brand.split('·')[1]?.trim()}</small><div className="quantity"><button onClick={() => updateQty(item.id, -1)} aria-label="Decrease quantity"><Minus size={13}/></button><span>{item.qty}</span><button onClick={() => updateQty(item.id, 1)} disabled={item.qty >= item.stock} aria-label="Increase quantity"><Plus size={13}/></button></div></div><div className="cart-price"><b>{format(item.price * item.qty)}</b><button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} aria-label="Remove item"><Trash2 size={14}/></button></div></div>) : <div className="empty-cart"><div className="empty-cart-icon"><ShoppingBag size={22}/></div><b>Your sale is empty</b><span>Add products from the catalogue to begin.</span></div>}</div>
            <button className={`discount-row ${discount ? 'discount-on' : ''}`} onClick={() => setDiscount(!discount)}><span className="discount-left"><span className="discount-icon">%</span><span><b>Apply discount</b><small>{discount ? '10% discount applied' : 'Add a discount to this sale'}</small></span></span><span className={`switch ${discount ? 'on' : ''}`}><i/></span></button>
            <div className="totals"><div><span>Subtotal</span><b>{format(subtotal)}</b></div>{discount && <div className="discount-total"><span>Discount (10%)</span><b>− {format(subtotal * 0.1)}</b></div>}<div className="tax-line"><span>Tax <small>(included)</small></span><b>{format(total - total / 1.15)}</b></div><div className="total-row"><span>Total due</span><b>{format(total)}</b></div></div>
            <div className="payment-label">PAYMENT METHOD</div><div className="payment-options"><button className={payment === 'Cash' ? 'pay-active' : ''} onClick={() => setPayment('Cash')}><Wallet size={17}/>Cash</button><button className={payment === 'Mobile Money' ? 'pay-active' : ''} onClick={() => setPayment('Mobile Money')}><Activity size={17}/>MoMo</button><button className={payment === 'Card' ? 'pay-active' : ''} onClick={() => setPayment('Card')}><CreditCard size={17}/>Card</button></div>
            <button className="checkout-button" disabled={!cart.length} onClick={() => setShowPay(true)}><span>Charge {format(total)}</span><ArrowRight size={18}/></button><div className="secure-note"><ShieldCheck size={13}/> Secure, encrypted transaction</div>
          </aside>
        </div>
      </div>
      <button className="mobile-cart-fab" onClick={() => setMobileCart(true)}><ShoppingCart size={18}/> View sale <span>{count}</span></button>
    </main>
    {notice && <div className="toast"><CheckCircle2 size={17}/>{notice}</div>}
    {showPay && <div className="modal-backdrop" onClick={() => setShowPay(false)}><div className="checkout-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setShowPay(false)}><X size={19}/></button><div className="modal-icon"><Wallet size={24}/></div><div className="modal-eyebrow">COMPLETE SALE</div><h2>Collect payment</h2><p>Confirm you’ve received payment from {customer.toLowerCase()}.</p><div className="modal-amount"><span>Amount due</span><b>{format(total)}</b></div><div className="modal-method"><span>Payment method</span><strong>{payment === 'Mobile Money' ? 'Mobile Money (MoMo)' : payment}</strong></div><button className="confirm-button" onClick={checkout}><Check size={17}/> Confirm payment</button><div className="modal-secure"><ShieldCheck size={13}/> Sale will be recorded in your reports</div></div></div>}
    {showSuccess && <div className="success-toast"><div><Check size={17}/></div><span><b>Sale completed!</b><small>Payment received · Receipt ready to print</small></span><button onClick={() => setShowSuccess(false)}><Printer size={17}/> Receipt</button><button className="success-x" onClick={() => setShowSuccess(false)}><X size={16}/></button></div>}
  </div>;
}
function MoreIcon(){return <button className="more-button" aria-label="More options"><span/><span/><span/></button>}

createRoot(document.getElementById('root')).render(<App/>);
