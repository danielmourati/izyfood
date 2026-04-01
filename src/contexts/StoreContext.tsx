import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Product, Order, Customer, TableInfo, Supplier, Sale, StockEntry, OrderItem, ProductCategory, DiscountCoupon, StoreSettings, PaymentSplit } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface StoreContextType {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: ProductCategory[];
  setCategories: React.Dispatch<React.SetStateAction<ProductCategory[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  tables: TableInfo[];
  setTables: React.Dispatch<React.SetStateAction<TableInfo[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  stockEntries: StockEntry[];
  setStockEntries: React.Dispatch<React.SetStateAction<StockEntry[]>>;
  coupons: DiscountCoupon[];
  setCoupons: React.Dispatch<React.SetStateAction<DiscountCoupon[]>>;
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  completeSale: (order: Order) => void;
  deductStock: (items: OrderItem[]) => void;
  getCategoryById: (id: string) => ProductCategory | undefined;
  updateTableCount: (count: number) => void;
  isCashRegisterOpen: boolean;
  loading: boolean;
}

const StoreContext = createContext<StoreContextType | null>(null);

// ============ DB <-> App mappers ============

function dbToProduct(r: any): Product {
  return { id: r.id, name: r.name, description: r.description || undefined, price: Number(r.price), categoryId: r.category_id || '', type: r.type, unit: r.unit, stock: Number(r.stock), image: r.image || undefined, loyaltyEligible: r.loyalty_eligible ?? false };
}
function dbToCategory(r: any): ProductCategory {
  return { id: r.id, name: r.name };
}
function dbToCustomer(r: any): Customer {
  return { id: r.id, name: r.name, phone: r.phone, address: r.address, notes: r.notes, creditBalance: Number(r.credit_balance), loyaltyPoints: r.loyalty_points };
}
function dbToSupplier(r: any): Supplier {
  return { id: r.id, name: r.name, contact: r.contact };
}
function dbToOrder(r: any): Order {
  return {
    id: r.id, items: r.items as OrderItem[], total: Number(r.total), orderType: r.order_type, status: r.status,
    tableNumber: r.table_number || undefined, customerId: r.customer_id || undefined,
    customerName: r.customer_name || undefined, customerPhone: r.customer_phone || undefined,
    customerAddress: r.customer_address || undefined, deliveryFee: r.delivery_fee ? Number(r.delivery_fee) : undefined,
    deliveryStatus: r.delivery_status || undefined, orderSource: r.order_source || undefined,
    motoboyName: r.motoboy_name || undefined, paymentMethod: r.payment_method || undefined,
    paymentSplits: r.payment_splits as any || undefined, discount: r.discount ? Number(r.discount) : undefined,
    discountType: r.discount_type || undefined, couponId: r.coupon_id || undefined,
    createdAt: r.created_at, heldAt: r.held_at || undefined, completedAt: r.completed_at || undefined,
    loyaltyRedemptions: r.loyalty_redemptions || undefined,
  };
}
function dbToSale(r: any): Sale {
  return { id: r.id, orderId: r.order_id, total: Number(r.total), paymentMethod: r.payment_method, customerId: r.customer_id || undefined, date: r.date, items: r.items as OrderItem[], paymentSplits: r.payment_splits as PaymentSplit[] | undefined };
}
function dbToStockEntry(r: any): StockEntry {
  return { id: r.id, productId: r.product_id, quantity: Number(r.quantity), supplierId: r.supplier_id || '', date: r.date };
}
function dbToTable(r: any): TableInfo {
  return { number: r.number, status: r.status, orderId: r.order_id || undefined };
}
function dbToCoupon(r: any): DiscountCoupon {
  return { id: r.id, code: r.code, type: r.type, value: Number(r.value), active: r.active, minOrder: r.min_order ? Number(r.min_order) : undefined, expiresAt: r.expires_at || undefined };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ tableCount: 20 });
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ============ Initial data fetch ============
  const userId = user?.id;
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;

    async function fetchAll() {
      const [
        { data: cats }, { data: prods }, { data: custs }, { data: supps },
        { data: ords }, { data: sls }, { data: stks }, { data: tbls },
        { data: cpns }, { data: setts }, { data: cashRegs },
      ] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('products').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('date', { ascending: false }),
        supabase.from('stock_entries').select('*').order('date', { ascending: false }),
        supabase.from('store_tables').select('*').order('number'),
        supabase.from('coupons').select('*'),
        supabase.from('store_settings').select('*').limit(1),
        supabase.from('cash_registers').select('id').is('closed_at', null).limit(1),
      ]);

      if (cancelled) return;

      setCategories((cats || []).map(dbToCategory));
      setProducts((prods || []).map(dbToProduct));
      setCustomers((custs || []).map(dbToCustomer));
      setSuppliers((supps || []).map(dbToSupplier));
      setOrders((ords || []).map(dbToOrder));
      setSales((sls || []).map(dbToSale));
      setStockEntries((stks || []).map(dbToStockEntry));
      setTables((tbls || []).map(dbToTable));
      setCoupons((cpns || []).map(dbToCoupon));
      if (setts && setts.length > 0) {
        setSettings({ tableCount: setts[0].table_count });
      }
      setIsCashRegisterOpen(!!(cashRegs && cashRegs.length > 0));
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [userId]);

  // ============ Realtime subscriptions ============
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel('store-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'INSERT') setProducts(prev => [...prev, dbToProduct(payload.new)]);
        else if (payload.eventType === 'UPDATE') setProducts(prev => prev.map(p => p.id === payload.new.id ? dbToProduct(payload.new) : p));
        else if (payload.eventType === 'DELETE') setProducts(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        if (payload.eventType === 'INSERT') setCategories(prev => [...prev, dbToCategory(payload.new)]);
        else if (payload.eventType === 'UPDATE') setCategories(prev => prev.map(c => c.id === payload.new.id ? dbToCategory(payload.new) : c));
        else if (payload.eventType === 'DELETE') setCategories(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        if (payload.eventType === 'INSERT') setCustomers(prev => [...prev, dbToCustomer(payload.new)]);
        else if (payload.eventType === 'UPDATE') setCustomers(prev => prev.map(c => c.id === payload.new.id ? dbToCustomer(payload.new) : c));
        else if (payload.eventType === 'DELETE') setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => {
        if (payload.eventType === 'INSERT') setSuppliers(prev => [...prev, dbToSupplier(payload.new)]);
        else if (payload.eventType === 'UPDATE') setSuppliers(prev => prev.map(s => s.id === payload.new.id ? dbToSupplier(payload.new) : s));
        else if (payload.eventType === 'DELETE') setSuppliers(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') setOrders(prev => {
          if (prev.some(o => o.id === payload.new.id)) {
            return prev.map(o => o.id === payload.new.id ? dbToOrder(payload.new) : o);
          }
          return [dbToOrder(payload.new), ...prev];
        });
        else if (payload.eventType === 'UPDATE') setOrders(prev => prev.map(o => o.id === payload.new.id ? dbToOrder(payload.new) : o));
        else if (payload.eventType === 'DELETE') setOrders(prev => prev.filter(o => o.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        if (payload.eventType === 'INSERT') setSales(prev => [dbToSale(payload.new), ...prev]);
        else if (payload.eventType === 'UPDATE') setSales(prev => prev.map(s => s.id === payload.new.id ? dbToSale(payload.new) : s));
        else if (payload.eventType === 'DELETE') setSales(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_entries' }, (payload) => {
        if (payload.eventType === 'INSERT') setStockEntries(prev => [dbToStockEntry(payload.new), ...prev]);
        else if (payload.eventType === 'DELETE') setStockEntries(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_tables' }, (payload) => {
        if (payload.eventType === 'UPDATE') setTables(prev => prev.map(t => t.number === payload.new.number ? dbToTable(payload.new) : t));
        else if (payload.eventType === 'INSERT') setTables(prev => {
          // Avoid duplicates
          if (prev.some(t => t.number === payload.new.number)) {
            return prev.map(t => t.number === payload.new.number ? dbToTable(payload.new) : t);
          }
          return [...prev, dbToTable(payload.new)].sort((a, b) => a.number - b.number);
        });
        else if (payload.eventType === 'DELETE') {
          // Only remove if the table is not occupied (protect against race conditions)
          const old = payload.old as any;
          if (old.status === 'occupied') return;
          setTables(prev => prev.filter(t => t.number !== old.number));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, (payload) => {
        if (payload.eventType === 'INSERT') setCoupons(prev => [...prev, dbToCoupon(payload.new)]);
        else if (payload.eventType === 'UPDATE') setCoupons(prev => prev.map(c => c.id === payload.new.id ? dbToCoupon(payload.new) : c));
        else if (payload.eventType === 'DELETE') setCoupons(prev => prev.filter(c => c.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          setSettings({ tableCount: payload.new.table_count });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_registers' }, (payload) => {
        if (payload.eventType === 'INSERT' && !payload.new.closed_at) {
          setIsCashRegisterOpen(true);
        } else if (payload.eventType === 'UPDATE' && payload.new.closed_at) {
          setIsCashRegisterOpen(false);
        } else if (payload.eventType === 'DELETE') {
          // Re-check by querying
          supabase.from('cash_registers').select('id').is('closed_at', null).limit(1).then(({ data }) => {
            setIsCashRegisterOpen(!!(data && data.length > 0));
          });
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);

  // ============ Wrapped setters: optimistic local update + DB sync (realtime propagates to all devices) ============
  // We keep optimistic local updates for responsive UX, but the realtime listener
  // will overwrite with the DB truth, ensuring consistency across devices.

  const productsRef = useRef(products);
  productsRef.current = products;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const customersRef = useRef(customers);
  customersRef.current = customers;
  const suppliersRef = useRef(suppliers);
  suppliersRef.current = suppliers;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const salesRef = useRef(sales);
  salesRef.current = sales;
  const stockEntriesRef = useRef(stockEntries);
  stockEntriesRef.current = stockEntries;
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const couponsRef = useRef(coupons);
  couponsRef.current = coupons;

  const setProductsWrapped: typeof setProducts = useCallback((updater) => {
    const prev = productsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setProducts(next); // optimistic
    syncProducts(prev, next);
  }, []);

  const setCategoriesWrapped: typeof setCategories = useCallback((updater) => {
    const prev = categoriesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCategories(next);
    syncCategories(prev, next);
  }, []);

  const setCustomersWrapped: typeof setCustomers = useCallback((updater) => {
    const prev = customersRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCustomers(next);
    syncCustomers(prev, next);
  }, []);

  const setSuppliersWrapped: typeof setSuppliers = useCallback((updater) => {
    const prev = suppliersRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setSuppliers(next);
    syncSuppliers(prev, next);
  }, []);

  const setOrdersWrapped: typeof setOrders = useCallback((updater) => {
    const prev = ordersRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setOrders(next);
    syncOrders(prev, next);
  }, []);

  const setSalesWrapped: typeof setSales = useCallback((updater) => {
    const prev = salesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setSales(next);
    syncSales(prev, next);
  }, []);

  const setStockEntriesWrapped: typeof setStockEntries = useCallback((updater) => {
    const prev = stockEntriesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setStockEntries(next);
    syncStockEntries(prev, next);
  }, []);

  const setTablesWrapped: typeof setTables = useCallback((updater) => {
    const prev = tablesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setTables(next);
    syncTables(prev, next);
  }, []);

  const setCouponsWrapped: typeof setCoupons = useCallback((updater) => {
    const prev = couponsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCoupons(next);
    syncCoupons(prev, next);
  }, []);

  const updateTableCount = useCallback(async (count: number) => {
    setSettings(prev => ({ ...prev, tableCount: count }));
    // Update settings in DB
    const { data: existing } = await supabase.from('store_settings').select('id').limit(1);
    if (existing && existing.length > 0) {
      await supabase.from('store_settings').update({ table_count: count }).eq('id', existing[0].id);
    }
    // Add/remove tables
    const currentTables = await supabase.from('store_tables').select('number').order('number');
    const currentNumbers = (currentTables.data || []).map(t => t.number);
    const maxCurrent = currentNumbers.length;

    if (count > maxCurrent) {
      const newTables = Array.from({ length: count - maxCurrent }, (_, i) => ({
        number: maxCurrent + i + 1,
        status: 'available' as const,
      }));
      await supabase.from('store_tables').insert(newTables);
    } else if (count < maxCurrent) {
      // Remove tables with numbers > count
      await supabase.from('store_tables').delete().gt('number', count);
    }
    // Refetch tables
    const { data: tbls } = await supabase.from('store_tables').select('*').order('number');
    setTables((tbls || []).map(dbToTable));
  }, []);

  const deductStock = useCallback(async (items: OrderItem[]) => {
    for (const item of items) {
      const qty = item.weight || item.quantity;
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.productId).single();
      if (prod) {
        await supabase.from('products').update({ stock: Math.max(0, Number(prod.stock) - qty) }).eq('id', item.productId);
      }
    }
  }, []);

  const completeSale = useCallback(async (order: Order) => {
    // Insert sale
    await supabase.from('sales').insert({
      order_id: order.id,
      total: order.total,
      payment_method: order.paymentMethod!,
      customer_id: order.customerId || null,
      items: order.items as any,
      payment_splits: order.paymentSplits && order.paymentSplits.length > 0 ? order.paymentSplits as any : null,
    });

    // Deduct stock
    await deductStock(order.items);

    // Customer updates
    if (order.customerId) {
      const { data: custData } = await supabase.from('customers').select('*').eq('id', order.customerId).single();
      if (custData) {
        const acaiCategoryIds = categories
          .filter(c => c.name.toLowerCase().includes('açaí') || c.name.toLowerCase().includes('acai'))
          .map(c => c.id);

        const eligibleCount = order.items.filter(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product || !product.loyaltyEligible) return false;
          if (product.type === 'weight') return item.weight && item.weight >= 0.3;
          return true; // unit products: each unit = 1 point
        }).length;

        const pointsToSubtract = (order.loyaltyRedemptions || 0) * 10;
        const isFiado = order.paymentMethod === 'fiado';

        await supabase.from('customers').update({
          credit_balance: isFiado ? Number(custData.credit_balance) + order.total : Number(custData.credit_balance),
          loyalty_points: Math.max(0, (custData.loyalty_points || 0) + eligibleCount - pointsToSubtract),
        }).eq('id', order.customerId);
      }
    }

    // Free table
    if (order.tableNumber != null) {
      const { error: tableError } = await supabase.from('store_tables').update({ status: 'available', order_id: null }).eq('number', order.tableNumber);
      if (tableError) console.error('Error freeing table:', tableError);
    }

    // Update order status
    await supabase.from('orders').update({
      status: 'finalizado',
      completed_at: new Date().toISOString(),
      total: order.total,
      payment_method: order.paymentMethod,
      payment_splits: order.paymentSplits as any || null,
      discount: order.discount || null,
      discount_type: order.discountType || null,
      coupon_id: order.couponId || null,
      customer_id: order.customerId || null,
      loyalty_redemptions: order.loyaltyRedemptions || null,
    }).eq('id', order.id);
  }, [deductStock, products, categories]);

  return (
    <StoreContext.Provider value={{
      products, setProducts: setProductsWrapped, categories, setCategories: setCategoriesWrapped,
      orders, setOrders: setOrdersWrapped, customers, setCustomers: setCustomersWrapped,
      tables, setTables: setTablesWrapped, suppliers, setSuppliers: setSuppliersWrapped,
      sales, setSales: setSalesWrapped, stockEntries, setStockEntries: setStockEntriesWrapped,
      coupons, setCoupons: setCouponsWrapped, settings, setSettings,
      completeSale, deductStock, getCategoryById, updateTableCount, isCashRegisterOpen, loading,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
};

// ============ Sync helpers ============

async function syncProducts(prev: Product[], next: Product[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => {
    const p = prev.find(pp => pp.id === n.id);
    return p && JSON.stringify(p) !== JSON.stringify(n);
  });

  for (const p of added) {
    await supabase.from('products').insert({
      id: p.id, name: p.name, description: p.description || null, price: p.price,
      category_id: p.categoryId || null, type: p.type, unit: p.unit, stock: p.stock, image: p.image || null,
      loyalty_eligible: p.loyaltyEligible,
    });
  }
  for (const p of updated) {
    await supabase.from('products').update({
      name: p.name, description: p.description || null, price: p.price,
      category_id: p.categoryId || null, type: p.type, unit: p.unit, stock: p.stock, image: p.image || null,
      loyalty_eligible: p.loyaltyEligible,
    }).eq('id', p.id);
  }
  for (const p of removed) {
    await supabase.from('products').delete().eq('id', p.id);
  }
}

async function syncCategories(prev: ProductCategory[], next: ProductCategory[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && p.name !== n.name; });

  for (const c of added) await supabase.from('categories').insert({ id: c.id, name: c.name });
  for (const c of updated) await supabase.from('categories').update({ name: c.name }).eq('id', c.id);
  for (const c of removed) await supabase.from('categories').delete().eq('id', c.id);
}

async function syncCustomers(prev: Customer[], next: Customer[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const c of added) await supabase.from('customers').insert({ id: c.id, name: c.name, phone: c.phone, address: c.address, notes: c.notes, credit_balance: c.creditBalance, loyalty_points: c.loyaltyPoints });
  for (const c of updated) await supabase.from('customers').update({ name: c.name, phone: c.phone, address: c.address, notes: c.notes, credit_balance: c.creditBalance, loyalty_points: c.loyaltyPoints }).eq('id', c.id);
  for (const c of removed) await supabase.from('customers').delete().eq('id', c.id);
}

async function syncSuppliers(prev: Supplier[], next: Supplier[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const s of added) await supabase.from('suppliers').insert({ id: s.id, name: s.name, contact: s.contact });
  for (const s of updated) await supabase.from('suppliers').update({ name: s.name, contact: s.contact }).eq('id', s.id);
  for (const s of removed) await supabase.from('suppliers').delete().eq('id', s.id);
}

async function syncOrders(prev: Order[], next: Order[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const o of added) {
    await supabase.from('orders').insert({
      id: o.id, items: o.items as any, total: o.total, order_type: o.orderType, status: o.status,
      table_number: o.tableNumber || null, customer_id: o.customerId || null,
      customer_name: o.customerName || null, customer_phone: o.customerPhone || null,
      customer_address: o.customerAddress || null, delivery_fee: o.deliveryFee || null,
      delivery_status: o.deliveryStatus || null, order_source: o.orderSource || null,
      motoboy_name: o.motoboyName || null, payment_method: o.paymentMethod || null,
      payment_splits: o.paymentSplits as any || null, discount: o.discount || null,
      discount_type: o.discountType || null, coupon_id: o.couponId || null,
      loyalty_redemptions: o.loyaltyRedemptions || null, held_at: o.heldAt || null,
    });
  }
  for (const o of updated) {
    await supabase.from('orders').update({
      items: o.items as any, total: o.total, order_type: o.orderType, status: o.status,
      table_number: o.tableNumber || null, customer_id: o.customerId || null,
      customer_name: o.customerName || null, customer_phone: o.customerPhone || null,
      customer_address: o.customerAddress || null, delivery_fee: o.deliveryFee || null,
      delivery_status: o.deliveryStatus || null, order_source: o.orderSource || null,
      motoboy_name: o.motoboyName || null, payment_method: o.paymentMethod || null,
      payment_splits: o.paymentSplits as any || null, discount: o.discount || null,
      discount_type: o.discountType || null, coupon_id: o.couponId || null,
      loyalty_redemptions: o.loyaltyRedemptions || null, held_at: o.heldAt || null,
      completed_at: o.completedAt || null,
    }).eq('id', o.id);
  }
  for (const o of removed) await supabase.from('orders').delete().eq('id', o.id);
}

async function syncSales(prev: Sale[], next: Sale[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  for (const s of added) {
    await supabase.from('sales').insert({
      id: s.id, order_id: s.orderId, total: s.total, payment_method: s.paymentMethod,
      customer_id: s.customerId || null, items: s.items as any,
    });
  }
}

async function syncStockEntries(prev: StockEntry[], next: StockEntry[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  for (const s of added) await supabase.from('stock_entries').insert({ id: s.id, product_id: s.productId, quantity: s.quantity, supplier_id: s.supplierId || null });
  for (const s of removed) await supabase.from('stock_entries').delete().eq('id', s.id);
}

async function syncTables(prev: TableInfo[], next: TableInfo[]) {
  const updated = next.filter(n => { const p = prev.find(pp => pp.number === n.number); return p && JSON.stringify(p) !== JSON.stringify(n); });
  for (const t of updated) {
    await supabase.from('store_tables').update({ status: t.status, order_id: t.orderId || null }).eq('number', t.number);
  }
}

async function syncCoupons(prev: DiscountCoupon[], next: DiscountCoupon[]) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const c of added) await supabase.from('coupons').insert({ id: c.id, code: c.code, type: c.type, value: c.value, active: c.active, min_order: c.minOrder || null, expires_at: c.expiresAt || null });
  for (const c of updated) await supabase.from('coupons').update({ code: c.code, type: c.type, value: c.value, active: c.active, min_order: c.minOrder || null, expires_at: c.expiresAt || null }).eq('id', c.id);
  for (const c of removed) await supabase.from('coupons').delete().eq('id', c.id);
}
