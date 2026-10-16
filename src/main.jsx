import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Barcode,
  Camera, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3,
  BarChart3, CalendarDays, CreditCard, Download, FileText, ImagePlus,
  LayoutDashboard, LogOut, Minus, Package, PackagePlus, Pill, Plus, Printer,
  Search, ShieldCheck, ShoppingBag, ShoppingCart,
  SlidersHorizontal, Sparkles, TrendingUp, UserRound, Users, Wallet, X,
} from 'lucide-react';
import './style.css';

const PRODUCT_STORAGE_KEY = 'posi-v2-products';
const SALES_STORAGE_KEY = 'posi-v2-sales';
const ACTIVITY_STORAGE_KEY = 'posi-v2-activity';
const ATTENDANCE_STORAGE_KEY = 'posi-v1-attendance';
const LEAVE_STORAGE_KEY = 'posi-v1-leave-requests';
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
const clockTime = date => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dateAfterDays = days => { const date = new Date(); date.setDate(date.getDate() + days); return localDateKey(date); };
const readableDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const displayDate = date => date.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function normalizeExpiryDate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return `${value}-${String(lastDay).padStart(2, '0')}`;
  }
  return value;
}

function getProductBatches(product) {
  if (Array.isArray(product.batches) && product.batches.length) {
    return product.batches.map((batch, index) => ({
      ...batch,
      id: batch.id || `batch-${product.id}-${index}`,
      lotNumber: batch.lotNumber || product.batchNumber || `LOT-${String(product.id).slice(-6)}-${index + 1}`,
      stock: Math.max(0, Number(batch.stock || 0)),
      expiry: normalizeExpiryDate(batch.expiry || product.expiry),
    }));
  }
  return [{ id: `legacy-${product.id}`, lotNumber: product.batchNumber || `LOT-${String(product.id).slice(-6)}`, stock: Math.max(0, Number(product.stock || 0)), expiry: normalizeExpiryDate(product.expiry) }];
}

function getPhysicalStock(product) {
  return getProductBatches(product).reduce((sum, batch) => sum + Number(batch.stock || 0), 0);
}

function getAvailableStock(product, today = localDateKey()) {
  return getProductBatches(product).filter(batch => batch.expiry && batch.expiry >= today).reduce((sum, batch) => sum + Number(batch.stock || 0), 0);
}

function getExpiryAlerts(products, withinDays = 90) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);
  return products.flatMap(product => getProductBatches(product).filter(batch => Number(batch.stock) > 0).map(batch => {
    const missing = !batch.expiry;
    const expiryDate = missing ? null : new Date(`${batch.expiry}T00:00:00`);
    const days = missing ? null : Math.ceil((expiryDate - today) / 86400000);
    const expired = !missing && batch.expiry < todayKey;
    return { product, batch, days, expired, missing };
  }).filter(alert => alert.missing || alert.expired || alert.days <= withinDays))
    .sort((first, second) => {
      const priority = alert => alert.expired ? -1_000_000 : alert.missing ? -500_000 : alert.days;
      return priority(first) - priority(second);
    });
}

function allocateStockFromBatches(product, quantity) {
  const batches = getProductBatches(product).sort((first, second) => (first.expiry || '9999-12-31').localeCompare(second.expiry || '9999-12-31'));
  let remaining = quantity;
  const allocations = [];
  const nextBatches = batches.map(batch => {
    if (remaining <= 0 || !batch.expiry || batch.expiry < localDateKey()) return batch;
    const taken = Math.min(remaining, batch.stock);
    remaining -= taken;
    if (taken > 0) allocations.push({ lotNumber: batch.lotNumber, quantity: taken, expiry: batch.expiry });
    return { ...batch, stock: batch.stock - taken };
  });
  return { batches: nextBatches, allocations };
}

const starterProducts = [
  { id: 'sample-1', name: 'Paracetamol 500mg', brand: 'Paracetamol · 20 tablets', price: 12.5, stock: 48, category: 'Pain relief', color: 'mint', icon: 'pill', batchNumber: 'PCM-26-A', expiry: '2027-11-30', barcode: '', rx: false },
  { id: 'sample-2', name: 'Vitamin C 1000mg', brand: 'NutriLife · 30 tablets', price: 38, stock: 24, category: 'Vitamins', color: 'peach', icon: 'sun', batchNumber: 'VTC-26-B', expiry: '2027-08-31', barcode: '', rx: false },
  { id: 'sample-3', name: 'Cetirizine 10mg', brand: 'AllerFree · 10 tablets', price: 18, stock: 6, category: 'Allergy', color: 'lavender', icon: 'drop', batchNumber: 'CTZ-26-C', expiry: '2026-12-31', barcode: '', rx: false },
  { id: 'sample-4', name: 'Amoxicillin 500mg', brand: 'AmoxiCare · 21 capsules', price: 42, stock: 15, category: 'Antibiotics', color: 'blue', icon: 'capsule', batchNumber: 'AMX-26-A', expiry: '2027-06-30', barcode: '', rx: true },
  { id: 'sample-5', name: 'Ibuprofen 400mg', brand: 'IbuRelief · 20 tablets', price: 16, stock: 32, category: 'Pain relief', color: 'peach', icon: 'pill', batchNumber: 'IBU-26-B', expiry: '2028-03-31', barcode: '', rx: false },
  { id: 'sample-6', name: 'Zinc 20mg', brand: 'Wellness+ · 30 tablets', price: 27.5, stock: 3, category: 'Vitamins', color: 'mint', icon: 'sun', batchNumber: 'ZN-26-A', expiry: '2026-11-30', barcode: '', rx: false },
  { id: 'sample-7', name: 'Cough Syrup', brand: 'Tussin · 100ml', price: 32, stock: 18, category: 'Cold & flu', color: 'blue', icon: 'bottle', batchNumber: 'CS-26-C', expiry: '2027-12-31', barcode: '', rx: false },
  { id: 'sample-8', name: 'ORS Sachets', brand: 'Rehydra · 4 sachets', price: 8, stock: 57, category: 'First aid', color: 'lavender', icon: 'plus', batchNumber: 'ORS-26-A', expiry: '2028-05-31', barcode: '', rx: false },
  { id: 'sample-9', name: 'Omeprazole 20mg', brand: 'Omez · 14 capsules', price: 25, stock: 21, category: 'Digestive', color: 'peach', icon: 'capsule', batchNumber: 'OMZ-26-B', expiry: '2027-07-31', barcode: '', rx: false },
  { id: 'sample-10', name: 'Hand Sanitizer', brand: 'PureGuard · 250ml', price: 22, stock: 12, category: 'Personal care', color: 'mint', icon: 'drop', batchNumber: 'HG-26-A', expiry: '2028-02-28', barcode: '', rx: false },
  { id: 'sample-11', name: 'Loratadine 10mg', brand: 'Clarity · 10 tablets', price: 20, stock: 8, category: 'Allergy', color: 'lavender', icon: 'pill', batchNumber: 'LOR-26-B', expiry: '2027-10-31', barcode: '', rx: false },
  { id: 'sample-12', name: 'Multivitamin', brand: 'DailyCare · 30 tablets', price: 55, stock: 19, category: 'Vitamins', color: 'blue', icon: 'sun', batchNumber: 'MV-26-C', expiry: '2028-04-30', barcode: '', rx: false },
];

