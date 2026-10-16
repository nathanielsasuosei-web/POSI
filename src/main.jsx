import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Barcode,
  Camera, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3,
  CreditCard, ImagePlus, LayoutDashboard, LogOut, Minus, Package, PackagePlus,
  Pill, Plus, Printer, Search, ShieldCheck, ShoppingBag, ShoppingCart,
  SlidersHorizontal, Sparkles, TrendingUp, UserRound, Users, Wallet, X,
} from 'lucide-react';
import './style.css';

const PRODUCT_STORAGE_KEY = 'posi-v2-products';
const SALES_STORAGE_KEY = 'posi-v2-sales';
const ACTIVITY_STORAGE_KEY = 'posi-v2-activity';
const categories = ['Pain relief', 'Vitamins', 'Allergy', 'Cold & flu', 'Antibiotics', 'First aid', 'Digestive', 'Personal care', 'Other'];
const format = amount => `GH₵ ${Number(amount || 0).toFixed(2)}`;
const readSessionValue = key => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const readSessionRole = () => {
  const role = readSessionValue('posi-session-role');
  return role === 'owner' || role === 'cashier' ? role : null;
};
const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const shortTime = date => date.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
const displayDate = date => date.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const starterProducts = [
  { id: 'sample-1', name: 'Paracetamol 500mg', brand: 'Paracetamol · 20 tablets', price: 12.5, stock: 48, category: 'Pain relief', color: 'mint', icon: 'pill', expiry: '2027-11', barcode: '', rx: false },
  { id: 'sample-2', name: 'Vitamin C 1000mg', brand: 'NutriLife · 30 tablets', price: 38, stock: 24, category: 'Vitamins', color: 'peach', icon: 'sun', expiry: '2027-08', barcode: '', rx: false },
  { id: 'sample-3', name: 'Cetirizine 10mg', brand: 'AllerFree · 10 tablets', price: 18, stock: 6, category: 'Allergy', color: 'lavender', icon: 'drop', expiry: '2027-01', barcode: '', rx: false },
  { id: 'sample-4', name: 'Amoxicillin 500mg', brand: 'AmoxiCare · 21 capsules', price: 42, stock: 15, category: 'Antibiotics', color: 'blue', icon: 'capsule', expiry: '2027-06', barcode: '', rx: true },
  { id: 'sample-5', name: 'Ibuprofen 400mg', brand: 'IbuRelief · 20 tablets', price: 16, stock: 32, category: 'Pain relief', color: 'peach', icon: 'pill', expiry: '2028-03', barcode: '', rx: false },
  { id: 'sample-6', name: 'Zinc 20mg', brand: 'Wellness+ · 30 tablets', price: 27.5, stock: 3, category: 'Vitamins', color: 'mint', icon: 'sun', expiry: '2027-09', barcode: '', rx: false },
  { id: 'sample-7', name: 'Cough Syrup', brand: 'Tussin · 100ml', price: 32, stock: 18, category: 'Cold & flu', color: 'blue', icon: 'bottle', expiry: '2027-12', barcode: '', rx: false },
  { id: 'sample-8', name: 'ORS Sachets', brand: 'Rehydra · 4 sachets', price: 8, stock: 57, category: 'First aid', color: 'lavender', icon: 'plus', expiry: '2028-05', barcode: '', rx: false },
  { id: 'sample-9', name: 'Omeprazole 20mg', brand: 'Omez · 14 capsules', price: 25, stock: 21, category: 'Digestive', color: 'peach', icon: 'capsule', expiry: '2027-07', barcode: '', rx: false },
  { id: 'sample-10', name: 'Hand Sanitizer', brand: 'PureGuard · 250ml', price: 22, stock: 12, category: 'Personal care', color: 'mint', icon: 'drop', expiry: '2028-02', barcode: '', rx: false },
  { id: 'sample-11', name: 'Loratadine 10mg', brand: 'Clarity · 10 tablets', price: 20, stock: 8, category: 'Allergy', color: 'lavender', icon: 'pill', expiry: '2027-10', barcode: '', rx: false },
  { id: 'sample-12', name: 'Multivitamin', brand: 'DailyCare · 30 tablets', price: 55, stock: 19, category: 'Vitamins', color: 'blue', icon: 'sun', expiry: '2028-04', barcode: '', rx: false },
];

const makeStarterSales = () => {
  const today = localDateKey();
  return [
    { id: 'POS-02487', date: today, time: '10:42', cashier: 'Ama Boateng', customer: 'Walk-in customer', total: 156.5, itemCount: 4, payment: 'Cash' },
    { id: 'POS-02486', date: today, time: '10:31', cashier: 'Kwame Owusu', customer: 'Akosua Boateng', total: 86.5, itemCount: 3, payment: 'Mobile Money' },
    { id: 'POS-02485', date: today, time: '09:55', cashier: 'Ama Boateng', customer: 'Walk-in customer', total: 56, itemCount: 2, payment: 'Card' },
    { id: 'POS-02484', date: today, time: '09:18', cashier: 'Kwame Owusu', customer: 'Walk-in customer', total: 42, itemCount: 1, payment: 'Cash' },
  ];
};
const starterActivity = [
  { id: 'activity-demo-1', type: 'sale', title: 'Ama Boateng completed a sale', detail: 'GH₵ 156.50 · Cash', time: '10:42' },
  { id: 'activity-demo-2', type: 'sale', title: 'Kwame Owusu completed a sale', detail: 'GH₵ 86.50 · Mobile Money', time: '10:31' },
  { id: 'activity-demo-3', type: 'product', title: 'Ama Boateng added a product', detail: 'Vitamin C 1000mg · 18 units', time: '10:08' },
  { id: 'activity-demo-4', type: 'sale', title: 'Kwame Owusu completed a sale', detail: 'GH₵ 42.00 · Cash', time: '09:18' },
];
const cashiers = [
  { name: 'Ama Boateng', initials: 'AB', title: 'Cashier', shift: '08:00 – 16:00', status: 'On shift' },
  { name: 'Kwame Owusu', initials: 'KO', title: 'Senior cashier', shift: '09:00 – 17:00', status: 'On shift' },
];

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      setSaveError('');
    } catch {
      setSaveError('This browser is running low on storage. Try removing a product photo.');
    }
  }, [key, value]);
  return [value, setValue, saveError];
}

