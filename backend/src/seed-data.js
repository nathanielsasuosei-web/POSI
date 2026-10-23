// Demo dataset for Green Cross Drug Store. Mirrors the starter data the app
// ships with so a fresh database looks identical to a fresh browser.

const iso = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

export const seedData = () => ({
  employees: [
    { id: 'e1', name: 'Abena Mensah', role: 'owner', phone: '0244000001', email: 'owner@shop.com', shift: '08:00-17:00', status: 'On shift', salary: 0, initials: 'AM' },
    { id: 'e2', name: 'Ama Boateng', role: 'cashier', phone: '0244000002', email: 'ama@shop.com', shift: '08:00-16:00', status: 'On shift', salary: 1800, initials: 'AB' },
    { id: 'e3', name: 'Kwame Owusu', role: 'cashier', phone: '0244000003', email: 'kwame@shop.com', shift: '09:00-17:00', status: 'On shift', salary: 1700, initials: 'KO' },
  ],

  customers: [
    { id: 'c1', name: 'Walk-in customer', phone: '', email: '', address: '', balance: 0, totalSpent: 0, visits: 0, isWalkIn: true },
    { id: 'c2', name: 'Akosua Boateng', phone: '0244123456', email: 'akosua@example.com', address: 'East Legon, Accra', balance: 120, totalSpent: 1250, visits: 18 },
    { id: 'c3', name: 'Kwame Asare', phone: '0207654321', email: 'kwame@example.com', address: 'Spintex, Accra', balance: 0, totalSpent: 890, visits: 12 },
    { id: 'c4', name: 'Ama Serwaa', phone: '0551234567', email: 'ama@example.com', address: 'Tema', balance: 250, totalSpent: 2100, visits: 24 },
    { id: 'c5', name: 'Joseph Mensah', phone: '0249988776', email: 'joseph@example.com', address: 'Madina, Accra', balance: 45.5, totalSpent: 560, visits: 8 },
  ],

  products: [
    { id: 'p1', name: 'Paracetamol 500mg', sku: 'PARA-500', category: 'Pain Relief', price: 12.5, cost: 7, stock: 48, barcode: '890123', color: 'mint', brand: '20 tablets', supplier: 'Ernest Chemists', lowStockAt: 5 },
    { id: 'p2', name: 'Ibuprofen 400mg', sku: 'IBU-400', category: 'Pain Relief', price: 18, cost: 11, stock: 28, barcode: '890124', color: 'peach', brand: '20 tablets', supplier: 'Ernest Chemists', lowStockAt: 5 },
    { id: 'p3', name: 'Amoxicillin 500mg', sku: 'AMOX-500', category: 'Antibiotics', price: 35, cost: 22, stock: 24, barcode: '890125', color: 'blue', brand: '21 capsules', supplier: 'M&G Pharma', lowStockAt: 5 },
    { id: 'p4', name: 'Coartem 20/120', sku: 'COART-24', category: 'Antimalarials', price: 85, cost: 62, stock: 19, barcode: '890126', color: 'peach', brand: '24 tablets', supplier: 'Novartis GH', lowStockAt: 5 },
    { id: 'p5', name: 'Malaria Test Kit', sku: 'MAL-TEST', category: 'Devices', price: 25, cost: 16, stock: 7, barcode: '890127', color: 'violet', brand: 'SD Bioline', supplier: 'Lab Supplies Ltd', lowStockAt: 10 },
    { id: 'p6', name: 'ORS Sachet', sku: 'ORS-SACH', category: 'First Aid', price: 6, cost: 3.5, stock: 33, barcode: '890128', color: 'blue', brand: 'Cerlyte', supplier: 'Uniliver Ghana', lowStockAt: 10 },
    { id: 'p7', name: 'Vitamin C 1000mg', sku: 'VITC-1000', category: 'Vitamins', price: 45, cost: 32, stock: 51, barcode: '890129', color: 'mint', brand: '60 tablets', supplier: 'Vita Health', lowStockAt: 5 },
    { id: 'p8', name: 'Digital Thermometer', sku: 'THERM-D', category: 'Devices', price: 42, cost: 26, stock: 22, barcode: '890130', color: 'violet', brand: 'CarePlus', supplier: 'Lab Supplies Ltd', lowStockAt: 4 },
    { id: 'p9', name: 'Cough Syrup 100ml', sku: 'COUGH-100', category: 'Cough & Cold', price: 22, cost: 14, stock: 48, barcode: '890131', color: 'mint', brand: 'Cofex', supplier: 'M&G Pharma', lowStockAt: 6 },
    { id: 'p10', name: 'Baby Diapers Size 3', sku: 'DIAP-3', category: 'Baby & Mother', price: 65, cost: 48, stock: 3, barcode: '890132', color: 'peach', brand: 'Pampers Care', supplier: 'Uniliver Ghana', lowStockAt: 8 },
    { id: 'p11', name: 'Antiseptic Cream 30g', sku: 'ANTIS-30', category: 'Personal Care', price: 24, cost: 16, stock: 60, barcode: '890133', color: 'blue', brand: 'Savlon', supplier: 'Ernest Chemists', lowStockAt: 10 },
    { id: 'p12', name: 'First Aid Kit Basic', sku: 'AID-KIT', category: 'First Aid', price: 95, cost: 70, stock: 15, barcode: '890134', color: 'mint', brand: 'MediKit', supplier: 'Lab Supplies Ltd', lowStockAt: 3 },
  ],

  giftCards: [
    { id: 'g1', code: 'GIFT-100-001', balance: 100, original: 100, customerId: 'c2', customerName: 'Akosua Boateng', expiry: '2026-12-31', status: 'active' },
    { id: 'g2', code: 'GIFT-50-002', balance: 25.5, original: 50, customerId: 'c4', customerName: 'Ama Serwaa', expiry: '2026-11-30', status: 'active' },
    { id: 'g3', code: 'GIFT-200-003', balance: 200, original: 200, customerId: null, customerName: '', expiry: '2027-01-15', status: 'active' },
  ],

  sales: [
    {
      id: 'POS-02487', invoiceNumber: 'INV-02487', date: iso(0), time: '10:42',
      cashierId: 'e2', cashier: 'Ama Boateng', customerId: 'c1', customerName: 'Walk-in customer',
      items: [
        { productId: 'p1', name: 'Paracetamol 500mg', qty: 1, unitPrice: 12.5, lineTotal: 12.5 },
        { productId: 'p7', name: 'Vitamin C 1000mg', qty: 2, unitPrice: 45, lineTotal: 90 },
      ],
      subtotal: 102.5, discount: 0, tax: 0, total: 102.5, payment: 'Cash', paymentDetail: {}, itemCount: 3, status: 'paid',
    },
    {
      id: 'POS-02486', invoiceNumber: 'INV-02486', date: iso(0), time: '10:31',
      cashierId: 'e3', cashier: 'Kwame Owusu', customerId: 'c2', customerName: 'Akosua Boateng',
      items: [
        { productId: 'p2', name: 'Ibuprofen 400mg', qty: 2, unitPrice: 18, lineTotal: 36 },
        { productId: 'p8', name: 'Digital Thermometer', qty: 1, unitPrice: 42, lineTotal: 42 },
      ],
      subtotal: 78, discount: 0, tax: 0, total: 78, payment: 'MoMo', paymentDetail: { phone: '0244123456', txn: 'MOMO-123456' }, itemCount: 3, status: 'paid',
    },
    {
      id: 'POS-02485', invoiceNumber: 'INV-02485', date: iso(0), time: '09:55',
      cashierId: 'e2', cashier: 'Ama Boateng', customerId: 'c4', customerName: 'Ama Serwaa',
      items: [{ productId: 'p3', name: 'Amoxicillin 500mg', qty: 1, unitPrice: 35, lineTotal: 35 }],
      subtotal: 35, discount: 3.5, tax: 0, total: 31.5, payment: 'Cash', paymentDetail: {}, itemCount: 1, status: 'paid',
    },
    {
      id: 'POS-02484', invoiceNumber: 'INV-02484', date: iso(0), time: '09:18',
      cashierId: 'e3', cashier: 'Kwame Owusu', customerId: 'c3', customerName: 'Kwame Asare',
      items: [{ productId: 'p9', name: 'Cough Syrup 100ml', qty: 1, unitPrice: 22, lineTotal: 22 }],
      subtotal: 22, discount: 0, tax: 0, total: 22, payment: 'Gift', paymentDetail: { code: 'GIFT-50-002', used: 22 }, itemCount: 1, status: 'paid',
    },
  ],

  messages: [
    { id: 'm1', from: 'Abena Mensah', fromId: 'e1', to: 'all', toName: 'All Staff', subject: 'Morning briefing', body: 'Please ensure shelves are restocked before 9am. New drug shipment arrived. Check expiry dates on all packs.', date: iso(0), time: '08:15', readBy: [] },
    { id: 'm2', from: 'Abena Mensah', fromId: 'e1', to: 'e2', toName: 'Ama Boateng', subject: 'Customer follow-up', body: 'Akosua Boateng has a pending balance of GH₵120. Please remind her on next visit.', date: iso(0), time: '09:00', readBy: [] },
  ],

  expenses: [
    { id: 'x1', date: iso(0), category: 'Utilities', amount: 180, payment: 'Cash', note: 'Electricity top-up (ECG)', by: 'Abena Mensah' },
    { id: 'x2', date: iso(1), category: 'Transport', amount: 65, payment: 'Cash', note: 'Drug delivery to shop', by: 'Ama Boateng' },
    { id: 'x3', date: iso(2), category: 'Supplies', amount: 240, payment: 'MoMo', note: 'Receipt rolls & carrier bags', by: 'Abena Mensah' },
    { id: 'x4', date: iso(3), category: 'Maintenance', amount: 320, payment: 'Cash', note: 'Fridge servicing', by: 'Abena Mensah' },
    { id: 'x5', date: iso(5), category: 'Marketing', amount: 150, payment: 'MoMo', note: 'Local radio promo', by: 'Abena Mensah' },
    { id: 'x6', date: iso(6), category: 'Rent', amount: 1500, payment: 'Cash', note: 'Monthly shop rent', by: 'Abena Mensah' },
  ],

  stockMoves: [
    { id: 'sm1', productId: 'p1', productName: 'Paracetamol 500mg', type: 'restock', qty: 20, date: iso(2), time: '09:15', by: 'Abena Mensah', note: 'Ernest Chemists delivery' },
    { id: 'sm2', productId: 'p5', productName: 'Malaria Test Kit', type: 'adjustment', qty: -2, date: iso(1), time: '16:40', by: 'Ama Boateng', note: 'Damaged kits' },
    { id: 'sm3', productId: 'p11', productName: 'Antiseptic Cream 30g', type: 'restock', qty: 24, date: iso(1), time: '11:05', by: 'Abena Mensah', note: 'Ernest Chemists delivery' },
  ],

  attendance: [
    { id: 'at1', employeeId: 'e1', name: 'Abena Mensah', date: iso(0), in: '07:45', out: null, hours: null },
    { id: 'at2', employeeId: 'e2', name: 'Ama Boateng', date: iso(0), in: '07:58', out: null, hours: null },
  ],

  activities: [
    { id: 'a1', type: 'sale', title: 'Ama Boateng completed a sale', detail: 'GH₵ 102.50 · Cash', at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    { id: 'a2', type: 'sale', title: 'Kwame Owusu completed a sale', detail: 'GH₵ 78.00 · MoMo', at: new Date(Date.now() - 75 * 60 * 1000).toISOString() },
  ],
});