const makeStarterSales = () => {
  const today = localDateKey();
  const line = (productId, name, quantity, unitPrice) => ({ productId, name, quantity, unitPrice, lineTotal: quantity * unitPrice });
  return [
    { id: 'POS-02487', invoiceNumber: 'INV-02487', date: today, time: '10:42', cashier: 'Ama Boateng', customer: 'Walk-in customer', total: 156.5, subtotal: 156.5, discountAmount: 0, itemCount: 6, payment: 'Cash', items: [line('sample-1', 'Paracetamol 500mg', 1, 12.5), line('sample-2', 'Vitamin C 1000mg', 2, 38), line('sample-4', 'Amoxicillin 500mg', 1, 42), line('sample-3', 'Cetirizine 10mg', 1, 18), line('sample-8', 'ORS Sachets', 1, 8)] },
    { id: 'POS-02486', invoiceNumber: 'INV-02486', date: today, time: '10:31', cashier: 'Kwame Owusu', customer: 'Akosua Boateng', total: 86.5, subtotal: 86.5, discountAmount: 0, itemCount: 3, payment: 'Mobile Money', items: [line('sample-1', 'Paracetamol 500mg', 1, 12.5), line('sample-4', 'Amoxicillin 500mg', 1, 42), line('sample-7', 'Cough Syrup', 1, 32)] },
    { id: 'POS-02485', invoiceNumber: 'INV-02485', date: today, time: '09:55', cashier: 'Ama Boateng', customer: 'Walk-in customer', total: 56, subtotal: 56, discountAmount: 0, itemCount: 2, payment: 'Card', items: [line('sample-2', 'Vitamin C 1000mg', 1, 38), line('sample-3', 'Cetirizine 10mg', 1, 18)] },
    { id: 'POS-02484', invoiceNumber: 'INV-02484', date: today, time: '09:18', cashier: 'Kwame Owusu', customer: 'Walk-in customer', total: 42, subtotal: 42, discountAmount: 0, itemCount: 1, payment: 'Cash', items: [line('sample-4', 'Amoxicillin 500mg', 1, 42)] },
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
const makeStarterAttendance = () => {
  const today = localDateKey();
  return [
    { id: `attendance-${today}-ama`, staff: 'Ama Boateng', date: today, clockIn: '08:02', clockOut: '', status: 'On shift' },
    { id: `attendance-${today}-kwame`, staff: 'Kwame Owusu', date: today, clockIn: '09:06', clockOut: '', status: 'On shift' },
  ];
};
const makeStarterLeaveRequests = () => [{
  id: 'leave-demo-001', staff: 'Kwame Owusu', type: 'Personal leave', startDate: dateAfterDays(4), endDate: dateAfterDays(5), reason: 'Family appointment', status: 'Pending', submittedDate: localDateKey(),
}];

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
  const [attendance, setAttendance, attendanceSaveError] = usePersistentState(ATTENDANCE_STORAGE_KEY, makeStarterAttendance());
  const [leaveRequests, setLeaveRequests, leaveSaveError] = usePersistentState(LEAVE_STORAGE_KEY, makeStarterLeaveRequests());
  const [role, setRole] = useState(readSessionRole);
  const [cashierName, setCashierName] = useState(() => readSessionValue('posi-session-cashier') || cashiers[0].name);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [activeView, setActiveView] = useState(() => readSessionRole() === 'cashier' ? 'Point of sale' : 'Dashboard');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All products');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState('All products');
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState('Cash');
  const [customer, setCustomer] = useState('Walk-in customer');
  const [customCustomer, setCustomCustomer] = useState('');
  const [discount, setDiscount] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [mobileCart, setMobileCart] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [batchProduct, setBatchProduct] = useState(null);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);

  const currentStaff = role === 'owner'
    ? { name: 'Abena Mensah', initials: 'AM', title: 'Store owner' }
    : cashiers.find(cashier => cashier.name === cashierName) || cashiers[0];
  const currentDate = new Date();
  const todayKey = localDateKey(currentDate);
  const todaySales = useMemo(() => sales.filter(sale => sale.date === todayKey), [sales, todayKey]);
  const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const lowStockProducts = products.filter(product => getAvailableStock(product) <= 5).map(product => ({ ...product, stock: getAvailableStock(product) }));
  const expiryAlerts = getExpiryAlerts(products);
  const invoiceCustomer = customer === 'New customer' ? customCustomer.trim() || 'New customer' : customer;
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal * (discount ? 0.9 : 1);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const visibleProducts = useMemo(() => products.filter(product => {
    const matchesCategory = category === 'All products' || product.category === category;
    const searchText = `${product.name} ${product.brand || ''} ${product.category || ''} ${product.barcode || ''}`.toLowerCase();
    return matchesCategory && searchText.includes(search.toLowerCase().trim());
  }).map(product => ({ ...product, batches: getProductBatches(product), stock: getAvailableStock(product, todayKey) })), [products, category, search, todayKey]);
  const visibleInventory = useMemo(() => products.filter(product => {
    const matchesCategory = inventoryCategory === 'All products' || product.category === inventoryCategory;
    const lots = getProductBatches(product).map(batch => batch.lotNumber || '').join(' ');
    const searchText = `${product.name} ${product.brand || ''} ${product.category || ''} ${product.barcode || ''} ${lots}`.toLowerCase();
    return matchesCategory && searchText.includes(inventorySearch.toLowerCase().trim());
  }).map(product => ({ ...product, batches: getProductBatches(product), stock: getAvailableStock(product, todayKey) })), [products, inventoryCategory, inventorySearch, todayKey]);
  const storageError = productSaveError || salesSaveError || activitySaveError || attendanceSaveError || leaveSaveError;

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {
        // Local storage keeps the demo usable even if browser caching is unavailable.
      });
    }
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

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
    setCustomer('Walk-in customer');
    setCustomCustomer('');
    setShowPay(false);
    setShowProductModal(false);
    setShowAssistant(false);
    setEditingProduct(null);
    setBatchProduct(null);
    setSelectedInvoice(null);
    setLastInvoice(null);
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

  const saveBatches = batches => {
    if (!batchProduct) return;
    const totalStock = batches.reduce((sum, batch) => sum + Number(batch.stock || 0), 0);
    const sorted = [...batches].sort((first, second) => (first.expiry || '9999-12-31').localeCompare(second.expiry || '9999-12-31'));
    setProducts(previous => previous.map(product => product.id === batchProduct.id ? {
      ...product,
      batches,
      stock: totalStock,
      batchNumber: sorted[0]?.lotNumber || '',
      expiry: sorted[0]?.expiry || '',
    } : product));
    addActivity({ type: 'stock', title: `${currentStaff.name} updated batch stock`, detail: `${batchProduct.name} · ${totalStock} units`, time: shortTime(new Date()) });
    flash(`${batchProduct.name} batch stock updated.`);
    setBatchProduct(null);
  };

  const addToCart = product => {
    const available = getAvailableStock(product);
    if (available < 1) {
      flash(`${product.name} is unavailable or expired.`);
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing && existing.qty >= available) {
      flash(`Only ${available} ${product.name} available.`);
      return;
    }
    setCart(previous => existing
      ? previous.map(item => item.id === product.id ? { ...item, qty: item.qty + 1, stock: available } : item)
      : [...previous, { ...product, stock: available, qty: 1 }]);
    flash(`${product.name} added to sale.`);
  };

  const updateQuantity = (id, change) => {
    setCart(previous => previous.map(item => {
      if (item.id !== id) return item;
      const product = products.find(entry => entry.id === id);
      return { ...item, qty: Math.max(0, Math.min(item.qty + change, product ? getAvailableStock(product) : item.stock)) };
    }).filter(item => item.qty > 0));
  };

  const completeSale = () => {
    if (customer === 'New customer' && !customCustomer.trim()) {
      flash('Enter the customer name before creating an invoice.');
      return;
    }
    const unavailableLine = cart.find(item => {
      const product = products.find(entry => entry.id === item.id) || item;
      return getAvailableStock(product) < item.qty;
    });
    if (unavailableLine) {
      flash(`${unavailableLine.name} no longer has enough unexpired stock. Adjust the sale before charging.`);
      return;
    }
    const receiptNumber = String(Date.now()).slice(-6);
    const saleItems = cart.map(item => {
      const product = products.find(entry => entry.id === item.id) || item;
      const { allocations } = allocateStockFromBatches(product, item.qty);
      return { productId: item.id, name: item.name, quantity: item.qty, unitPrice: item.price, lineTotal: Number((item.price * item.qty).toFixed(2)), batchLots: allocations };
    });
    const sale = {
      id: `POS-${receiptNumber}`,
      invoiceNumber: `INV-${receiptNumber}`,
      date: localDateKey(),
      time: shortTime(new Date()),
      cashier: currentStaff.name,
      customer: invoiceCustomer,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number((subtotal - total).toFixed(2)),
      total: Number(total.toFixed(2)),
      itemCount,
      payment,
      items: saleItems,
    };
    setLastInvoice(sale);
    setSales(previous => [sale, ...previous]);
    setProducts(previous => previous.map(product => {
      const sold = cart.find(item => item.id === product.id);
      if (!sold) return product;
      const { batches } = allocateStockFromBatches(product, sold.qty);
      return { ...product, batches, stock: batches.reduce((sum, batch) => sum + Number(batch.stock || 0), 0) };
    }));
    addActivity({ type: 'sale', title: `${currentStaff.name} completed a sale`, detail: `${format(total)} · ${payment}`, time: sale.time });
    setCart([]);
    setDiscount(false);
    setShowPay(false);
    setMobileCart(false);
    setShowSuccess(true);
    window.setTimeout(() => setShowSuccess(false), 6500);
  };

  const toggleAttendance = () => {
    const today = localDateKey();
    const entry = attendance.find(record => record.staff === currentStaff.name && record.date === today);
    const now = clockTime(new Date());
    if (!entry) {
      setAttendance(previous => [{ id: `attendance-${Date.now()}`, staff: currentStaff.name, date: today, clockIn: now, clockOut: '', status: 'On shift' }, ...previous]);
      addActivity({ type: 'attendance', title: `${currentStaff.name} clocked in`, detail: `Shift started at ${now}`, time: shortTime(new Date()) });
      flash('You are clocked in for today.');
    } else if (entry.status === 'On shift') {
      setAttendance(previous => previous.map(record => record.id === entry.id ? { ...record, clockOut: now, status: 'Clocked out' } : record));
      addActivity({ type: 'attendance', title: `${currentStaff.name} clocked out`, detail: `Shift ended at ${now}`, time: shortTime(new Date()) });
      flash('You are clocked out for today.');
    } else {
      flash('Your shift is already completed for today.');
    }
  };

  const submitLeaveRequest = request => {
    const newRequest = { ...request, id: `leave-${Date.now()}`, staff: currentStaff.name, status: 'Pending', submittedDate: localDateKey() };
    setLeaveRequests(previous => [newRequest, ...previous]);
    addActivity({ type: 'leave', title: `${currentStaff.name} requested leave`, detail: `${request.type} · ${readableDate(request.startDate)}`, time: shortTime(new Date()) });
    flash('Leave request sent to the owner.');
  };

  const reviewLeaveRequest = (requestId, status) => {
    const request = leaveRequests.find(item => item.id === requestId);
    if (!request || request.status !== 'Pending') return;
    setLeaveRequests(previous => previous.map(item => item.id === requestId ? { ...item, status } : item));
    addActivity({ type: 'leave', title: `${currentStaff.name} ${status.toLowerCase()} leave`, detail: `${request.staff} · ${request.type}`, time: shortTime(new Date()) });
    flash(`Leave request ${status.toLowerCase()}.`);
  };

  const navItems = role === 'owner'
    ? [
      { label: 'Overview', mobileLabel: 'Overview', view: 'Dashboard', Icon: LayoutDashboard },
      { label: 'Inventory', mobileLabel: 'Inventory', view: 'Inventory', Icon: Package },
      { label: 'Invoices', mobileLabel: 'Invoices', view: 'Invoices', Icon: FileText },
      { label: 'Reports', mobileLabel: 'Reports', view: 'Reports', Icon: BarChart3 },
      { label: 'Attendance & leave', mobileLabel: 'Attendance', view: 'Attendance', Icon: CalendarDays },
    ]
    : [
      { label: 'Point of sale', mobileLabel: 'Register', view: 'Point of sale', Icon: ShoppingCart },
      { label: 'Inventory', mobileLabel: 'Inventory', view: 'Inventory', Icon: Package },
      { label: 'My invoices', mobileLabel: 'Invoices', view: 'Invoices', Icon: FileText },
      { label: 'Attendance & leave', mobileLabel: 'Attendance', view: 'Attendance', Icon: CalendarDays },
    ];
  const pendingLeaveCount = leaveRequests.filter(request => request.status === 'Pending').length;
  const activeLabel = navItems.find(item => item.view === activeView)?.label || activeView;
  const setView = view => {
    setActiveView(view);
    setMobileCart(false);
    setShowAssistant(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderNav = (mobile = false) => navItems.map(({ label, mobileLabel, view, Icon }) => {
    const badgeCount = view === 'Inventory' ? lowStockProducts.length : view === 'Attendance' && role === 'owner' ? pendingLeaveCount : 0;
    return <button key={view} className={`${mobile ? 'mobile-nav-item' : 'nav-item'} ${activeView === view ? 'selected' : ''}`} onClick={() => setView(view)} aria-current={activeView === view ? 'page' : undefined}>
      <Icon size={18} />
      <span>{mobile ? mobileLabel : label}</span>
      {!mobile && badgeCount > 0 && <span className="nav-count">{badgeCount}</span>}
    </button>;
  });

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
            <span className={`connection-chip ${isOnline ? 'online' : 'offline'}`} role="status" aria-live="polite"><i />{isOnline ? 'Online' : 'Offline · saved here'}</span>
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
            expiryAlerts={expiryAlerts}
            activities={activities}
            attendance={attendance}
            leaveRequests={leaveRequests}
            onViewSales={() => setView('Invoices')}
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
                <div className="customer-select"><span className="customer-avatar"><UserRound size={16} /></span>{customer === 'New customer' ? <input className="customer-name-input" value={customCustomer} onChange={event => setCustomCustomer(event.target.value)} placeholder="Name for invoice" aria-label="Customer name for invoice" maxLength={80} /> : <select value={customer} onChange={event => setCustomer(event.target.value)} aria-label="Select customer"><option>Walk-in customer</option><option>Akosua Boateng</option><option>Kwame Owusu</option><option>New customer</option></select>}{customer !== 'New customer' && <ChevronDown size={15} />}{customer === 'New customer' && <button type="button" className="customer-mode-back" onClick={() => setCustomer('Walk-in customer')} aria-label="Use walk-in customer"><X size={14} /></button>}</div>
                <div className="cart-list">{cart.length ? cart.map(item => <div className="cart-item" key={item.id}><ProductVisual product={item} small /><div className="cart-item-info"><b>{item.name}</b><small>{format(item.price)} <span>·</span> {item.brand || item.category}</small><div className="quantity"><button onClick={() => updateQuantity(item.id, -1)} aria-label={`Decrease ${item.name}`}><Minus size={13} /></button><span>{item.qty}</span><button onClick={() => updateQuantity(item.id, 1)} disabled={item.qty >= item.stock} aria-label={`Increase ${item.name}`}><Plus size={13} /></button></div></div><div className="cart-price"><b>{format(item.price * item.qty)}</b><button onClick={() => setCart(previous => previous.filter(entry => entry.id !== item.id))} aria-label={`Remove ${item.name}`}><X size={14} /></button></div></div>) : <div className="empty-cart"><span className="empty-cart-icon"><ShoppingBag size={22} /></span><b>Your sale is empty</b><span>Tap a product to add it here.</span></div>}</div>
                <button className={`discount-row ${discount ? 'discount-on' : ''}`} onClick={() => setDiscount(value => !value)}><span className="discount-left"><span className="discount-icon">%</span><span><b>Apply 10% discount</b><small>{discount ? 'Discount applied to this sale' : 'Optional sale discount'}</small></span></span><span className={`switch ${discount ? 'on' : ''}`}><i /></span></button>
                <div className="totals"><div><span>Subtotal</span><b>{format(subtotal)}</b></div>{discount && <div className="discount-total"><span>Discount (10%)</span><b>− {format(subtotal * 0.1)}</b></div>}<div className="tax-line"><span>Tax <small>(included)</small></span><b>{format(total - total / 1.15)}</b></div><div className="total-row"><span>Total due</span><b>{format(total)}</b></div></div>
                <div className="payment-label">PAYMENT METHOD</div><div className="payment-options"><button className={payment === 'Cash' ? 'pay-active' : ''} onClick={() => setPayment('Cash')}><Wallet size={16} />Cash</button><button className={payment === 'Mobile Money' ? 'pay-active' : ''} onClick={() => setPayment('Mobile Money')}><Activity size={16} />MoMo</button><button className={payment === 'Card' ? 'pay-active' : ''} onClick={() => setPayment('Card')}><CreditCard size={16} />Card</button></div>
                <button className="checkout-button" disabled={!cart.length} onClick={() => { if (customer === 'New customer' && !customCustomer.trim()) { flash('Enter the customer name before creating an invoice.'); return; } setShowPay(true); }}><span>Charge {format(total)}</span><ArrowRight size={18} /></button><div className="secure-note"><ShieldCheck size={13} />Confirm payment to record this sale</div>
              </aside>
            </div>
          </section>}
          {activeView === 'Inventory' && <InventoryPage products={visibleInventory} totalCount={products.length} search={inventorySearch} setSearch={setInventorySearch} category={inventoryCategory} setCategory={setInventoryCategory} expiryAlerts={expiryAlerts} onAdd={openNewProduct} onEdit={product => { setEditingProduct(product); setShowProductModal(true); }} onManageBatches={setBatchProduct} />}
          {activeView === 'Invoices' && <InvoicesPage role={role} currentStaff={currentStaff} sales={sales} onViewInvoice={setSelectedInvoice} />}
          {activeView === 'Reports' && role === 'owner' && <ReportsPage sales={sales} />}
          {activeView === 'Attendance' && <AttendancePage role={role} currentStaff={currentStaff} attendance={attendance} leaveRequests={leaveRequests} onClockToggle={toggleAttendance} onSubmitLeave={submitLeaveRequest} onReviewLeave={reviewLeaveRequest} />}
        </div>

        {activeView === 'Point of sale' && <button className="mobile-cart-fab" onClick={() => setMobileCart(true)}><ShoppingCart size={18} /> View sale <span>{itemCount}</span><b>{format(total)}</b></button>}
        <nav className={`mobile-nav ${role === 'owner' ? 'owner-nav' : 'cashier-nav'}`} aria-label="Mobile navigation">{renderNav(true)}</nav>
      </main>

      {showProductModal && <ProductFormModal key={editingProduct?.id || 'new-product'} initialProduct={editingProduct} onClose={() => { setShowProductModal(false); setEditingProduct(null); }} onManageBatches={product => { setShowProductModal(false); setBatchProduct(product); }} onSave={saveProduct} />}
      {batchProduct && <BatchManagerModal key={batchProduct.id} product={batchProduct} onClose={() => setBatchProduct(null)} onSave={saveBatches} />}
      {selectedInvoice && <InvoiceDetailsModal sale={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      {showAssistant && role === 'cashier' && activeView === 'Point of sale' && <StockAssistant products={products} onClose={() => setShowAssistant(false)} onAddToSale={addToCart} />}
      {showPay && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowPay(false); }}><div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><button className="modal-close" onClick={() => setShowPay(false)} aria-label="Close payment confirmation"><X size={19} /></button><span className="modal-icon"><Wallet size={24} /></span><span className="modal-eyebrow">COMPLETE SALE</span><h2 id="checkout-title">Confirm payment</h2><p>Confirm payment from {invoiceCustomer.toLowerCase()} to record this transaction.</p><div className="modal-amount"><span>Amount due</span><b>{format(total)}</b></div><div className="modal-method"><span>Payment method</span><strong>{payment === 'Mobile Money' ? 'Mobile Money (MoMo)' : payment}</strong></div><button className="confirm-button" onClick={completeSale}><Check size={17} /> Confirm payment &amp; create invoice</button><div className="modal-secure"><ShieldCheck size={13} />The sale will appear in the owner dashboard</div></div></div>}
      {showSuccess && <div className="success-toast"><span className="success-icon"><Check size={17} /></span><span><b>Sale invoiced!</b><small>Payment recorded · invoice {lastInvoice?.invoiceNumber}</small></span><button onClick={() => { setShowSuccess(false); setSelectedInvoice(lastInvoice); }}><FileText size={15} />Invoice</button><button className="success-x" onClick={() => setShowSuccess(false)} aria-label="Dismiss"><X size={16} /></button></div>}
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
    const availableProducts = products.map(product => ({ ...product, stock: getAvailableStock(product) })).filter(product => product.stock > 0).sort((first, second) => second.stock - first.stock);
    const asksForCount = /\b(how many|count|number)\b/.test(normalizedQuestion)
      && /\b(products|items|medicines|drugs)\b/.test(normalizedQuestion);
    if (!availableProducts.length) return { text: 'There are no products currently available to sell.', products: [] };
    const intro = asksForCount
      ? `There are ${availableProducts.length} product types currently in stock. Here are the available items:`
      : 'Here are some products currently available and their unexpired quantities:';
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
    const available = getAvailableStock(product);
    const answer = available > 0
      ? `Yes, ${product.name} is available. There are ${available} unexpired units in stock at ${format(product.price)} each.`
      : `No, ${product.name} is currently unavailable for sale (out of stock or expired).`;
    return { text: answer, products: [{ ...product, stock: available }] };
  }
  return { text: 'I found a few matching products. Here is the current unexpired quantity for each:', products: matches.map(match => ({ ...match.product, stock: getAvailableStock(match.product) })) };
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