function ProductVisual({ product, small = false }) {
  const Icon = product.icon === 'bottle' ? Activity : product.icon === 'drop' ? Sparkles : product.icon === 'plus' ? Plus : product.icon === 'sun' ? Sparkles : Pill;
  return (
    <div className={`product-visual ${product.color || 'mint'} ${small ? 'product-visual-small' : ''}`}>
      {product.image ? <img src={product.image} alt={`${product.name} product`} /> : <>
        <Icon size={small ? 20 : 25} strokeWidth={1.65} />
        <span>{product.icon === 'bottle' ? '100ml' : product.icon === 'plus' ? 'ORS' : 'Rx'}</span>
      </>}
    </div>
  );
}

function App() {
  const [products, setProducts, productSaveError] = usePersistentState(PRODUCT_STORAGE_KEY, starterProducts);
  const [sales, setSales, salesSaveError] = usePersistentState(SALES_STORAGE_KEY, makeStarterSales());
  const [activities, setActivities, activitySaveError] = usePersistentState(ACTIVITY_STORAGE_KEY, starterActivity);
  const [role, setRole] = useState(readSessionRole);
  const [cashierName, setCashierName] = useState(() => readSessionValue('posi-session-cashier') || cashiers[0].name);
  const [activeView, setActiveView] = useState(() => readSessionRole() === 'cashier' ? 'Point of sale' : 'Dashboard');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All products');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState('All products');
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState('Cash');
  const [customer, setCustomer] = useState('Walk-in customer');
  const [discount, setDiscount] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mobileCart, setMobileCart] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);

  const currentStaff = role === 'owner'
    ? { name: 'Abena Mensah', initials: 'AM', title: 'Store owner' }
    : cashiers.find(cashier => cashier.name === cashierName) || cashiers[0];
  const currentDate = new Date();
  const todayKey = localDateKey(currentDate);
  const todaySales = useMemo(() => sales.filter(sale => sale.date === todayKey), [sales, todayKey]);
  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const lowStockProducts = products.filter(product => Number(product.stock) <= 5);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal * (discount ? 0.9 : 1);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const visibleProducts = useMemo(() => products.filter(product => {
    const matchesCategory = category === 'All products' || product.category === category;
    const searchText = `${product.name} ${product.brand || ''} ${product.category || ''} ${product.barcode || ''}`.toLowerCase();
    return matchesCategory && searchText.includes(search.toLowerCase().trim());
  }), [products, category, search]);
  const visibleInventory = useMemo(() => products.filter(product => {
    const matchesCategory = inventoryCategory === 'All products' || product.category === inventoryCategory;
    const searchText = `${product.name} ${product.brand || ''} ${product.category || ''} ${product.barcode || ''}`.toLowerCase();
    return matchesCategory && searchText.includes(inventorySearch.toLowerCase().trim());
  }), [products, inventoryCategory, inventorySearch]);
  const storageError = productSaveError || salesSaveError || activitySaveError;

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const flash = message => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2600);
  };

  const signIn = (nextRole, nextCashier = cashiers[0].name) => {
    try {
      window.sessionStorage.setItem('posi-session-role', nextRole);
      window.sessionStorage.setItem('posi-session-cashier', nextCashier);
    } catch {
      // The demo can still be used if session storage is unavailable.
    }
    setRole(nextRole);
    setCashierName(nextCashier);
    setActiveView(nextRole === 'owner' ? 'Dashboard' : 'Point of sale');
  };

  const signOut = () => {
    try {
      window.sessionStorage.removeItem('posi-session-role');
      window.sessionStorage.removeItem('posi-session-cashier');
    } catch {
      // Sign out still clears the in-memory demo session.
    }
    setRole(null);
    setActiveView('Dashboard');
    setCart([]);
    setShowPay(false);
    setShowProductModal(false);
    setShowAssistant(false);
    setEditingProduct(null);
    setMobileCart(false);
    setShowSuccess(false);
  };

  const addActivity = activity => {
    setActivities(previous => [{ id: `activity-${Date.now()}`, ...activity }, ...previous].slice(0, 30));
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const saveProduct = product => {
    const isEditing = Boolean(editingProduct);
    if (isEditing) {
      setProducts(previous => previous.map(item => item.id === product.id ? product : item));
      addActivity({ type: 'product', title: `${currentStaff.name} updated a product`, detail: product.name, time: shortTime(new Date()) });
      flash(`${product.name} updated in inventory.`);
    } else {
      setProducts(previous => [product, ...previous]);
      addActivity({ type: 'product', title: `${currentStaff.name} added a product`, detail: `${product.name} · ${product.stock} units`, time: shortTime(new Date()) });
      flash(`${product.name} saved to inventory.`);
    }
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const addToCart = product => {
    if (product.stock < 1) {
      flash(`${product.name} is out of stock.`);
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing && existing.qty >= product.stock) {
      flash(`Only ${product.stock} ${product.name} available.`);
      return;
    }
    setCart(previous => existing
      ? previous.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      : [...previous, { ...product, qty: 1 }]);
    flash(`${product.name} added to sale.`);
  };

  const updateQuantity = (id, change) => {
    setCart(previous => previous.map(item => {
      if (item.id !== id) return item;
      const product = products.find(entry => entry.id === id);
      return { ...item, qty: Math.max(0, Math.min(item.qty + change, product?.stock ?? item.stock)) };
    }).filter(item => item.qty > 0));
  };

  const completeSale = () => {
    const sale = {
      id: `POS-${String(Date.now()).slice(-6)}`,
      date: localDateKey(),
      time: shortTime(new Date()),
      cashier: currentStaff.name,
      customer,
      total: Number(total.toFixed(2)),
      itemCount,
      payment,
    };
    setSales(previous => [sale, ...previous]);
    setProducts(previous => previous.map(product => {
      const sold = cart.find(item => item.id === product.id);
      return sold ? { ...product, stock: Math.max(0, product.stock - sold.qty) } : product;
    }));
    addActivity({ type: 'sale', title: `${currentStaff.name} completed a sale`, detail: `${format(total)} · ${payment}`, time: sale.time });
    setCart([]);
    setDiscount(false);
    setShowPay(false);
    setMobileCart(false);
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 6500);
  };

  const navItems = role === 'owner'
    ? [
      { label: 'Overview', view: 'Dashboard', Icon: LayoutDashboard },
      { label: 'Inventory', view: 'Inventory', Icon: Package },
      { label: 'Sales', view: 'Sales', Icon: TrendingUp },
    ]
    : [
      { label: 'Point of sale', view: 'Point of sale', Icon: ShoppingCart },
      { label: 'Inventory', view: 'Inventory', Icon: Package },
      { label: 'My sales', view: 'Sales', Icon: TrendingUp },
    ];
  const activeLabel = navItems.find(item => item.view === activeView)?.label || activeView;
  const setView = view => {
    setActiveView(view);
    setMobileCart(false);
    setShowAssistant(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderNav = (mobile = false) => navItems.map(({ label, view, Icon }) => (
    <button key={view} className={`${mobile ? 'mobile-nav-item' : 'nav-item'} ${activeView === view ? 'selected' : ''}`} onClick={() => setView(view)} aria-current={activeView === view ? 'page' : undefined}>
      <Icon size={mobile ? 18 : 18} />
      <span>{label}</span>
      {!mobile && view === 'Inventory' && lowStockProducts.length > 0 && <span className="nav-count">{lowStockProducts.length}</span>}
    </button>
  ));

  if (!role) return <LoginScreen onSignIn={signIn} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={event => { event.preventDefault(); setView(role === 'owner' ? 'Dashboard' : 'Point of sale'); }}>
          <span className="brand-mark"><Plus size={21} strokeWidth={3} /></span>
          <span className="brand-copy"><b>posi<span>.</span></b><small>PHARMACY SUITE</small></span>
        </a>
        <div className="store-card">
          <span className="store-icon"><Pill size={17} /></span>
          <span className="store-copy"><b>Green Cross Pharmacy</b><small>Accra, Ghana</small></span>
          <span className="store-status" aria-label="Store open" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">{renderNav()}</nav>
        <div className="sidebar-bottom">
          <div className="demo-note"><ShieldCheck size={15} /><span>Demo workspace<br /><b>Changes save on this device</b></span></div>
          <div className="profile-card">
            <div className={`avatar ${role === 'cashier' ? 'avatar-cashier' : ''}`}>{currentStaff.initials}</div>
            <div className="profile-copy"><b>{currentStaff.name}</b><small>{currentStaff.title}</small></div>
            <span className="profile-role">{role === 'owner' ? 'OWNER' : 'CASHIER'}</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Green Cross Pharmacy</span><ChevronRight size={14} /><b>{activeLabel}</b></div>
          <div className="top-actions">
            <span className="demo-chip"><span /> DEMO STORE</span>
            <span className="today"><Clock3 size={15} />{displayDate(currentDate)}</span>
            <div className="signed-in-user">
              <span className={`avatar ${role === 'cashier' ? 'avatar-cashier' : ''}`}>{currentStaff.initials}</span>
              <span><small>{role === 'owner' ? 'OWNER ACCOUNT' : 'CASHIER ACCOUNT'}</small><b>{currentStaff.name}</b></span>
            </div>
            <button className="logout-button" onClick={signOut} aria-label="Sign out"><LogOut size={15} /><span>Sign out</span></button>
          </div>
        </header>

        <div className="page-content">
          {storageError && <div className="storage-warning"><AlertTriangle size={16} />{storageError}</div>}
          {activeView === 'Dashboard' && role === 'owner' && <OwnerDashboard
            total={todayTotal}
            todaySales={todaySales}
            lowStockProducts={lowStockProducts}
            activities={activities}
            onViewSales={() => setView('Sales')}
            onViewInventory={() => setView('Inventory')}
          />}
          {activeView === 'Point of sale' && <section className="page-section">
            <div className="page-heading pos-page-heading">
              <div><div className="eyebrow"><span className="live-dot" />{role === 'owner' ? 'OWNER REGISTER' : 'CASHIER REGISTER'} <span className="eyebrow-sep">·</span> {currentDate.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}</div><h1>Point of sale</h1><p>Find a product, add it to the sale, and take payment.</p></div>
              <div className="shift-card"><span className="shift-icon"><Clock3 size={17} /></span><span><small>Current shift</small><b>Open · 08:00–17:00</b></span></div>
            </div>
            <div className="pos-layout">
              <section className="workspace-card catalog-panel">
                <div className="catalog-heading">
                  <div><h2>Product catalogue <span className="sale-dot" /></h2><p>{products.length} products in your shop</p></div>
                  <div className="catalog-actions">{role === 'cashier' && <button className="assistant-launch-button" onClick={() => setShowAssistant(true)}><Sparkles size={16} /><span>Stock assistant</span></button>}<button className="outline-button" onClick={() => flash('A barcode scanner is not connected in this demo.')}><Barcode size={16} /><span>Scan</span></button><button className="primary-button compact-button" onClick={openNewProduct}><Plus size={16} /><span>Add product</span></button></div>
                </div>
                <div className="search-line"><label className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, brand or barcode…" aria-label="Search products" /><kbd>⌘ K</kbd></label><button className="filter-button" onClick={() => { setCategory('All products'); setSearch(''); }} aria-label="Clear product filters"><SlidersHorizontal size={17} /><span>Reset</span></button></div>
                <div className="category-scroll" aria-label="Product categories"><button className={`category-chip ${category === 'All products' ? 'active' : ''}`} onClick={() => setCategory('All products')}>All products <span className="all-count">{products.length}</span></button>{categories.map(item => <button key={item} className={`category-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
                <div className="results-meta"><span>{visibleProducts.length} products found</span><span>Tap a product to add it to the sale</span></div>
                {visibleProducts.length > 0 ? <div className="product-grid">{visibleProducts.map(product => <button key={product.id} className="product-card" onClick={() => addToCart(product)} disabled={product.stock < 1}>
                  <div className="card-art-row"><ProductVisual product={product} /><span className={`stock-pill ${product.stock <= 5 ? 'low-stock' : ''}`}><i />{product.stock <= 5 ? `${product.stock} left` : 'In stock'}</span></div>
                  <div className="product-name-row"><span><b>{product.name}</b><small>{product.brand || product.category}</small></span><span className="add-circle"><Plus size={15} /></span></div>
                  <div className="product-bottom"><strong>{format(product.price)}</strong>{product.rx && <span className="rx-label"><ShieldCheck size={12} /> Rx</span>}</div>
                </button>)}</div> : <EmptyState icon={Search} title="No products found" detail="Try a different search, or add this product to your inventory." action="Add product" onAction={openNewProduct} />}
                <div className="catalog-footer"><span>Inventory updates when a sale is completed.</span><button onClick={() => setView('Inventory')}>Manage inventory <ArrowRight size={14} /></button></div>
              </section>

              <aside className={`workspace-card cart-panel ${mobileCart ? 'mobile-open' : ''}`}>
                <div className="cart-header"><div><h2>Current sale <span className="sale-count">{itemCount}</span></h2><p>New transaction <span>·</span> {shortTime(new Date())}</p></div><button className="clear-button" onClick={() => setCart([])} disabled={!cart.length}>Clear all</button><button className="mobile-close" onClick={() => setMobileCart(false)} aria-label="Close sale"><X size={19} /></button></div>
                <label className="customer-select"><span className="customer-avatar"><UserRound size={16} /></span><select value={customer} onChange={event => setCustomer(event.target.value)} aria-label="Select customer"><option>Walk-in customer</option><option>Akosua Boateng</option><option>Kwame Owusu</option><option>New customer</option></select><ChevronDown size={15} /></label>
                <div className="cart-list">{cart.length ? cart.map(item => <div className="cart-item" key={item.id}><ProductVisual product={item} small /><div className="cart-item-info"><b>{item.name}</b><small>{format(item.price)} <span>·</span> {item.brand || item.category}</small><div className="quantity"><button onClick={() => updateQuantity(item.id, -1)} aria-label={`Decrease ${item.name}`}><Minus size={13} /></button><span>{item.qty}</span><button onClick={() => updateQuantity(item.id, 1)} disabled={item.qty >= item.stock} aria-label={`Increase ${item.name}`}><Plus size={13} /></button></div></div><div className="cart-price"><b>{format(item.price * item.qty)}</b><button onClick={() => setCart(previous => previous.filter(entry => entry.id !== item.id))} aria-label={`Remove ${item.name}`}><X size={14} /></button></div></div>) : <div className="empty-cart"><span className="empty-cart-icon"><ShoppingBag size={22} /></span><b>Your sale is empty</b><span>Tap a product to add it here.</span></div>}</div>
                <button className={`discount-row ${discount ? 'discount-on' : ''}`} onClick={() => setDiscount(value => !value)}><span className="discount-left"><span className="discount-icon">%</span><span><b>Apply 10% discount</b><small>{discount ? 'Discount applied to this sale' : 'Optional sale discount'}</small></span></span><span className={`switch ${discount ? 'on' : ''}`}><i /></span></button>
                <div className="totals"><div><span>Subtotal</span><b>{format(subtotal)}</b></div>{discount && <div className="discount-total"><span>Discount (10%)</span><b>− {format(subtotal * 0.1)}</b></div>}<div className="tax-line"><span>Tax <small>(included)</small></span><b>{format(total - total / 1.15)}</b></div><div className="total-row"><span>Total due</span><b>{format(total)}</b></div></div>
                <div className="payment-label">PAYMENT METHOD</div><div className="payment-options"><button className={payment === 'Cash' ? 'pay-active' : ''} onClick={() => setPayment('Cash')}><Wallet size={16} />Cash</button><button className={payment === 'Mobile Money' ? 'pay-active' : ''} onClick={() => setPayment('Mobile Money')}><Activity size={16} />MoMo</button><button className={payment === 'Card' ? 'pay-active' : ''} onClick={() => setPayment('Card')}><CreditCard size={16} />Card</button></div>
                <button className="checkout-button" disabled={!cart.length} onClick={() => setShowPay(true)}><span>Charge {format(total)}</span><ArrowRight size={18} /></button><div className="secure-note"><ShieldCheck size={13} />Confirm payment to record this sale</div>
              </aside>
            </div>
          </section>}
          {activeView === 'Inventory' && <InventoryPage products={visibleInventory} totalCount={products.length} search={inventorySearch} setSearch={setInventorySearch} category={inventoryCategory} setCategory={setInventoryCategory} onAdd={openNewProduct} onEdit={product => { setEditingProduct(product); setShowProductModal(true); }} />}
          {activeView === 'Sales' && <SalesPage role={role} currentStaff={currentStaff} sales={sales} todaySales={todaySales} todayTotal={todayTotal} />}
        </div>

        {activeView === 'Point of sale' && <button className="mobile-cart-fab" onClick={() => setMobileCart(true)}><ShoppingCart size={18} /> View sale <span>{itemCount}</span><b>{format(total)}</b></button>}
        <nav className="mobile-nav" aria-label="Mobile navigation">{renderNav(true)}</nav>
      </main>

      {showProductModal && <ProductFormModal key={editingProduct?.id || 'new-product'} initialProduct={editingProduct} onClose={() => { setShowProductModal(false); setEditingProduct(null); }} onSave={saveProduct} />}
      {showAssistant && role === 'cashier' && activeView === 'Point of sale' && <StockAssistant products={products} onClose={() => setShowAssistant(false)} onAddToSale={addToCart} />}
      {showPay && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowPay(false); }}><div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="modal-close" onClick={() => setShowPay(false)} aria-label="Close payment confirmation"><X size={19} /></button><span className="modal-icon"><Wallet size={24} /></span><span className="modal-eyebrow">COMPLETE SALE</span><h2 id="checkout-title">Confirm payment</h2><p>Confirm payment from {customer.toLowerCase()} to record this transaction.</p><div className="modal-amount"><span>Amount due</span><b>{format(total)}</b></div><div className="modal-method"><span>Payment method</span><strong>{payment === 'Mobile Money' ? 'Mobile Money (MoMo)' : payment}</strong></div><button className="confirm-button" onClick={completeSale}><Check size={17} /> Confirm and record sale</button><div className="modal-secure"><ShieldCheck size={13} />The sale will appear in the owner dashboard</div></div></div>}
      {showSuccess && <div className="success-toast"><span className="success-icon"><Check size={17} /></span><span><b>Sale recorded!</b><small>Inventory and cashier activity updated.</small></span><button onClick={() => window.print()}><Printer size={16} />Receipt</button><button className="success-x" onClick={() => setShowSuccess(false)} aria-label="Dismiss"><X size={16} /></button></div>}
      {notice && <div className="toast" role="status"><CheckCircle2 size={17} />{notice}</div>}
    </div>
  );
}

const inventoryQuestionStops = new Set(['how', 'many', 'quantity', 'qty', 'stock', 'left', 'available', 'availability', 'do', 'we', 'have', 'is', 'there', 'in', 'the', 'shop', 'store', 'a', 'an', 'of', 'this', 'product', 'products', 'medicine', 'medicines', 'drug', 'drugs', 'can', 'i', 'get', 'tell', 'me', 'please', 'show', 'what', 'are', 'any', 'units', 'count', 'for', 'on', 'hand', 'and', 'with', 'at', 'price', 'much', 'each', 'it', 'that', 'those', 'these', 'find', 'check', 'got', 'some', 'got']);

function normalizeInventoryQuestion(value) {
  return value.toLowerCase()
    .replace(/(\d+)\s+(mg|ml|mcg|g|iu|tablet|tablets|capsule|capsules)\b/g, '$1$2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findStockMatches(question, products) {
  const normalized = normalizeInventoryQuestion(question);
  const tokens = [...new Set(normalized.split(' ').filter(token => token.length > 1 && !inventoryQuestionStops.has(token)))];
  if (!tokens.length) return [];

  return products.map(product => {
    const name = normalizeInventoryQuestion(product.name || '');
    const brand = normalizeInventoryQuestion(product.brand || '');
    const category = normalizeInventoryQuestion(product.category || '');
    const barcode = normalizeInventoryQuestion(product.barcode || '');
    const nameTokens = name.split(' ');
    const brandTokens = brand.split(' ');
    const categoryTokens = category.split(' ');
    let score = name && normalized.includes(name) ? 10 + nameTokens.length : 0;

    for (const token of tokens) {
      if (nameTokens.includes(token)) score += 5;
      else if (token.length >= 5 && nameTokens.some(word => word.includes(token))) score += 2;
      if (brandTokens.includes(token) && !nameTokens.includes(token)) score += 3;
      if (categoryTokens.includes(token)) score += 2;
      if (barcode && barcode.includes(token)) score += 4;
    }
    return { product, score };
  }).filter(match => match.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 4);
}

function getStockAnswer(question, products) {
  const normalizedQuestion = normalizeInventoryQuestion(question);
  const asksForList = /\b(what|which|show|list|all|any|how|tell)\b/.test(normalizedQuestion)
    && (/\b(product|products|item|items|medicine|medicines|drug|drugs)\b/.test(normalizedQuestion)
      || /\b(available|stock)\b/.test(normalizedQuestion));
  if (asksForList) {
    const availableProducts = products.filter(product => Number(product.stock) > 0).sort((first, second) => second.stock - first.stock);
    const asksForCount = /\b(how many|count|number)\b/.test(normalizedQuestion)
      && /\b(products|items|medicines|drugs)\b/.test(normalizedQuestion);
    if (!availableProducts.length) return { text: 'There are no products currently marked in stock.', products: [] };
    const intro = asksForCount
      ? `There are ${availableProducts.length} product types currently in stock. Here are the available items:`
      : 'Here are some products currently available and their on-hand quantities:';
    return { text: intro, products: availableProducts.slice(0, 5) };
  }

  const matches = findStockMatches(question, products);
  if (!matches.length) {
    return { text: 'I could not match that to a product in this shop. Try a product name, brand, barcode, or category.', products: [] };
  }

  const leading = matches[0];
  const second = matches[1];
  const isClearMatch = !second || leading.score >= second.score + 2;
  if (isClearMatch) {
    const product = leading.product;
    const answer = product.stock > 0
      ? `Yes, ${product.name} is available. There are ${product.stock} units in stock at ${format(product.price)} each.`
      : `No, ${product.name} is currently out of stock.`;
    return { text: answer, products: [product] };
  }
  return { text: `I found a few matching products. Here is the current quantity for each:`, products: matches.map(match => match.product) };
}

function StockAssistant({ products, onClose, onAddToSale }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([{
    id: 'assistant-welcome',
    role: 'assistant',
    text: 'Hi! Ask me what is available or how many units are left. I can check product names, brands, and categories.',
  }]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const askQuestion = value => {
    const cleanQuestion = value.trim();
    if (!cleanQuestion) return;
    const answer = getStockAnswer(cleanQuestion, products);
    const time = Date.now();
    setMessages(previous => [
      ...previous,
      { id: `user-${time}`, role: 'user', text: cleanQuestion },
      { id: `answer-${time}`, role: 'assistant', text: answer.text, products: answer.products },
    ]);
    setQuestion('');
  };

  const submitQuestion = event => {
    event.preventDefault();
    askQuestion(question);
  };

  return <div className="assistant-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
      <header className="assistant-header">
        <span className="assistant-brand-icon"><Sparkles size={19} /></span>
        <span className="assistant-title-copy"><small>POSI STOCK ASSISTANT</small><b id="assistant-title">Ask about inventory</b></span>
        <span className="assistant-mode"><i /> READY</span>
        <button className="assistant-close" onClick={onClose} aria-label="Close stock assistant"><X size={18} /></button>
      </header>
      <div className="assistant-subhead"><Sparkles size={14} /><span>I check your current shop quantities and product availability.</span></div>
      <div className="assistant-messages">
        {messages.map(message => <div key={message.id} className={`assistant-message ${message.role}`}>
          {message.role === 'assistant' && <span className="assistant-message-icon"><Sparkles size={13} /></span>}
          <div className="assistant-bubble"><p>{message.text}</p>{message.products?.map(product => <div className="assistant-product" key={product.id}>
            <ProductVisual product={product} small />
            <span className="assistant-product-copy"><b>{product.name}</b><small className={product.stock <= 5 ? 'assistant-low-stock' : ''}>{product.stock} {product.stock === 1 ? 'unit' : 'units'} available · {format(product.price)}</small></span>
            <button className="assistant-add-button" disabled={product.stock < 1} onClick={() => onAddToSale(product)}>{product.stock > 0 ? <><Plus size={13} />Add</> : 'Out'}</button>
          </div>)}</div>
        </div>)}
        <div ref={messagesEndRef} />
      </div>
      <div className="assistant-prompts"><span>TRY ASKING</span><div>
        {['How many Paracetamol are left?', 'Is Zinc available?', 'Do we have cough syrup?'].map(prompt => <button key={prompt} onClick={() => askQuestion(prompt)}>{prompt}</button>)}
      </div></div>
      <form className="assistant-input-form" onSubmit={submitQuestion}><input autoComplete="off" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about a product or quantity…" aria-label="Ask the stock assistant" /><button type="submit" disabled={!question.trim()} aria-label="Send question"><ArrowRight size={17} /></button></form>
      <p className="assistant-footnote">Demo stock assistant · answers are based on the inventory saved in this browser.</p>
    </section>
  </div>;
}

function LoginScreen({ onSignIn }) {
  const [selectedRole, setSelectedRole] = useState('owner');
  const [selectedCashier, setSelectedCashier] = useState(cashiers[0].name);

  return <main className="login-shell">
    <section className="login-brand-panel">
      <a className="brand login-brand" href="#login"><span className="brand-mark"><Plus size={21} strokeWidth={3} /></span><span className="brand-copy"><b>posi<span>.</span></b><small>PHARMACY SUITE</small></span></a>
      <div className="login-hero-copy">
        <span className="login-kicker"><span /> PHARMACY OPERATIONS</span>
        <h1>One shop.<br /><span>Separate workspaces.</span></h1>
        <p>The owner keeps an eye on the shop. Cashiers get a focused register for serving customers.</p>
      </div>
      <div className="login-side-card"><span className="side-card-icon"><Users size={18} /></span><span><b>Owner + cashier</b><small>Independent workspaces, shared shop activity</small></span><span className="side-card-check"><Check size={15} /></span></div>
      <div className="login-brand-footer"><ShieldCheck size={14} /> Demo sign-in · shop data stays in this browser</div>
    </section>
    <section className="login-content">
      <div className="login-card">
        <span className="login-card-kicker">GREEN CROSS PHARMACY · ACCRA</span>
        <h2>Sign in to POSI</h2>
        <p className="login-intro">Choose the account and workspace you use at the shop.</p>
        <div className="account-choices">
          <button type="button" className={`account-choice ${selectedRole === 'owner' ? 'active' : ''}`} onClick={() => setSelectedRole('owner')}>
            <span className="choice-icon owner-choice-icon"><ShieldCheck size={18} /></span><span className="choice-copy"><b>Owner workspace</b><small>Shop overview, staff monitor and all sales</small></span><span className="choice-check">{selectedRole === 'owner' && <Check size={14} />}</span>
          </button>
          <button type="button" className={`account-choice ${selectedRole === 'cashier' ? 'active' : ''}`} onClick={() => setSelectedRole('cashier')}>
            <span className="choice-icon cashier-choice-icon"><ShoppingCart size={18} /></span><span className="choice-copy"><b>Cashier workspace</b><small>Register, inventory and your own sales</small></span><span className="choice-check">{selectedRole === 'cashier' && <Check size={14} />}</span>
          </button>
        </div>
        {selectedRole === 'owner' ? <div className="account-preview"><span className="avatar">AM</span><span><small>OWNER ACCOUNT</small><b>Abena Mensah</b></span><span className="account-tag">OWNER</span></div> : <label className="cashier-picker"><span>Cashier account</span><span className="cashier-select-control"><select value={selectedCashier} onChange={event => setSelectedCashier(event.target.value)}>{cashiers.map(cashier => <option key={cashier.name} value={cashier.name}>{cashier.name} · {cashier.title}</option>)}</select><ChevronDown size={15} /></span></label>}
        <button className="primary-button login-submit" onClick={() => onSignIn(selectedRole, selectedCashier)}><span>Continue as {selectedRole}</span><ArrowRight size={17} /></button>
        <div className="login-disclaimer"><ShieldCheck size={15} /><p><b>Prototype sign-in</b><br />Owner and cashier screens are separate, but passwords are not connected yet. The demo shares this browser's shop data so the owner can monitor cashier sales.</p></div>
      </div>
      <p className="login-bottom-note">Need access? Ask the shop owner to set up your staff account.</p>
    </section>
  </main>;
}

function OwnerDashboard({ total, todaySales, lowStockProducts, activities, onViewSales, onViewInventory }) {
  const cashierSummary = cashiers.map(cashier => {
    const cashierSales = todaySales.filter(sale => sale.cashier === cashier.name);
    return { ...cashier, count: cashierSales.length, total: cashierSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) };
  });
  const activeCount = cashierSummary.filter(cashier => cashier.status === 'On shift').length;
  const metrics = [
    { label: 'Sales today', value: format(total), note: `${todaySales.length} completed transactions`, Icon: Wallet, tone: 'green', trend: '+12.8%' },
    { label: 'Transactions', value: String(todaySales.length), note: 'Sales recorded today', Icon: ShoppingBag, tone: 'blue', trend: null },
    { label: 'Cashiers on shift', value: String(activeCount), note: 'Across the store today', Icon: Users, tone: 'violet', trend: null },
    { label: 'Low stock items', value: String(lowStockProducts.length), note: '5 units or fewer remaining', Icon: AlertTriangle, tone: lowStockProducts.length ? 'amber' : 'green', trend: null },
  ];
  return <section className="page-section dashboard-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> OWNER OVERVIEW <span className="eyebrow-sep">·</span> {displayDate(new Date()).toUpperCase()}</div><h1>Shop overview</h1><p>Monitor sales, stock and cashier activity in one place.</p></div><span className="open-shift-badge"><span />Store open <b>·</b> 2 cashier shifts</span></div>
    <div className="metrics-grid">{metrics.map(({ label, value, note, Icon, tone, trend }) => <article className="metric-card" key={label}><span className={`metric-icon ${tone}`}><Icon size={18} /></span><span className="metric-label">{label}</span><b className="metric-value">{value}</b><span className="metric-note">{trend && <em><ArrowUpRight size={13} />{trend}</em>}{note}</span></article>)}</div>
    <div className="dashboard-grid">
      <section className="workspace-card dashboard-panel cashier-monitor">
        <div className="panel-heading"><div><h2>Cashier monitor</h2><p>Sales and shift status by cashier today.</p></div><button className="text-button" onClick={onViewSales}>View all sales <ArrowRight size={14} /></button></div>
        <div className="table-scroll"><table className="data-table monitor-table"><thead><tr><th>TEAM MEMBER</th><th>SHIFT STATUS</th><th>TRANSACTIONS</th><th>SALES TODAY</th></tr></thead><tbody>{cashierSummary.map(cashier => <tr key={cashier.name}><td><div className="team-member"><span className="avatar team-avatar">{cashier.initials}</span><span><b>{cashier.name}</b><small>{cashier.title} · {cashier.shift}</small></span></div></td><td><span className="status-pill on-shift"><i />{cashier.status}</span></td><td>{cashier.count}</td><td><b>{format(cashier.total)}</b></td></tr>)}</tbody></table></div>
        <div className="monitor-foot"><span><span className="live-dot" /> Activity updates when a sale is recorded</span><span>Demo shift schedule</span></div>
      </section>
      <section className="workspace-card activity-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from the shop.</p></div><span className="activity-live"><i /> TODAY</span></div>
        <div className="activity-list">{activities.slice(0, 5).map(activity => <div className="activity-row" key={activity.id}><span className={`activity-icon ${activity.type}`}>
          {activity.type === 'sale' ? <ShoppingCart size={15} /> : activity.type === 'stock' ? <Package size={15} /> : <PackagePlus size={15} />}
        </span><span className="activity-copy"><b>{activity.title}</b><small>{activity.detail}</small></span><time>{activity.time}</time></div>)}</div>
        <div className="activity-footer"><span>Owner view includes all cashier updates.</span></div>
      </section>
      <section className="workspace-card inventory-alert-panel">
        <div className="panel-heading"><div><h2>Stock to review</h2><p>Products that need a restock check.</p></div><button className="text-button" onClick={onViewInventory}>Inventory <ArrowRight size={14} /></button></div>
        {lowStockProducts.length ? <div className="stock-alert-list">{lowStockProducts.slice(0, 4).map(product => <div className="stock-alert-row" key={product.id}><ProductVisual product={product} small /><span><b>{product.name}</b><small>{product.category}</small></span><strong className={product.stock === 0 ? 'out-of-stock' : ''}>{product.stock} left</strong></div>)}</div> : <div className="clear-stock"><CheckCircle2 size={18} /><span>All products have healthy stock.</span></div>}
      </section>
      <section className="owner-tip-card"><span className="tip-icon"><ShieldCheck size={19} /></span><div><b>Owner controls</b><p>Use the cashier view to try a sale or add a new product. Your updates will show up here.</p></div><span className="tip-arrow"><ArrowDownRight size={18} /></span></section>
    </div>
  </section>;
}

function InventoryPage({ products, totalCount, search, setSearch, category, setCategory, onAdd, onEdit }) {
  const lowStockCount = products.filter(product => product.stock <= 5).length;
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><Package size={13} /> SHOP CATALOGUE</div><h1>Inventory</h1><p>Add products, keep stock levels current, and make checkout faster.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add product</button></div>
    <div className="inventory-summary-row"><div><b>{totalCount}</b><span>products in catalogue</span></div><div className={lowStockCount ? 'inventory-alert-text' : ''}><AlertTriangle size={16} /><b>{lowStockCount}</b><span>low stock in view</span></div><span className="local-save-note"><ShieldCheck size={15} /> Saves on this device</span></div>
    <section className="workspace-card inventory-panel">
      <div className="inventory-toolbar"><label className="search-box inventory-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products or scan barcode…" aria-label="Search inventory" /></label><label className="category-select"><span className="sr-only">Filter by category</span><select value={category} onChange={event => setCategory(event.target.value)}><option>All products</option>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label></div>
      {products.length ? <div className="table-scroll"><table className="data-table inventory-table"><thead><tr><th>PRODUCT</th><th>BARCODE</th><th>STOCK</th><th>SELLING PRICE</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{products.map(product => <tr key={product.id}><td><div className="inventory-product"><ProductVisual product={product} small /><span><b>{product.name}</b><small>{product.brand || product.category} · {product.category}</small></span></div></td><td className="barcode-cell">{product.barcode || '—'}</td><td><b className={product.stock <= 5 ? 'stock-number low' : 'stock-number'}>{product.stock}</b><span className="units-label"> units</span></td><td><b>{format(product.price)}</b></td><td><span className={`status-pill ${product.stock <= 0 ? 'out-pill' : product.stock <= 5 ? 'low-pill' : 'in-stock-pill'}`}><i />{product.stock <= 0 ? 'Out of stock' : product.stock <= 5 ? 'Low stock' : 'In stock'}</span></td><td><button className="edit-product-button" onClick={() => onEdit(product)}>Edit</button></td></tr>)}</tbody></table></div> : <EmptyState icon={Package} title="No matching products" detail="Try another filter or add a product to your shop." action="Add product" onAction={onAdd} />}
      <div className="inventory-footer"><span>Showing {products.length} of {totalCount} products</span><span>Medicine expiry dates can be added when editing a product.</span></div>
    </section>
  </section>;
}

function SalesPage({ role, currentStaff, sales, todaySales, todayTotal }) {
  const visibleSales = role === 'owner' ? sales : sales.filter(sale => sale.cashier === currentStaff.name);
  const title = role === 'owner' ? 'Sales' : 'My sales';
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><TrendingUp size={13} /> TRANSACTION HISTORY</div><h1>{title}</h1><p>{role === 'owner' ? 'Review transactions from every cashier.' : 'Review the sales recorded on your cashier account.'}</p></div><div className="sales-today-card"><span>Today’s total</span><b>{format(role === 'owner' ? todayTotal : todaySales.filter(sale => sale.cashier === currentStaff.name).reduce((sum, sale) => sum + Number(sale.total || 0), 0))}</b><small>{role === 'owner' ? todaySales.length : todaySales.filter(sale => sale.cashier === currentStaff.name).length} transactions</small></div></div>
    <section className="workspace-card sales-panel"><div className="panel-heading sales-panel-heading"><div><h2>All transactions</h2><p>Completed sales appear here after payment is confirmed.</p></div><span className="sales-count-chip">{visibleSales.length} records</span></div>
      {visibleSales.length ? <div className="table-scroll"><table className="data-table sales-table"><thead><tr><th>SALE</th><th>DATE & TIME</th><th>CASHIER</th><th>ITEMS</th><th>PAYMENT</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>{visibleSales.map(sale => <tr key={sale.id}><td><b className="sale-id">{sale.id}</b><small className="sale-customer">{sale.customer || 'Walk-in customer'}</small></td><td><b>{sale.date === localDateKey() ? 'Today' : sale.date}</b><small className="table-subline">{sale.time}</small></td><td>{sale.cashier}</td><td>{sale.itemCount}</td><td><span className="payment-tag">{sale.payment === 'Mobile Money' ? 'MoMo' : sale.payment}</span></td><td><b>{format(sale.total)}</b></td><td><span className="status-pill in-stock-pill"><i />Completed</span></td></tr>)}</tbody></table></div> : <EmptyState icon={ShoppingBag} title="No sales yet" detail="Completed transactions will show here." />}
    </section>
  </section>;
}

function EmptyState({ icon: Icon, title, detail, action, onAction }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon size={23} /></span><b>{title}</b><p>{detail}</p>{action && <button className="outline-button" onClick={onAction}><Plus size={15} />{action}</button>}</div>;
}

function ProductFormModal({ initialProduct, onClose, onSave }) {
  const [name, setName] = useState(initialProduct?.name || '');
  const [brand, setBrand] = useState(initialProduct?.brand || '');
  const [category, setCategory] = useState(initialProduct?.category || categories[0]);
  const [price, setPrice] = useState(initialProduct?.price ?? '');
  const [stock, setStock] = useState(initialProduct?.stock ?? '');
  const [barcode, setBarcode] = useState(initialProduct?.barcode || '');
  const [expiry, setExpiry] = useState(initialProduct?.expiry || '');
  const [image, setImage] = useState(initialProduct?.image || '');
  const [imageError, setImageError] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);

  const changePhoto = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Choose an image file.');
      return;
    }
    setSavingPhoto(true);
    setImageError('');
    try {
      const optimized = await optimizePhoto(file);
      setImage(optimized);
    } catch {
      setImageError('Could not load that image. Try another photo.');
    } finally {
      setSavingPhoto(false);
      event.target.value = '';
    }
  };

  const submit = event => {
    event.preventDefault();
    if (!name.trim() || price === '' || stock === '' || Number(price) < 0 || Number(stock) < 0) return;
    const product = {
      ...(initialProduct || {}),
      id: initialProduct?.id || `product-${Date.now()}`,
      name: name.trim(),
      brand: brand.trim() || category,
      category,
      price: Number(price),
      stock: Math.floor(Number(stock)),
      barcode: barcode.trim(),
      expiry,
      image,
      color: initialProduct?.color || ['mint', 'peach', 'lavender', 'blue'][Math.floor(Math.random() * 4)],
      icon: initialProduct?.icon || 'pill',
      rx: initialProduct?.rx || false,
    };
    onSave(product);
  };

  return <div className="modal-backdrop product-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="product-form-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
    <div className="form-modal-header"><span className="form-modal-icon"><PackagePlus size={20} /></span><span className="form-modal-heading"><span className="modal-eyebrow">INVENTORY</span><h2 id="product-form-title">{initialProduct ? 'Edit product' : 'Add a product'}</h2><p>Enter the details your cashier needs at checkout.</p></span><button className="modal-close" onClick={onClose} aria-label="Close product form"><X size={19} /></button></div>
    <form onSubmit={submit}>
      <div className="product-form-body">
        <div className="photo-field"><span className="form-label">Product photo <small>Optional</small></span><div className={`photo-drop ${image ? 'has-photo' : ''}`}>
          {image ? <img src={image} alt={name ? `${name} photo preview` : 'Product photo preview'} /> : <span className="photo-placeholder"><ImagePlus size={23} /><b>Snap a photo or upload</b><small>On a phone, choose the camera to take a picture.</small></span>}
          <label className="photo-button" htmlFor="product-photo"><Camera size={15} />{savingPhoto ? 'Preparing…' : image ? 'Change photo' : 'Take photo / upload'}<input id="product-photo" type="file" accept="image/*" capture="environment" onChange={changePhoto} disabled={savingPhoto} /></label>
          {image && <button type="button" className="remove-photo" aria-label="Remove product photo" onClick={() => setImage('')}><X size={14} /></button>}
        </div><small className="field-hint">The photo is saved with the product name you enter below.</small>{imageError && <span className="field-error">{imageError}</span>}</div>
        <div className="form-field"><label className="form-label" htmlFor="product-name">Product name <b>*</b></label><input id="product-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Paracetamol 500mg" required maxLength={70} /></div>
        <div className="form-two-col"><div className="form-field"><label className="form-label" htmlFor="product-category">Category <b>*</b></label><span className="select-control"><select id="product-category" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></span></div><div className="form-field"><label className="form-label" htmlFor="product-brand">Brand / size</label><input id="product-brand" value={brand} onChange={event => setBrand(event.target.value)} placeholder="e.g. 20 tablets" maxLength={60} /></div></div>
        <div className="form-two-col"><div className="form-field"><label className="form-label" htmlFor="product-price">Selling price <b>*</b></label><span className="input-prefix"><span>GH₵</span><input id="product-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0.00" required /></span></div><div className="form-field"><label className="form-label" htmlFor="product-stock">Quantity in stock <b>*</b></label><input id="product-stock" type="number" inputMode="numeric" min="0" step="1" value={stock} onChange={event => setStock(event.target.value)} placeholder="0" required /></div></div>
        <div className="form-two-col"><div className="form-field"><label className="form-label" htmlFor="product-barcode">Barcode <small>Optional</small></label><input id="product-barcode" value={barcode} onChange={event => setBarcode(event.target.value)} placeholder="Enter or scan a barcode" maxLength={40} /></div><div className="form-field"><label className="form-label" htmlFor="product-expiry">Expiry date <small>Optional</small></label><input id="product-expiry" type="month" value={expiry} onChange={event => setExpiry(event.target.value)} /></div></div>
        <p className="photo-storage-hint"><ShieldCheck size={14} />Product details and photo stay in this browser in the demo.</p>
      </div>
      <div className="form-modal-footer"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={savingPhoto}><Check size={16} />{initialProduct ? 'Save changes' : 'Save product'}</button></div>
    </form>
  </section></div>;
}

async function optimizePhoto(file) {
  if (typeof createImageBitmap !== 'function') return readFileAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  const maxDimension = 760;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return readFileAsDataUrl(file);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.78);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

createRoot(document.getElementById('root')).render(<App />);