function OwnerDashboard({ total, todaySales, lowStockProducts, expiryAlerts, activities, attendance, leaveRequests, onViewSales, onViewInventory }) {
  const today = localDateKey();
  const cashierSummary = cashiers.map(cashier => {
    const cashierSales = todaySales.filter(sale => sale.cashier === cashier.name);
    const shift = attendance.find(record => record.staff === cashier.name && record.date === today);
    return { ...cashier, status: shift?.status || 'Not clocked in', clockIn: shift?.clockIn || '', count: cashierSales.length, total: cashierSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) };
  });
  const activeCount = cashierSummary.filter(cashier => cashier.status === 'On shift').length;
  const pendingLeave = leaveRequests.filter(request => request.status === 'Pending').length;
  const metrics = [
    { label: 'Sales today', value: format(total), note: `${todaySales.length} completed transactions`, Icon: Wallet, tone: 'green', trend: '+12.8%' },
    { label: 'Transactions', value: String(todaySales.length), note: 'Sales recorded today', Icon: ShoppingBag, tone: 'blue', trend: null },
    { label: 'Cashiers on shift', value: String(activeCount), note: 'Across the store today', Icon: Users, tone: 'violet', trend: null },
    { label: 'Pending leave', value: String(pendingLeave), note: 'Requests to review', Icon: CalendarDays, tone: pendingLeave ? 'amber' : 'green', trend: null },
    { label: 'Low stock items', value: String(lowStockProducts.length), note: '5 units or fewer remaining', Icon: AlertTriangle, tone: lowStockProducts.length ? 'amber' : 'green', trend: null },
    { label: 'Expiry watch', value: String(expiryAlerts.length), note: `${expiryAlerts.filter(alert => alert.expired).length} expired · ${expiryAlerts.filter(alert => alert.missing).length} missing dates`, Icon: CalendarDays, tone: expiryAlerts.length ? 'amber' : 'green', trend: null },
  ];
  return <section className="page-section dashboard-page">
    <div className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> OWNER OVERVIEW <span className="eyebrow-sep">·</span> {displayDate(new Date()).toUpperCase()}</div><h1>Shop overview</h1><p>Monitor sales, stock and cashier activity in one place.</p></div><span className="open-shift-badge"><span />Store open <b>·</b> {activeCount} cashier shifts active</span></div>
    <div className="metrics-grid">{metrics.map(({ label, value, note, Icon, tone, trend }) => <article className="metric-card" key={label}><span className={`metric-icon ${tone}`}><Icon size={18} /></span><span className="metric-label">{label}</span><b className="metric-value">{value}</b><span className="metric-note">{trend && <em><ArrowUpRight size={13} />{trend}</em>}{note}</span></article>)}</div>
    <div className="dashboard-grid">
      <section className="workspace-card dashboard-panel cashier-monitor">
        <div className="panel-heading"><div><h2>Cashier monitor</h2><p>Sales and shift status by cashier today.</p></div><button className="text-button" onClick={onViewSales}>View all sales <ArrowRight size={14} /></button></div>
        <div className="table-scroll"><table className="data-table monitor-table"><thead><tr><th>TEAM MEMBER</th><th>SHIFT STATUS</th><th>TRANSACTIONS</th><th>SALES TODAY</th></tr></thead><tbody>{cashierSummary.map(cashier => <tr key={cashier.name}><td><div className="team-member"><span className="avatar team-avatar">{cashier.initials}</span><span><b>{cashier.name}</b><small>{cashier.title} · {cashier.shift}</small></span></div></td><td><span className={`status-pill ${cashier.status === 'On shift' ? 'on-shift' : 'clocked-out'}`}><i />{cashier.status}</span></td><td>{cashier.count}</td><td><b>{format(cashier.total)}</b></td></tr>)}</tbody></table></div>
        <div className="monitor-foot"><span><span className="live-dot" /> Activity updates when a sale is recorded</span><span>Demo shift schedule</span></div>
      </section>
      <section className="workspace-card activity-panel">
        <div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from the shop.</p></div><span className="activity-live"><i /> TODAY</span></div>
        <div className="activity-list">{activities.slice(0, 5).map(activity => <div className="activity-row" key={activity.id}><span className={`activity-icon ${activity.type}`}>
          {activity.type === 'sale' ? <ShoppingCart size={15} /> : activity.type === 'attendance' ? <Clock3 size={15} /> : activity.type === 'leave' ? <CalendarDays size={15} /> : activity.type === 'stock' ? <Package size={15} /> : <PackagePlus size={15} />}
        </span><span className="activity-copy"><b>{activity.title}</b><small>{activity.detail}</small></span><time>{activity.time}</time></div>)}</div>
        <div className="activity-footer"><span>Owner view includes all cashier updates.</span></div>
      </section>
      <section className="workspace-card inventory-alert-panel">
        <div className="panel-heading"><div><h2>Stock to review</h2><p>Products that need a restock check.</p></div><button className="text-button" onClick={onViewInventory}>Inventory <ArrowRight size={14} /></button></div>
        {lowStockProducts.length ? <div className="stock-alert-list">{lowStockProducts.slice(0, 4).map(product => <div className="stock-alert-row" key={product.id}><ProductVisual product={product} small /><span><b>{product.name}</b><small>{product.category}</small></span><strong className={product.stock === 0 ? 'out-of-stock' : ''}>{product.stock} left</strong></div>)}</div> : <div className="clear-stock"><CheckCircle2 size={18} /><span>All products have healthy stock.</span></div>}
      </section>
      <section className="workspace-card dashboard-expiry-panel"><div className="panel-heading"><div><h2>Expiry watch</h2><p>Expired, near-expiry or undated medication lots.</p></div><button className="text-button" onClick={onViewInventory}>Review stock <ArrowRight size={14} /></button></div>{expiryAlerts.length ? <div className="stock-alert-list">{expiryAlerts.slice(0, 4).map(alert => <div className="stock-alert-row expiry-dashboard-row" key={`${alert.product.id}-${alert.batch.id}`}><span className={`expiry-alert-icon ${alert.expired ? 'expired' : ''}`}><AlertTriangle size={15} /></span><span><b>{alert.product.name}</b><small>Lot {alert.batch.lotNumber} · {alert.batch.stock} units</small></span><strong className={alert.expired ? 'out-of-stock' : 'expiry-dashboard-near'}>{alert.expired ? 'Expired' : alert.missing ? 'Date missing' : `${alert.days}d left`}</strong></div>)}</div> : <div className="clear-stock"><CheckCircle2 size={18} /><span>No expired, near-expiry or undated lots.</span></div>}</section>
      <section className="owner-tip-card"><span className="tip-icon"><ShieldCheck size={19} /></span><div><b>Owner controls</b><p>Use Invoices, Reports, and Attendance &amp; leave to review billing and staff activity. Updates save to this browser.</p></div><span className="tip-arrow"><ArrowDownRight size={18} /></span></section>
    </div>
  </section>;
}

function InventoryPage({ products, totalCount, search, setSearch, category, setCategory, expiryAlerts, onAdd, onEdit, onManageBatches }) {
  const lowStockCount = products.filter(product => product.stock <= 5).length;
  const expiredCount = expiryAlerts.filter(alert => alert.expired).length;
  const nearExpiryCount = expiryAlerts.filter(alert => !alert.expired && !alert.missing).length;
  const missingExpiryCount = expiryAlerts.filter(alert => alert.missing).length;
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><Package size={13} /> SHOP CATALOGUE</div><h1>Inventory</h1><p>Manage live stock, lot numbers and medication expiry across the shop.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Add product</button></div>
    <div className="inventory-summary-row"><div><b>{totalCount}</b><span>products in catalogue</span></div><div className={lowStockCount ? 'inventory-alert-text' : ''}><AlertTriangle size={16} /><b>{lowStockCount}</b><span>low stock in view</span></div><div className={expiredCount ? 'inventory-expired-text' : ''}><AlertTriangle size={16} /><b>{expiredCount}</b><span>expired lots</span></div><div className={nearExpiryCount ? 'inventory-near-expiry-text' : ''}><CalendarDays size={16} /><b>{nearExpiryCount}</b><span>near expiry</span></div><div className={missingExpiryCount ? 'inventory-expiry-missing-text' : ''}><CalendarDays size={16} /><b>{missingExpiryCount}</b><span>missing dates</span></div><span className="local-save-note"><ShieldCheck size={15} /> Saves on this device</span></div>
    {expiryAlerts.length > 0 && <section className="workspace-card expiry-alerts-panel"><div className="panel-heading"><div><h2>Expiry watch</h2><p>Expired, undated or due within the next 90 days · check local pharmacy procedures for safe handling.</p></div><span className="expiry-alert-total"><AlertTriangle size={14} />{expiryAlerts.length}</span></div><div className="expiry-alert-list">{expiryAlerts.slice(0, 6).map(alert => <div key={`${alert.product.id}-${alert.batch.id}`} className={`expiry-alert-row ${alert.expired ? 'expired-row' : alert.missing ? 'missing-row' : ''}`}><span className={`expiry-alert-icon ${alert.expired ? 'expired' : ''}`}><AlertTriangle size={16} /></span><span className="expiry-alert-copy"><b>{alert.product.name}</b><small>Lot {alert.batch.lotNumber} · {alert.batch.stock} units · {alert.missing ? 'expiry date not recorded' : `expires ${readableDate(alert.batch.expiry)}`}</small></span><span className={`expiry-status ${alert.expired ? 'expired' : alert.missing ? 'missing' : 'near-expiry'}`}><i />{alert.expired ? 'Expired' : alert.missing ? 'Date missing' : alert.days <= 0 ? 'Expires today' : `${alert.days} days left`}</span></div>)}</div></section>}
    <section className="workspace-card inventory-panel">
      <div className="inventory-toolbar"><label className="search-box inventory-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product, lot or barcode…" aria-label="Search inventory" /></label><label className="category-select"><span className="sr-only">Filter by category</span><select value={category} onChange={event => setCategory(event.target.value)}><option>All products</option>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label></div>
      {products.length ? <div className="table-scroll"><table className="data-table inventory-table"><thead><tr><th>PRODUCT</th><th>BARCODE</th><th>AVAILABLE</th><th>BATCHES / NEXT EXPIRY</th><th>SELLING PRICE</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{products.map(product => {
        const batches = getProductBatches(product).sort((first, second) => (first.expiry || '9999-12-31').localeCompare(second.expiry || '9999-12-31'));
        const nextBatch = batches.find(batch => Number(batch.stock) > 0) || batches[0];
        const physical = getPhysicalStock(product);
        const missingExpiryStock = batches.filter(batch => !batch.expiry).reduce((sum, batch) => sum + Number(batch.stock || 0), 0);
        const noSellableStock = product.stock <= 0 && physical > 0;
        const expiryMissing = noSellableStock && missingExpiryStock > 0;
        const expiredOnly = noSellableStock && !expiryMissing;
        const statusText = expiryMissing ? 'Expiry date missing' : expiredOnly ? 'Expired stock only' : product.stock <= 0 ? 'Out of stock' : product.stock <= 5 ? 'Low stock' : 'In stock';
        const statusTone = expiredOnly ? 'out-pill' : expiryMissing || product.stock <= 5 ? 'low-pill' : product.stock <= 0 ? 'out-pill' : 'in-stock-pill';
        const batchAlert = nextBatch && expiryAlerts.find(alert => alert.product.id === product.id && alert.batch.id === nextBatch.id);
        return <tr key={product.id}><td><div className="inventory-product"><ProductVisual product={product} small /><span><b>{product.name}</b><small>{product.brand || product.category} · {product.category}</small></span></div></td><td className="barcode-cell">{product.barcode || '—'}</td><td><b className={product.stock <= 5 ? 'stock-number low' : 'stock-number'}>{product.stock}</b><span className="units-label"> units</span>{physical > product.stock && <small className="expired-stock-note">{physical - product.stock} held from sale</small>}</td><td><span className="batch-count">{batches.length} lot{batches.length === 1 ? '' : 's'}</span>{nextBatch && <small className={`next-expiry ${batchAlert?.expired ? 'expired' : batchAlert?.missing ? 'missing' : batchAlert ? 'near-expiry' : ''}`}>{nextBatch.lotNumber} · {batchAlert?.missing ? 'No expiry recorded' : readableDate(nextBatch.expiry)}</small>}</td><td><b>{format(product.price)}</b></td><td><span className={`status-pill ${statusTone}`}><i />{statusText}</span></td><td><div className="inventory-row-actions"><button className="edit-product-button" onClick={() => onManageBatches(product)}>Batches</button><button className="edit-product-button" onClick={() => onEdit(product)}>Edit</button></div></td></tr>;
      })}</tbody></table></div> : <EmptyState icon={Package} title="No matching products" detail="Try another filter or add a product to your shop." action="Add product" onAction={onAdd} />}
      <div className="inventory-footer"><span>Showing {products.length} of {totalCount} products</span><span>Checkout removes stock from the earliest unexpired lot first (FEFO).</span></div>
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

function InvoicesPage({ role, currentStaff, sales, onViewInvoice }) {
  const [search, setSearch] = useState('');
  const visibleInvoices = (role === 'owner' ? sales : sales.filter(sale => sale.cashier === currentStaff.name))
    .filter(sale => `${sale.invoiceNumber || sale.id} ${sale.customer || ''} ${sale.cashier || ''}`.toLowerCase().includes(search.toLowerCase().trim()));
  const todayInvoices = visibleInvoices.filter(sale => sale.date === localDateKey());
  const collectedToday = todayInvoices.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const averageInvoice = todayInvoices.length ? collectedToday / todayInvoices.length : 0;
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><FileText size={13} /> BILLING WORKSPACE</div><h1>Invoices &amp; billing</h1><p>{role === 'owner' ? 'Review customer invoices and payments across the shop.' : 'View invoices created from your completed sales.'}</p></div><button className="outline-button invoice-export-button" onClick={() => downloadSalesCsv(visibleInvoices, 'posi-invoices')}><Download size={15} /> Export invoices</button></div>
    <div className="invoice-metrics"><article><span className="invoice-metric-icon"><FileText size={17} /></span><span><small>INVOICES TODAY</small><b>{todayInvoices.length}</b></span></article><article><span className="invoice-metric-icon collected"><Wallet size={17} /></span><span><small>COLLECTED TODAY</small><b>{format(collectedToday)}</b></span></article><article><span className="invoice-metric-icon average"><TrendingUp size={17} /></span><span><small>AVERAGE INVOICE</small><b>{format(averageInvoice)}</b></span></article></div>
    <section className="workspace-card invoice-panel">
      <div className="panel-heading invoice-panel-heading"><div><h2>{role === 'owner' ? 'All invoices' : 'My invoices'}</h2><p>Each paid sale creates a printable invoice.</p></div><span className="sales-count-chip">{visibleInvoices.length} invoices</span></div>
      <div className="invoice-toolbar"><label className="search-box invoice-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search invoice, customer or cashier…" aria-label="Search invoices" /></label><span className="paid-filter"><i /> Paid invoices</span></div>
      {visibleInvoices.length ? <div className="table-scroll"><table className="data-table invoice-table"><thead><tr><th>INVOICE</th><th>ISSUED</th><th>CUSTOMER</th><th>CASHIER</th><th>PAYMENT</th><th>AMOUNT</th><th>STATUS</th><th></th></tr></thead><tbody>{visibleInvoices.map(sale => <tr key={sale.id}><td><b className="invoice-number">{sale.invoiceNumber || sale.id.replace('POS', 'INV')}</b><small className="table-subline">{sale.id}</small></td><td><b>{sale.date === localDateKey() ? 'Today' : readableDate(sale.date)}</b><small className="table-subline">{sale.time}</small></td><td>{sale.customer || 'Walk-in customer'}</td><td>{sale.cashier}</td><td><span className="payment-tag">{sale.payment === 'Mobile Money' ? 'MoMo' : sale.payment}</span></td><td><b>{format(sale.total)}</b></td><td><span className="status-pill in-stock-pill"><i />Paid</span></td><td><button className="invoice-view-button" onClick={() => onViewInvoice(sale)}>View</button></td></tr>)}</tbody></table></div> : <EmptyState icon={FileText} title="No invoices found" detail="Completed and paid sales will appear here as invoices." />}
      <div className="inventory-footer"><span>Showing {visibleInvoices.length} invoices</span><span>Invoices are saved with the cashier and payment details.</span></div>
    </section>
  </section>;
}

function InvoiceDetailsModal({ sale, onClose }) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const subtotal = Number(sale.subtotal ?? (Number(sale.total || 0) + Number(sale.discountAmount || 0)));
  const discountAmount = Number(sale.discountAmount || 0);
  return <div className="modal-backdrop invoice-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="invoice-detail-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-detail-title">
    <header className="invoice-detail-header"><div className="invoice-brand"><span className="brand-mark"><Plus size={18} strokeWidth={3} /></span><span><b>Green Cross Pharmacy</b><small>Accra, Ghana · Customer invoice</small></span></div><button className="modal-close" onClick={onClose} aria-label="Close invoice"><X size={18} /></button></header>
    <div className="invoice-detail-title-row"><div><span className="modal-eyebrow">PAID INVOICE</span><h2 id="invoice-detail-title">{sale.invoiceNumber || sale.id.replace('POS', 'INV')}</h2><p>Issued {readableDate(sale.date)} at {sale.time}</p></div><span className="status-pill in-stock-pill"><i />Paid</span></div>
    <div className="invoice-parties"><div><small>BILL TO</small><b>{sale.customer || 'Walk-in customer'}</b></div><div><small>ISSUED BY</small><b>{sale.cashier}</b></div><div><small>PAYMENT</small><b>{sale.payment === 'Mobile Money' ? 'Mobile Money (MoMo)' : sale.payment}</b></div></div>
    <div className="table-scroll"><table className="invoice-line-table"><thead><tr><th>PRODUCT</th><th>QTY</th><th>UNIT PRICE</th><th>LINE TOTAL</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={`${item.productId || item.name}-${index}`}><td>{item.name}{item.batchLots?.length > 0 && <small className="invoice-lot-note">Lot{item.batchLots.length === 1 ? '' : 's'}: {item.batchLots.map(batch => `${batch.lotNumber} × ${batch.quantity}`).join(', ')}</small>}</td><td>{item.quantity}</td><td>{format(item.unitPrice)}</td><td>{format(item.lineTotal ?? item.quantity * item.unitPrice)}</td></tr>) : <tr><td colSpan="4" className="no-line-items">Item details were not saved for this older demo transaction.</td></tr>}</tbody></table></div>
    <div className="invoice-totals"><div><span>Subtotal</span><b>{format(subtotal)}</b></div>{discountAmount > 0 && <div><span>Discount</span><b>− {format(discountAmount)}</b></div>}<div className="invoice-grand-total"><span>Total paid</span><b>{format(sale.total)}</b></div></div>
    <footer className="invoice-detail-footer"><span><ShieldCheck size={13} />Thank you for choosing Green Cross Pharmacy.</span><button className="primary-button" onClick={() => window.print()}><Printer size={15} /> Print invoice</button></footer>
  </section></div>;
}

function downloadSalesCsv(sales, prefix = 'posi-sales') {
  const header = ['Invoice', 'Date', 'Time', 'Cashier', 'Customer', 'Item count', 'Item details', 'Payment', 'Subtotal', 'Discount', 'Total'];
  const rows = sales.map(sale => [
    sale.invoiceNumber || sale.id.replace('POS', 'INV'),
    sale.date,
    sale.time,
    sale.cashier,
    sale.customer || 'Walk-in customer',
    sale.itemCount,
    (sale.items || []).map(item => `${item.name} x${item.quantity} @ ${format(item.unitPrice)}${item.batchLots?.length ? ` [lots: ${item.batchLots.map(batch => `${batch.lotNumber} x${batch.quantity}`).join('; ')}]` : ''}`).join('; '),
    sale.payment,
    Number(sale.subtotal ?? sale.total ?? 0).toFixed(2),
    Number(sale.discountAmount || 0).toFixed(2),
    Number(sale.total || 0).toFixed(2),
  ]);
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${localDateKey()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportsPage({ sales }) {
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    const daySales = sales.filter(sale => sale.date === key);
    return { date, key, sales: daySales, total: daySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) };
  });
  const recentSales = sales.filter(sale => sale.date >= weekDays[0].key && sale.date <= localDateKey(today));
  const weekTotal = recentSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const todaySales = recentSales.filter(sale => sale.date === localDateKey(today));
  const maxDayTotal = Math.max(1, ...weekDays.map(day => day.total));
  const averageSale = recentSales.length ? weekTotal / recentSales.length : 0;
  const paymentBreakdown = ['Cash', 'Mobile Money', 'Card'].map(method => ({ method, count: recentSales.filter(sale => sale.payment === method).length, total: recentSales.filter(sale => sale.payment === method).reduce((sum, sale) => sum + Number(sale.total || 0), 0) }));
  const totalPaymentSales = paymentBreakdown.reduce((sum, item) => sum + item.total, 0);
  const productTotals = new Map();
  recentSales.forEach(sale => (sale.items || []).forEach(item => {
    const current = productTotals.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
    current.quantity += Number(item.quantity || 0);
    current.revenue += Number(item.lineTotal || item.quantity * item.unitPrice || 0);
    productTotals.set(item.name, current);
  }));
  const topProducts = [...productTotals.values()].sort((first, second) => second.quantity - first.quantity).slice(0, 5);
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><BarChart3 size={13} /> BUSINESS REPORTS · LAST 7 DAYS</div><h1>Reports</h1><p>Track revenue, payment mix, and products sold at Green Cross Pharmacy.</p></div><button className="outline-button report-export-button" onClick={() => downloadSalesCsv(recentSales)}><Download size={15} /> Export CSV</button></div>
    <div className="metrics-grid report-metrics-grid">
      <article className="metric-card"><span className="metric-icon green"><Wallet size={18} /></span><span className="metric-label">Revenue · 7 days</span><b className="metric-value">{format(weekTotal)}</b><span className="metric-note">{recentSales.length} paid invoices</span></article>
      <article className="metric-card"><span className="metric-icon blue"><FileText size={18} /></span><span className="metric-label">Invoices today</span><b className="metric-value">{todaySales.length}</b><span className="metric-note">{format(todaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0))} collected</span></article>
      <article className="metric-card"><span className="metric-icon violet"><TrendingUp size={18} /></span><span className="metric-label">Average invoice</span><b className="metric-value">{format(averageSale)}</b><span className="metric-note">Based on the last 7 days</span></article>
    </div>
    <div className="reports-grid">
      <section className="workspace-card report-panel sales-chart-panel"><div className="panel-heading"><div><h2>Sales over time</h2><p>Paid invoice totals, by day.</p></div><span className="chart-total"><small>7-DAY TOTAL</small><b>{format(weekTotal)}</b></span></div>
        <div className="chart-legend"><span><i /> Daily revenue</span><span>GH₵</span></div>
        <div className="sales-bar-chart">{weekDays.map(day => <div className="sales-bar-column" key={day.key}><span className="bar-value">{day.total ? format(day.total) : ''}</span><div className="bar-track"><i style={{ height: `${day.total ? Math.max(7, (day.total / maxDayTotal) * 100) : 0}%` }} /></div><small>{day.date.toLocaleDateString('en-GH', { weekday: 'short' })}</small></div>)}</div>
      </section>
      <section className="workspace-card report-panel payment-report"><div className="panel-heading"><div><h2>Payment methods</h2><p>How customers paid.</p></div><CreditCard size={17} className="report-heading-icon" /></div>
        <div className="payment-report-list">{paymentBreakdown.map(item => <div className="payment-report-row" key={item.method}><div className="payment-report-label"><span>{item.method === 'Mobile Money' ? 'Mobile Money' : item.method}</span><b>{format(item.total)}</b></div><div className="payment-progress"><i style={{ width: `${totalPaymentSales ? (item.total / totalPaymentSales) * 100 : 0}%` }} /></div><small>{item.count} {item.count === 1 ? 'invoice' : 'invoices'}</small></div>)}</div>
      </section>
      <section className="workspace-card report-panel top-products-panel"><div className="panel-heading"><div><h2>Best-selling products</h2><p>Units sold from recorded invoices.</p></div><Package size={17} className="report-heading-icon" /></div>
        {topProducts.length ? <div className="top-products-list">{topProducts.map((product, index) => <div className="top-product-row" key={product.name}><span className="top-product-rank">{String(index + 1).padStart(2, '0')}</span><span className="top-product-copy"><b>{product.name}</b><small>{product.quantity} units sold</small></span><strong>{format(product.revenue)}</strong></div>)}</div> : <div className="report-empty"><ShoppingBag size={18} /><span>Product sales details will appear after invoices are recorded.</span></div>}
      </section>
      <section className="report-note-card"><span className="tip-icon"><ShieldCheck size={18} /></span><div><b>Report data</b><p>Reports use completed invoices saved in this demo browser. Export the current 7-day view as a CSV file.</p></div></section>
    </div>
  </section>;
}

function shiftDuration(entry) {
  if (!entry?.clockIn) return '—';
  const toMinutes = value => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const endTime = entry.clockOut || clockTime(new Date());
  const minutes = Math.max(0, toMinutes(endTime) - toMinutes(entry.clockIn));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusClass(status) {
  if (status === 'On shift') return 'on-shift';
  if (status === 'Approved') return 'leave-approved';
  if (status === 'Declined') return 'leave-declined';
  if (status === 'Pending') return 'leave-pending';
  return 'clocked-out';
}

function AttendancePage({ role, currentStaff, attendance, leaveRequests, onClockToggle, onSubmitLeave, onReviewLeave }) {
  return role === 'owner'
    ? <OwnerAttendancePage attendance={attendance} leaveRequests={leaveRequests} onReviewLeave={onReviewLeave} />
    : <CashierAttendancePage currentStaff={currentStaff} attendance={attendance} leaveRequests={leaveRequests} onClockToggle={onClockToggle} onSubmitLeave={onSubmitLeave} />;
}

function OwnerAttendancePage({ attendance, leaveRequests, onReviewLeave }) {
  const today = localDateKey();
  const todaysRecords = attendance.filter(record => record.date === today);
  const onShiftCount = todaysRecords.filter(record => record.status === 'On shift').length;
  const pendingRequests = leaveRequests.filter(request => request.status === 'Pending');
  const recentAttendance = [...attendance].sort((first, second) => `${second.date} ${second.clockIn || ''}`.localeCompare(`${first.date} ${first.clockIn || ''}`)).slice(0, 12);
  const metrics = [
    { label: 'Shifts recorded today', value: String(todaysRecords.length), Icon: Users, tone: 'blue' },
    { label: 'Currently on shift', value: String(onShiftCount), Icon: Clock3, tone: 'green' },
    { label: 'Leave to review', value: String(pendingRequests.length), Icon: CalendarDays, tone: pendingRequests.length ? 'amber' : 'violet' },
  ];
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><CalendarDays size={13} /> PEOPLE &amp; SCHEDULING</div><h1>Attendance &amp; leave</h1><p>Monitor staff shifts and manage leave requests.</p></div><span className="open-shift-badge"><span />Today · {readableDate(today)}</span></div>
    <div className="attendance-metrics">{metrics.map(({ label, value, Icon, tone }) => <article className="attendance-metric" key={label}><span className={`metric-icon ${tone}`}><Icon size={17} /></span><span><small>{label}</small><b>{value}</b></span></article>)}</div>
    <div className="attendance-owner-grid">
      <section className="workspace-card attendance-panel"><div className="panel-heading"><div><h2>Today's attendance</h2><p>Clock-in status for your cashier team.</p></div><span className="activity-live"><i /> TODAY</span></div>
        <div className="table-scroll"><table className="data-table attendance-table"><thead><tr><th>TEAM MEMBER</th><th>STATUS</th><th>CLOCK IN</th><th>CLOCK OUT</th><th>HOURS</th></tr></thead><tbody>{cashiers.map(cashier => {
          const entry = todaysRecords.filter(record => record.staff === cashier.name).at(-1);
          const status = entry?.status || 'Not clocked in';
          return <tr key={cashier.name}><td><div className="team-member"><span className="avatar team-avatar">{cashier.initials}</span><span><b>{cashier.name}</b><small>{cashier.title} · {cashier.shift}</small></span></div></td><td><span className={`status-pill ${statusClass(status)}`}><i />{status}</span></td><td>{entry?.clockIn || '—'}</td><td>{entry?.clockOut || '—'}</td><td><b>{entry ? shiftDuration(entry) : '—'}</b></td></tr>;
        })}</tbody></table></div>
        <div className="attendance-panel-foot"><Clock3 size={13} />Times are saved locally in this demo.</div>
      </section>
      <section className="workspace-card leave-review-panel"><div className="panel-heading"><div><h2>Leave requests</h2><p>Review team requests and dates.</p></div><span className="request-count">{pendingRequests.length} pending</span></div>
        {leaveRequests.length ? <div className="leave-request-list">{leaveRequests.map(request => <article className="leave-request-card" key={request.id}><div className="leave-request-top"><span className="leave-request-icon"><CalendarDays size={15} /></span><span className="leave-request-person"><b>{request.staff}</b><small>{request.type}</small></span><span className={`status-pill ${statusClass(request.status)}`}><i />{request.status}</span></div><div className="leave-request-dates">{readableDate(request.startDate)} <ArrowRight size={12} /> {readableDate(request.endDate)}</div><p>{request.reason}</p>{request.status === 'Pending' && <div className="leave-review-actions"><button className="decline-leave-button" onClick={() => onReviewLeave(request.id, 'Declined')}>Decline</button><button className="approve-leave-button" onClick={() => onReviewLeave(request.id, 'Approved')}><Check size={13} /> Approve</button></div>}</article>)}</div> : <EmptyState icon={CalendarDays} title="No leave requests" detail="New staff requests will appear here." />}
      </section>
    </div>
    <section className="workspace-card owner-attendance-history-panel"><div className="panel-heading"><div><h2>Recent attendance</h2><p>Clock-in and clock-out history for the team.</p></div><span className="sales-count-chip">{attendance.length} records</span></div>
      {recentAttendance.length ? <div className="table-scroll"><table className="data-table attendance-history-table"><thead><tr><th>DATE</th><th>TEAM MEMBER</th><th>SHIFT STATUS</th><th>CLOCK IN</th><th>CLOCK OUT</th><th>HOURS</th></tr></thead><tbody>{recentAttendance.map(record => {
        const staff = cashiers.find(cashier => cashier.name === record.staff) || { initials: 'ST', title: 'Staff' };
        return <tr key={record.id}><td><b>{record.date === today ? 'Today' : readableDate(record.date)}</b></td><td><div className="team-member"><span className="avatar team-avatar">{staff.initials}</span><span><b>{record.staff}</b><small>{staff.title}</small></span></div></td><td><span className={`status-pill ${statusClass(record.status)}`}><i />{record.status}</span></td><td>{record.clockIn || '—'}</td><td>{record.clockOut || '—'}</td><td><b>{shiftDuration(record)}</b></td></tr>;
      })}</tbody></table></div> : <EmptyState icon={Clock3} title="No attendance yet" detail="Cashier clock-in records will appear here." />}
    </section>
  </section>;
}

function CashierAttendancePage({ currentStaff, attendance, leaveRequests, onClockToggle, onSubmitLeave }) {
  const today = localDateKey();
  const myAttendance = attendance.filter(record => record.staff === currentStaff.name).sort((first, second) => second.date.localeCompare(first.date));
  const todayEntry = myAttendance.find(record => record.date === today);
  const myLeave = leaveRequests.filter(request => request.staff === currentStaff.name).sort((first, second) => second.submittedDate.localeCompare(first.submittedDate));
  const pendingCount = myLeave.filter(request => request.status === 'Pending').length;
  const shiftActive = todayEntry?.status === 'On shift';
  const shiftComplete = todayEntry?.status === 'Clocked out';
  return <section className="page-section">
    <div className="page-heading"><div><div className="eyebrow"><CalendarDays size={13} /> MY STAFF WORKSPACE</div><h1>Attendance &amp; leave</h1><p>Clock your shift and send leave requests to the owner.</p></div><span className="open-shift-badge"><span />{shiftActive ? 'On shift' : shiftComplete ? 'Shift completed' : 'Not clocked in'}</span></div>
    <div className="cashier-attendance-grid">
      <section className="workspace-card clock-card"><div className="clock-card-top"><span className="clock-card-icon"><Clock3 size={19} /></span><span className={`status-pill ${statusClass(todayEntry?.status || 'Not clocked in')}`}><i />{todayEntry?.status || 'Not clocked in'}</span></div><span className="clock-card-label">TODAY'S SHIFT</span><b className="clock-card-time">{todayEntry?.clockIn || '—'} <span>→</span> {todayEntry?.clockOut || (shiftActive ? 'In progress' : '—')}</b><span className="clock-card-date">{displayDate(new Date())}{todayEntry ? ` · ${shiftDuration(todayEntry)}` : ''}</span><button className={`clock-action-button ${shiftActive ? 'clock-out-action' : ''}`} onClick={onClockToggle} disabled={shiftComplete}>{shiftActive ? 'Clock out' : shiftComplete ? 'Shift complete for today' : 'Clock in'}<ArrowRight size={15} /></button></section>
      <section className="workspace-card leave-balance-card"><span className="leave-balance-icon"><CalendarDays size={18} /></span><span className="leave-balance-label">MY LEAVE REQUESTS</span><b>{myLeave.length}</b><small>{pendingCount ? `${pendingCount} waiting for owner review` : 'No requests awaiting review'}</small><span className="leave-balance-footer"><ShieldCheck size={13} />Owner will review your request.</span></section>
    </div>
    <div className="cashier-attendance-grid cashier-lower-grid">
      <section className="workspace-card attendance-history-panel"><div className="panel-heading"><div><h2>My recent attendance</h2><p>Clock-in records for your account.</p></div></div>
        {myAttendance.length ? <div className="table-scroll"><table className="data-table cashier-history-table"><thead><tr><th>DATE</th><th>CLOCK IN</th><th>CLOCK OUT</th><th>HOURS</th><th>STATUS</th></tr></thead><tbody>{myAttendance.slice(0, 7).map(record => <tr key={record.id}><td><b>{record.date === today ? 'Today' : readableDate(record.date)}</b></td><td>{record.clockIn}</td><td>{record.clockOut || '—'}</td><td>{shiftDuration(record)}</td><td><span className={`status-pill ${statusClass(record.status)}`}><i />{record.status}</span></td></tr>)}</tbody></table></div> : <EmptyState icon={Clock3} title="No attendance yet" detail="Clock in to start recording your shift." />}
      </section>
      <LeaveRequestForm onSubmit={onSubmitLeave} />
      <section className="workspace-card cashier-leave-list"><div className="panel-heading"><div><h2>My leave requests</h2><p>See approval status and requested dates.</p></div></div>
        {myLeave.length ? <div className="my-leave-rows">{myLeave.map(request => <div className="my-leave-row" key={request.id}><span className="leave-request-icon"><CalendarDays size={15} /></span><span className="my-leave-copy"><b>{request.type}</b><small>{readableDate(request.startDate)} – {readableDate(request.endDate)} · {request.reason}</small></span><span className={`status-pill ${statusClass(request.status)}`}><i />{request.status}</span></div>)}</div> : <div className="report-empty"><CalendarDays size={17} /><span>You have not requested leave yet.</span></div>}
      </section>
    </div>
  </section>;
}

function LeaveRequestForm({ onSubmit }) {
  const [type, setType] = useState('Annual leave');
  const [startDate, setStartDate] = useState(() => dateAfterDays(1));
  const [endDate, setEndDate] = useState(() => dateAfterDays(1));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = event => {
    event.preventDefault();
    if (!startDate || !endDate || endDate < startDate) {
      setError('Choose an end date on or after the start date.');
      return;
    }
    if (!reason.trim()) {
      setError('Please add a short reason for your request.');
      return;
    }
    onSubmit({ type, startDate, endDate, reason: reason.trim() });
    setReason('');
    setError('');
  };
  return <section className="workspace-card leave-form-panel"><div className="panel-heading"><div><h2>Request leave</h2><p>Send a date range and reason to the owner.</p></div><span className="leave-form-icon"><CalendarDays size={16} /></span></div>
    <form className="leave-request-form" onSubmit={submit}><label>Leave type<select value={type} onChange={event => setType(event.target.value)}><option>Annual leave</option><option>Sick leave</option><option>Personal leave</option><option>Other</option></select></label><div className="leave-date-fields"><label>Start date<input type="date" min={localDateKey()} value={startDate} onChange={event => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} required /></label><label>End date<input type="date" min={startDate || localDateKey()} value={endDate} onChange={event => setEndDate(event.target.value)} required /></label></div><label>Reason<textarea value={reason} onChange={event => { setReason(event.target.value); setError(''); }} placeholder="Add a brief reason" rows="3" maxLength="180" /></label>{error && <span className="leave-form-error">{error}</span>}<button className="primary-button leave-submit-button" type="submit"><CalendarDays size={14} />Send request</button></form>
  </section>;
}

function EmptyState({ icon: Icon, title, detail, action, onAction }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon size={23} /></span><b>{title}</b><p>{detail}</p>{action && <button className="outline-button" onClick={onAction}><Plus size={15} />{action}</button>}</div>;
}

function ProductFormModal({ initialProduct, onClose, onSave, onManageBatches }) {
  const firstBatch = initialProduct ? getProductBatches(initialProduct)[0] : null;
  const [name, setName] = useState(initialProduct?.name || '');
  const [brand, setBrand] = useState(initialProduct?.brand || '');
  const [category, setCategory] = useState(initialProduct?.category || categories[0]);
  const [price, setPrice] = useState(initialProduct?.price ?? '');
  const [stock, setStock] = useState(initialProduct ? getPhysicalStock(initialProduct) : '');
  const [barcode, setBarcode] = useState(initialProduct?.barcode || '');
  const [lotNumber, setLotNumber] = useState(firstBatch?.lotNumber || '');
  const [expiry, setExpiry] = useState(normalizeExpiryDate(firstBatch?.expiry || initialProduct?.expiry || ''));
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
    if (!name.trim() || price === '' || Number(price) < 0) return;
    if (!initialProduct && (!lotNumber.trim() || !expiry || stock === '' || Number(stock) < 0)) return;
    const batches = initialProduct ? getProductBatches(initialProduct) : [{
      id: `batch-${Date.now()}`,
      lotNumber: lotNumber.trim(),
      stock: Math.floor(Number(stock)),
      expiry: normalizeExpiryDate(expiry),
    }];
    const sortedBatches = [...batches].sort((first, second) => (first.expiry || '9999-12-31').localeCompare(second.expiry || '9999-12-31'));
    const product = {
      ...(initialProduct || {}),
      id: initialProduct?.id || `product-${Date.now()}`,
      name: name.trim(),
      brand: brand.trim() || category,
      category,
      price: Number(price),
      stock: batches.reduce((sum, batch) => sum + Number(batch.stock || 0), 0),
      batches,
      batchNumber: sortedBatches[0]?.lotNumber || '',
      barcode: barcode.trim(),
      expiry: sortedBatches[0]?.expiry || '',
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
        <div className="form-two-col"><div className="form-field"><label className="form-label" htmlFor="product-price">Selling price <b>*</b></label><span className="input-prefix"><span>GH₵</span><input id="product-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="0.00" required /></span></div><div className="form-field"><label className="form-label" htmlFor="product-barcode">Barcode <small>Optional</small></label><input id="product-barcode" value={barcode} onChange={event => setBarcode(event.target.value)} placeholder="Enter or scan a barcode" maxLength={40} /></div></div>
        {initialProduct ? <div className="batch-summary-card"><span><Package size={17} /><b>{getPhysicalStock(initialProduct)} units</b><small>across {getProductBatches(initialProduct).length} batch{getProductBatches(initialProduct).length === 1 ? '' : 'es'}</small></span><button type="button" className="outline-button" onClick={() => onManageBatches(initialProduct)}>Manage batches <ArrowRight size={14} /></button></div> : <><div className="form-two-col"><div className="form-field"><label className="form-label" htmlFor="product-stock">Opening quantity <b>*</b></label><input id="product-stock" type="number" inputMode="numeric" min="0" step="1" value={stock} onChange={event => setStock(event.target.value)} placeholder="0" required /></div><div className="form-field"><label className="form-label" htmlFor="product-lot">Batch / lot number <b>*</b></label><input id="product-lot" value={lotNumber} onChange={event => setLotNumber(event.target.value)} placeholder="e.g. AMX-2026-01" required maxLength={40} /></div></div><div className="form-field"><label className="form-label" htmlFor="product-expiry">Batch expiry date <b>*</b></label><input id="product-expiry" type="date" value={expiry} onChange={event => setExpiry(event.target.value)} required /></div></>}
        <p className="photo-storage-hint"><ShieldCheck size={14} />Product details and photo stay in this browser in the demo.</p>
      </div>
      <div className="form-modal-footer"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={savingPhoto}><Check size={16} />{initialProduct ? 'Save changes' : 'Save product'}</button></div>
    </form>
  </section></div>;
}

function BatchManagerModal({ product, onClose, onSave }) {
  const [batches, setBatches] = useState(() => getProductBatches(product).map((batch, index) => ({ ...batch, id: batch.id || `batch-${product.id}-${index}` })));
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState('');
  const totalStock = batches.reduce((sum, batch) => sum + Math.max(0, Number(batch.stock || 0)), 0);

  const updateBatch = (id, field, value) => setBatches(previous => previous.map(batch => batch.id === id ? { ...batch, [field]: field === 'stock' ? Math.max(0, Math.floor(Number(value) || 0)) : field === 'expiry' ? normalizeExpiryDate(value) : value } : batch));
  const addBatch = event => {
    event.preventDefault();
    const cleanLot = lotNumber.trim();
    if (!cleanLot || !expiry || quantity === '' || Number(quantity) < 0) {
      setError('Enter a lot number, expiry date and non-negative quantity.');
      return;
    }
    if (batches.some(batch => batch.lotNumber.toLowerCase() === cleanLot.toLowerCase())) {
      setError('That lot number is already listed for this product.');
      return;
    }
    setBatches(previous => [...previous, { id: `batch-${Date.now()}`, lotNumber: cleanLot, stock: Math.floor(Number(quantity)), expiry: normalizeExpiryDate(expiry) }]);
    setLotNumber('');
    setQuantity('');
    setExpiry('');
    setError('');
  };
  const save = () => {
    if (batches.some(batch => !batch.lotNumber.trim() || !batch.expiry)) {
      setError('Every batch needs a lot number and expiry date.');
      return;
    }
    const normalizedLots = batches.map(batch => batch.lotNumber.trim().toLowerCase());
    if (new Set(normalizedLots).size !== normalizedLots.length) {
      setError('Lot numbers must be unique within this product.');
      return;
    }
    onSave(batches.map(batch => ({ ...batch, lotNumber: batch.lotNumber.trim(), stock: Math.max(0, Math.floor(Number(batch.stock) || 0)), expiry: normalizeExpiryDate(batch.expiry) })));
  };

  return <div className="modal-backdrop batch-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="batch-manager-modal" role="dialog" aria-modal="true" aria-labelledby="batch-modal-title">
    <div className="form-modal-header"><span className="form-modal-icon"><Package size={20} /></span><span className="form-modal-heading"><span className="modal-eyebrow">INVENTORY · LOT TRACKING</span><h2 id="batch-modal-title">Manage batches</h2><p>{product.name} · {totalStock} total units across {batches.length} lots</p></span><button className="modal-close" onClick={onClose} aria-label="Close batch manager"><X size={19} /></button></div>
    <div className="batch-manager-body">
      {batches.length ? <div className="batch-table-scroll"><table className="data-table batch-table"><thead><tr><th>BATCH / LOT</th><th>QUANTITY</th><th>EXPIRY DATE</th><th>STATUS</th><th><span className="sr-only">Remove batch</span></th></tr></thead><tbody>{batches.map(batch => {
        const missing = !batch.expiry;
        const expired = !missing && batch.expiry < localDateKey();
        const days = missing ? Infinity : Math.ceil((new Date(`${batch.expiry}T00:00:00`) - new Date(`${localDateKey()}T00:00:00`)) / 86400000);
        const status = expired ? 'Expired' : missing ? 'Missing expiry' : days <= 90 ? 'Near expiry' : 'Usable';
        return <tr key={batch.id}><td><input aria-label={`${batch.lotNumber} lot number`} value={batch.lotNumber} onChange={event => updateBatch(batch.id, 'lotNumber', event.target.value)} /></td><td><input aria-label={`${batch.lotNumber} quantity`} type="number" inputMode="numeric" min="0" step="1" value={batch.stock} onChange={event => updateBatch(batch.id, 'stock', event.target.value)} /></td><td><input aria-label={`${batch.lotNumber} expiry date`} type="date" value={normalizeExpiryDate(batch.expiry)} onChange={event => updateBatch(batch.id, 'expiry', event.target.value)} /></td><td><span className={`expiry-status ${expired ? 'expired' : missing ? 'missing' : days <= 90 ? 'near-expiry' : 'usable'}`}><i />{status}</span></td><td><button type="button" className="batch-remove-button" onClick={() => setBatches(previous => previous.filter(entry => entry.id !== batch.id))} aria-label={`Remove batch ${batch.lotNumber}`}><X size={15} /></button></td></tr>;
      })}</tbody></table></div> : <div className="report-empty"><Package size={18} /><span>No batches yet. Add a lot below to make this product available for sale.</span></div>}
      <form className="add-batch-form" onSubmit={addBatch}><div className="batch-section-heading"><span><b>Add incoming batch</b><small>Stock receives its own lot and expiry record.</small></span><PackagePlus size={16} /></div><div className="batch-entry-fields"><label>Lot / batch number<input value={lotNumber} onChange={event => { setLotNumber(event.target.value); setError(''); }} placeholder="e.g. AMX-2026-02" maxLength={40} /></label><label>Quantity<input type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }} placeholder="0" /></label><label>Expiry date<input type="date" value={expiry} onChange={event => { setExpiry(event.target.value); setError(''); }} /></label><button type="submit" className="outline-button"><Plus size={15} />Add lot</button></div>{error && <span className="batch-form-error">{error}</span>}</form>
      <p className="batch-fefo-note"><ShieldCheck size={14} />Checkout uses the earliest unexpired batch first. Expired units remain visible here, but cannot be sold.</p>
    </div>
    <div className="form-modal-footer"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={save}><Check size={16} />Save batch stock</button></div>
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
