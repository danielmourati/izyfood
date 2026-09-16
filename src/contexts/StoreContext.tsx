import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Product, Order, Customer, TableInfo, Supplier, Sale, StockEntry, OrderItem, ProductCategory, DiscountCoupon, StoreSettings, PaymentSplit, ProductNoteOption } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PrintSettings } from '@/lib/escpos';

/** Canonical empty PrintSettings — all toggles off, all texts blank */
const EMPTY_PRINT_SETTINGS: PrintSettings = {
  address: '', document: '', documentType: 'cnpj', whatsapp: '',
  pixKey: '', instagram: '', thankMessage: 'Obrigado pela preferência!',
  showAddress: false, showDocument: false, showWhatsapp: false,
  showPixKey: false, showInstagram: false, showThankMessage: false,
  storeName: '',
};

export type RealtimeStatus = 'SUBSCRIBED' | 'CONNECTING' | 'RECONNECTING' | 'ERROR' | 'CLOSED';

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
  noteOptions: ProductNoteOption[];
  setNoteOptions: React.Dispatch<React.SetStateAction<ProductNoteOption[]>>;
  settings: StoreSettings;
  setSettings: React.Dispatch<React.SetStateAction<StoreSettings>>;
  /** Consolidated print configuration for this tenant — always in memory, never stale */
  printSettings: PrintSettings;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
  occupyTable: (tableNumber: number, orderId: string) => Promise<void>;
  freeTable: (tableNumber: number) => Promise<void>;
  completeSale: (order: Order) => void;
  deductStock: (items: OrderItem[]) => void;
  getCategoryById: (id: string) => ProductCategory | undefined;
  updateTableCount: (count: number) => void;
  isCashRegisterOpen: boolean;
  loading: boolean;
  realtimeStatus: RealtimeStatus;
  lastRealtimeEventTime: number | null;
  realtimeEventCounts: Record<string, number>;
  fetchAll: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

// ============ DB <-> App mappers ============

function dbToProduct(r: any): Product {
  return { id: r.id, name: r.name, description: r.description || undefined, price: Number(r.price), categoryId: r.category_id || '', type: r.type, unit: r.unit, stock: Number(r.stock), image: r.image || undefined, loyaltyEligible: r.loyalty_eligible ?? false, controlStock: r.control_stock ?? true };
}
function dbToNoteOption(r: any): ProductNoteOption {
  return { id: r.id, name: r.name, type: r.type, price: Number(r.price), categoryIds: r.category_ids || [], active: r.active ?? true };
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
    pickupPerson: r.pickup_person || undefined,
    productionTime: r.production_time || undefined,
    pickupTime: r.pickup_time || undefined,
    pickupNotes: r.pickup_notes || undefined,
    serviceFee: r.service_fee ? Number(r.service_fee) : undefined,
    isLocked: r.is_locked ?? false,
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

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveLS(key: string, value: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const PENDING_GRACE_MS = 8000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>(() => loadLS('izy_products', []));
  const [categories, setCategories] = useState<ProductCategory[]>(() => loadLS('izy_categories', []));
  const [orders, setOrders] = useState<Order[]>(() => loadLS('izy_orders', []));
  const [customers, setCustomers] = useState<Customer[]>(() => loadLS('izy_customers', []));
  const [tables, setTables] = useState<TableInfo[]>(() => loadLS('izy_tables', []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadLS('izy_suppliers', []));
  const [sales, setSales] = useState<Sale[]>(() => loadLS('izy_sales', []));
  const [stockEntries, setStockEntries] = useState<StockEntry[]>(() => loadLS('izy_stock_entries', []));
  const [coupons, setCoupons] = useState<DiscountCoupon[]>(() => loadLS('izy_coupons', []));
  const [noteOptions, setNoteOptions] = useState<ProductNoteOption[]>(() => loadLS('izy_note_options', []));
  const [settings, setSettings] = useState<StoreSettings>({ tableCount: 20 });
  const [printSettings, setPrintSettings] = useState<PrintSettings>({ ...EMPTY_PRINT_SETTINGS });
  const [isCashRegisterOpen, setIsCashRegisterOpen] = useState(false);

  // Realtime diagnostics state
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('CONNECTING');
  const [lastRealtimeEventTime, setLastRealtimeEventTime] = useState<number | null>(null);
  const [realtimeEventCounts, setRealtimeEventCounts] = useState<Record<string, number>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const dbChannelRef = useRef<RealtimeChannel | null>(null);
  const tenantIdRef = useRef<string | undefined>(undefined);
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2));
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const pendingIdsRef = useRef<Map<string, number>>(new Map());
  const retryDelayRef = useRef<number>(1000);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeStatusRef = useRef<RealtimeStatus>('CONNECTING');
  realtimeStatusRef.current = realtimeStatus;

  // Track local modifications with timestamp
  const markPending = useCallback((id: string | number) => {
    if (!id) return;
    pendingIdsRef.current.set(String(id), Date.now());
  }, []);

  const isPendingLocalChange = useCallback((id: string | number) => {
    if (!id) return false;
    const ts = pendingIdsRef.current.get(String(id));
    if (!ts) return false;
    if (Date.now() - ts > PENDING_GRACE_MS) {
      pendingIdsRef.current.delete(String(id));
      return false;
    }
    return true;
  }, []);

  const recordRealtimeEvent = useCallback((table: string) => {
    const now = Date.now();
    setLastRealtimeEventTime(now);
    setRealtimeEventCounts(prev => ({
      ...prev,
      [table]: (prev[table] || 0) + 1,
    }));
  }, []);

  // Per-entity sequence numbers to discard stale out-of-order DB responses
  const seqRef = useRef<{ [entity: string]: number }>({
    categories: 0, products: 0, customers: 0, suppliers: 0,
    orders: 0, sales: 0, stockEntries: 0, tables: 0,
    coupons: 0, noteOptions: 0, settings: 0,
  });

  // Debounce timers for burst events
  const debounceTimersRef = useRef<{ [entity: string]: NodeJS.Timeout }>({});

  const debounceFetch = useCallback((entity: string, fetchFn: () => Promise<void>, delay = 300) => {
    if (debounceTimersRef.current[entity]) {
      clearTimeout(debounceTimersRef.current[entity]);
    }
    debounceTimersRef.current[entity] = setTimeout(() => {
      fetchFn();
    }, delay);
  }, []);

  const notifyCrossTabSync = useCallback(() => {
    try {
      broadcastRef.current?.postMessage({
        type: 'IZYFOOD_SYNC_UPDATE',
        senderId: tabIdRef.current,
        timestamp: Date.now(),
      });
    } catch {}
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'store_update',
          payload: { senderId: tabIdRef.current, timestamp: Date.now() },
        });
      }
    } catch {}
  }, []);

  // Granular Entity Fetchers
  const fetchCategories = useCallback(async () => {
    const currentSeq = ++seqRef.current.categories;
    const { data: cats } = await supabase.from('categories').select('*');
    if (seqRef.current.categories !== currentSeq) return;
    if (cats) {
      setCategories(prev => {
        const dbCats = cats.map(dbToCategory);
        const dbIds = new Set(dbCats.map(c => c.id));
        const pendingLocal = prev.filter(c => !dbIds.has(c.id) && isPendingLocalChange(c.id));
        const merged = [...dbCats, ...pendingLocal];
        saveLS('izy_categories', merged);
        return merged;
      });
    }
  }, [isPendingLocalChange]);

  const fetchProducts = useCallback(async () => {
    const currentSeq = ++seqRef.current.products;
    const { data: prods } = await supabase.from('products').select('*');
    if (seqRef.current.products !== currentSeq) return;
    if (prods) {
      setProducts(prev => {
        const dbProds = prods.map(dbToProduct);
        const dbIds = new Set(dbProds.map(p => p.id));
        const pendingLocal = prev.filter(p => !dbIds.has(p.id) && isPendingLocalChange(p.id));
        const merged = [...dbProds, ...pendingLocal];
        saveLS('izy_products', merged);
        return merged;
      });
    }
  }, [isPendingLocalChange]);

  const fetchCustomers = useCallback(async () => {
    const currentSeq = ++seqRef.current.customers;
    const { data: custs } = await supabase.from('customers').select('*');
    if (seqRef.current.customers !== currentSeq) return;
    if (custs) {
      setCustomers(prev => {
        const dbCusts = custs.map(dbToCustomer);
        const dbIds = new Set(dbCusts.map(c => c.id));
        const pendingLocal = prev.filter(c => !dbIds.has(c.id) && isPendingLocalChange(c.id));
        const merged = [...dbCusts, ...pendingLocal];
        saveLS('izy_customers', merged);
        return merged;
      });
    }
  }, [isPendingLocalChange]);

  const fetchSuppliers = useCallback(async () => {
    const currentSeq = ++seqRef.current.suppliers;
    const { data: supps } = await supabase.from('suppliers').select('*');
    if (seqRef.current.suppliers !== currentSeq) return;
    if (supps) {
      setSuppliers(prev => {
        const dbSupps = supps.map(dbToSupplier);
        const dbIds = new Set(dbSupps.map(s => s.id));
        const pendingLocal = prev.filter(s => !dbIds.has(s.id) && isPendingLocalChange(s.id));
        const merged = [...dbSupps, ...pendingLocal];
        saveLS('izy_suppliers', merged);
        return merged;
      });
    }
  }, [isPendingLocalChange]);

  const fetchOrders = useCallback(async () => {
    const currentSeq = ++seqRef.current.orders;
    const { data: ords } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (seqRef.current.orders !== currentSeq) return;
    if (ords) {
      const parsedOrds = ords.map(dbToOrder);
      setOrders(prev => {
        const dbIds = new Set(parsedOrds.map(o => o.id));
        const activeLocalOrds = prev.filter(o => 
          o.status !== 'cancelado' && 
          o.status !== 'concluido' && 
          !dbIds.has(o.id) && 
          isPendingLocalChange(o.id)
        );
        const merged = [...parsedOrds, ...activeLocalOrds];
        saveLS('izy_orders', merged);
        return merged;
      });
    }
  }, [isPendingLocalChange]);

  const fetchSales = useCallback(async () => {
    const currentSeq = ++seqRef.current.sales;
    const { data: sls } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (seqRef.current.sales !== currentSeq) return;
    if (sls) {
      const parsedSls = sls.map(dbToSale);
      setSales(parsedSls);
      saveLS('izy_sales', parsedSls);
    }
  }, []);

  const fetchStockEntries = useCallback(async () => {
    const currentSeq = ++seqRef.current.stockEntries;
    const { data: stks } = await supabase.from('stock_entries').select('*').order('date', { ascending: false });
    if (seqRef.current.stockEntries !== currentSeq) return;
    if (stks) {
      const parsedStks = stks.map(dbToStockEntry);
      setStockEntries(parsedStks);
      saveLS('izy_stock_entries', parsedStks);
    }
  }, []);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const fetchTables = useCallback(async () => {
    const currentSeq = ++seqRef.current.tables;
    const [{ data: tbls }, { data: ords }] = await Promise.all([
      supabase.from('store_tables').select('*').order('number'),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
    ]);
    if (seqRef.current.tables !== currentSeq) return;

    const parsedDbOrds = (ords || []).map(dbToOrder);
    const currentLocalOrds = ordersRef.current || [];
    const allActiveOrds = [...parsedDbOrds];
    currentLocalOrds.forEach(l => {
      if (!allActiveOrds.some(o => o.id === l.id) && l.status !== 'cancelado' && l.status !== 'concluido' && isPendingLocalChange(l.id)) {
        allActiveOrds.push(l);
      }
    });

    const tableOrderMap = new Map<number, string>();
    allActiveOrds.forEach(o => {
      if (o.orderType === 'mesa' && o.tableNumber && o.status !== 'cancelado' && o.status !== 'concluido') {
        tableOrderMap.set(Number(o.tableNumber), o.id);
      }
    });

    setTables(prev => {
      const tableMap = new Map<number, TableInfo>();

      // 1. Default 20 tables as available
      for (let i = 1; i <= 20; i++) {
        tableMap.set(i, { number: i, status: 'available' });
      }

      // 2. Overlay DB tables
      if (tbls && tbls.length > 0) {
        tbls.forEach(t => {
          const tableObj = dbToTable(t);
          tableMap.set(tableObj.number, tableObj);
        });
      }

      // 3. Overlay active orders map
      tableOrderMap.forEach((orderId, tableNum) => {
        const existing = tableMap.get(tableNum);
        tableMap.set(tableNum, {
          number: tableNum,
          status: 'occupied',
          orderId: orderId || existing?.orderId,
        });
      });

      // 4. Preserve occupied status ONLY if a local change was registered within grace window
      prev.forEach(t => {
        if (t.status === 'occupied') {
          const hasPendingChange = isPendingLocalChange(t.number) || (t.orderId && isPendingLocalChange(t.orderId));
          if (hasPendingChange) {
            tableMap.set(t.number, t);
          }
        }
      });

      const merged = Array.from(tableMap.values()).sort((a, b) => a.number - b.number);
      saveLS('izy_tables', merged);
      return merged;
    });
  }, [isPendingLocalChange]);

  const fetchCoupons = useCallback(async () => {
    const currentSeq = ++seqRef.current.coupons;
    const { data: cpns } = await supabase.from('coupons').select('*');
    if (seqRef.current.coupons !== currentSeq) return;
    if (cpns) {
      const parsedCpns = cpns.map(dbToCoupon);
      setCoupons(parsedCpns);
      saveLS('izy_coupons', parsedCpns);
    }
  }, []);

  const fetchNoteOptions = useCallback(async () => {
    const currentSeq = ++seqRef.current.noteOptions;
    const { data: opts } = await supabase.from('product_note_options').select('*');
    if (seqRef.current.noteOptions !== currentSeq) return;
    if (opts) {
      setNoteOptions(prev => {
        const dbOpts = opts.map(dbToNoteOption);
        const dbIds = new Set(dbOpts.map(o => o.id));
        const pendingLocal = prev.filter(o => !dbIds.has(o.id) && isPendingLocalChange(o.id));
        const merged = [...dbOpts, ...pendingLocal];
        saveLS('izy_note_options', merged);
        return merged;
      });
    }
  }, [isPendingLocalChange]);

  const fetchSettings = useCallback(async () => {
    const currentSeq = ++seqRef.current.settings;
    const tenantId = user?.tenantId;
    tenantIdRef.current = tenantId;
    const lsKey = tenantId ? `print_settings_${tenantId}` : null;

    const [{ data: setts }, { data: cashRegs }, tenantNameRes] = await Promise.all([
      tenantId
        ? supabase.from('store_settings').select('*').eq('tenant_id', tenantId).limit(1)
        : supabase.from('store_settings').select('*').limit(1),
      supabase.from('cash_registers').select('id').is('closed_at', null).limit(1),
      tenantId
        ? supabase.from('tenants').select('name').eq('id', tenantId).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (seqRef.current.settings !== currentSeq) return;

    if (setts && setts.length > 0) {
      setSettings({
        tableCount: setts[0].table_count,
        serviceFeePercentage: setts[0].service_fee_percentage ? Number(setts[0].service_fee_percentage) : undefined,
      });
      const tenantName = (tenantNameRes as any)?.data?.name || '';
      const dbPs = (setts[0] as any).print_settings;
      if (dbPs && typeof dbPs === 'object' && Object.keys(dbPs).length > 0) {
        const merged: PrintSettings = { ...EMPTY_PRINT_SETTINGS, ...dbPs, storeName: tenantName };
        setPrintSettings(merged);
        if (lsKey) {
          localStorage.setItem(lsKey, JSON.stringify(merged));
          (window as any).__printSettingsCache = merged;
        }
      }
    }
    setIsCashRegisterOpen(!!(cashRegs && cashRegs.length > 0));
  }, [user?.tenantId]);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    try {
      await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchCustomers(),
        fetchSuppliers(),
        fetchOrders(),
        fetchSales(),
        fetchStockEntries(),
        fetchTables(),
        fetchCoupons(),
        fetchNoteOptions(),
        fetchSettings(),
      ]);
    } catch (err) {
      console.warn('[StoreContext] fetchAll error:', err);
    }
  }, [
    user?.id,
    fetchCategories, fetchProducts, fetchCustomers, fetchSuppliers,
    fetchOrders, fetchSales, fetchStockEntries, fetchTables,
    fetchCoupons, fetchNoteOptions, fetchSettings
  ]);

  // Initial data fetch
  const userId = user?.id;
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;

    async function initFetch() {
      await fetchAll();
      if (!cancelled) setLoading(false);
    }

    initFetch();
    return () => { cancelled = true; };
  }, [userId, fetchAll]);

  // Setup subscriptions with exponential backoff
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!userId) return;

    const tenantKey = user?.tenantId || (user as any)?.tenantSlug || 'default';

    // Broadcast channel
    const broadcastChannelName = `store-tenant-broadcast-${tenantKey}`;
    const broadcastChannel = supabase.channel(broadcastChannelName, {
      config: { broadcast: { ack: false, self: true } },
    })
      .on('broadcast', { event: 'store_update' }, (payload) => {
        if (payload?.payload?.senderId !== tabIdRef.current) {
          recordRealtimeEvent('broadcast');
          debounceFetch('all', fetchAll, 300);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('SUBSCRIBED');
          retryDelayRef.current = 1000;
          fetchAll();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('RECONNECTING');
          scheduleReconnect();
        }
      });

    channelRef.current = broadcastChannel;

    // Database postgres_changes channel
    const dbChannelName = `store-tenant-db-${tenantKey}`;
    const dbChannel = supabase.channel(dbChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        recordRealtimeEvent('orders');
        debounceFetch('orders', fetchOrders, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_tables' }, (payload) => {
        recordRealtimeEvent('store_tables');
        if (payload.eventType === 'DELETE') {
          const deletedNumber = payload.old?.number;
          if (deletedNumber && isPendingLocalChange(deletedNumber)) {
            return;
          }
        }
        debounceFetch('tables', fetchTables, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        recordRealtimeEvent('products');
        if (payload.eventType === 'INSERT') setProducts(prev => prev.some(p => p.id === payload.new.id) ? prev : [...prev, dbToProduct(payload.new)]);
        else if (payload.eventType === 'UPDATE') setProducts(prev => prev.map(p => p.id === payload.new.id ? dbToProduct(payload.new) : p));
        else if (payload.eventType === 'DELETE') {
          if (!isPendingLocalChange(payload.old.id)) {
            setProducts(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
        debounceFetch('products', fetchProducts, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        recordRealtimeEvent('categories');
        if (payload.eventType === 'INSERT') setCategories(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, dbToCategory(payload.new)]);
        else if (payload.eventType === 'UPDATE') setCategories(prev => prev.map(c => c.id === payload.new.id ? dbToCategory(payload.new) : c));
        else if (payload.eventType === 'DELETE') {
          if (!isPendingLocalChange(payload.old.id)) {
            setCategories(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
        debounceFetch('categories', fetchCategories, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        recordRealtimeEvent('customers');
        if (payload.eventType === 'INSERT') setCustomers(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, dbToCustomer(payload.new)]);
        else if (payload.eventType === 'UPDATE') setCustomers(prev => prev.map(c => c.id === payload.new.id ? dbToCustomer(payload.new) : c));
        else if (payload.eventType === 'DELETE') {
          if (!isPendingLocalChange(payload.old.id)) {
            setCustomers(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
        debounceFetch('customers', fetchCustomers, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => {
        recordRealtimeEvent('suppliers');
        if (payload.eventType === 'INSERT') setSuppliers(prev => prev.some(s => s.id === payload.new.id) ? prev : [...prev, dbToSupplier(payload.new)]);
        else if (payload.eventType === 'UPDATE') setSuppliers(prev => prev.map(s => s.id === payload.new.id ? dbToSupplier(payload.new) : s));
        else if (payload.eventType === 'DELETE') {
          if (!isPendingLocalChange(payload.old.id)) {
            setSuppliers(prev => prev.filter(s => s.id !== payload.old.id));
          }
        }
        debounceFetch('suppliers', fetchSuppliers, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        recordRealtimeEvent('sales');
        if (payload.eventType === 'INSERT') setSales(prev => [dbToSale(payload.new), ...prev]);
        else if (payload.eventType === 'UPDATE') setSales(prev => prev.map(s => s.id === payload.new.id ? dbToSale(payload.new) : s));
        else if (payload.eventType === 'DELETE') setSales(prev => prev.filter(s => s.id !== payload.old.id));
        debounceFetch('sales', fetchSales, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_entries' }, (payload) => {
        recordRealtimeEvent('stock_entries');
        if (payload.eventType === 'INSERT') setStockEntries(prev => [dbToStockEntry(payload.new), ...prev]);
        else if (payload.eventType === 'DELETE') setStockEntries(prev => prev.filter(s => s.id !== payload.old.id));
        debounceFetch('stockEntries', fetchStockEntries, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons' }, (payload) => {
        recordRealtimeEvent('coupons');
        if (payload.eventType === 'INSERT') setCoupons(prev => [...prev, dbToCoupon(payload.new)]);
        else if (payload.eventType === 'UPDATE') setCoupons(prev => prev.map(c => c.id === payload.new.id ? dbToCoupon(payload.new) : c));
        else if (payload.eventType === 'DELETE') setCoupons(prev => prev.filter(c => c.id !== payload.old.id));
        debounceFetch('coupons', fetchCoupons, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_note_options' }, (payload) => {
        recordRealtimeEvent('product_note_options');
        if (payload.eventType === 'INSERT') setNoteOptions(prev => prev.some(o => o.id === payload.new.id) ? prev : [...prev, dbToNoteOption(payload.new)]);
        else if (payload.eventType === 'UPDATE') setNoteOptions(prev => prev.map(o => o.id === payload.new.id ? dbToNoteOption(payload.new) : o));
        else if (payload.eventType === 'DELETE') {
          if (!isPendingLocalChange(payload.old.id)) {
            setNoteOptions(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
        debounceFetch('noteOptions', fetchNoteOptions, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, (payload) => {
        recordRealtimeEvent('store_settings');
        debounceFetch('settings', fetchSettings, 300);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_registers' }, () => {
        recordRealtimeEvent('cash_registers');
        supabase.from('cash_registers').select('id').is('closed_at', null).limit(1).then(({ data }) => {
          setIsCashRegisterOpen(!!(data && data.length > 0));
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('SUBSCRIBED');
          retryDelayRef.current = 1000;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeStatus('RECONNECTING');
          scheduleReconnect();
        }
      });

    dbChannelRef.current = dbChannel;
  }, [
    userId, user?.tenantId, recordRealtimeEvent, debounceFetch, fetchAll,
    fetchOrders, fetchTables, fetchProducts, fetchCategories, fetchCustomers,
    fetchSuppliers, fetchSales, fetchStockEntries, fetchCoupons, fetchNoteOptions,
    fetchSettings, isPendingLocalChange
  ]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    const delay = retryDelayRef.current;
    retryDelayRef.current = Math.min(30000, delay >= 10000 ? 30000 : delay >= 5000 ? 10000 : delay >= 2000 ? 5000 : 2000);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (dbChannelRef.current) {
        supabase.removeChannel(dbChannelRef.current);
        dbChannelRef.current = null;
      }
      setupRealtimeSubscriptions();
    }, delay);
  }, [setupRealtimeSubscriptions]);

  useEffect(() => {
    if (!userId) return;

    setupRealtimeSubscriptions();

    // Cross-Tab BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('izyfood-realtime-cross-tab');
        bc.onmessage = (ev) => {
          if (ev.data && ev.data.senderId !== tabIdRef.current) {
            fetchAll();
          }
        };
        broadcastRef.current = bc;
      } catch (e) {
        console.warn('[StoreContext] BroadcastChannel unsupported:', e);
      }
    }

    // Window Visibility & Online listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAll();
        if (realtimeStatusRef.current !== 'SUBSCRIBED') {
          setupRealtimeSubscriptions();
        }
      }
    };
    const handleOnline = () => {
      fetchAll();
      if (realtimeStatusRef.current !== 'SUBSCRIBED') {
        setupRealtimeSubscriptions();
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('print_settings_') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setPrintSettings(prev => ({ ...prev, ...parsed }));
        } catch {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('storage', handleStorage);

    // Heartbeat every 20 seconds, executing ONLY when Realtime is NOT SUBSCRIBED
    const heartbeatId = setInterval(() => {
      if (realtimeStatusRef.current !== 'SUBSCRIBED') {
        fetchAll();
      }
    }, 20000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('storage', handleStorage);
      clearInterval(heartbeatId);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (broadcastRef.current) {
        broadcastRef.current.close();
        broadcastRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (dbChannelRef.current) {
        supabase.removeChannel(dbChannelRef.current);
        dbChannelRef.current = null;
      }
    };
  }, [userId, setupRealtimeSubscriptions, fetchAll]);

  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);

  // State refs for optimistic sync
  const productsRef = useRef(products);
  productsRef.current = products;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;
  const customersRef = useRef(customers);
  customersRef.current = customers;
  const suppliersRef = useRef(suppliers);
  suppliersRef.current = suppliers;
  const salesRef = useRef(sales);
  salesRef.current = sales;
  const stockEntriesRef = useRef(stockEntries);
  stockEntriesRef.current = stockEntries;
  const tablesRef = useRef(tables);
  tablesRef.current = tables;
  const couponsRef = useRef(coupons);
  couponsRef.current = coupons;
  const noteOptionsRef = useRef(noteOptions);
  noteOptionsRef.current = noteOptions;

  const setProductsWrapped: typeof setProducts = useCallback((updater) => {
    const prev = productsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setProducts(next);
    saveLS('izy_products', next);
    syncProducts(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncProducts]', e));
  }, [notifyCrossTabSync, markPending]);

  const setCategoriesWrapped: typeof setCategories = useCallback((updater) => {
    const prev = categoriesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCategories(next);
    saveLS('izy_categories', next);
    syncCategories(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncCategories]', e));
  }, [notifyCrossTabSync, markPending]);

  const setCustomersWrapped: typeof setCustomers = useCallback((updater) => {
    const prev = customersRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCustomers(next);
    saveLS('izy_customers', next);
    syncCustomers(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncCustomers]', e));
  }, [notifyCrossTabSync, markPending]);

  const setSuppliersWrapped: typeof setSuppliers = useCallback((updater) => {
    const prev = suppliersRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setSuppliers(next);
    saveLS('izy_suppliers', next);
    syncSuppliers(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncSuppliers]', e));
  }, [notifyCrossTabSync, markPending]);

  const setOrdersWrapped: typeof setOrders = useCallback((updater) => {
    const prev = ordersRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setOrders(next);
    saveLS('izy_orders', next);
    syncOrders(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncOrders]', e));
  }, [notifyCrossTabSync, markPending]);

  const setSalesWrapped: typeof setSales = useCallback((updater) => {
    const prev = salesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setSales(next);
    saveLS('izy_sales', next);
    syncSales(prev, next).then(() => notifyCrossTabSync()).catch(e => console.error('[syncSales]', e));
  }, [notifyCrossTabSync]);

  const setStockEntriesWrapped: typeof setStockEntries = useCallback((updater) => {
    const prev = stockEntriesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setStockEntries(next);
    saveLS('izy_stock_entries', next);
    syncStockEntries(prev, next).then(() => notifyCrossTabSync()).catch(e => console.error('[syncStockEntries]', e));
  }, [notifyCrossTabSync]);

  const setTablesWrapped: typeof setTables = useCallback((updater) => {
    const prev = tablesRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setTables(next);
    saveLS('izy_tables', next);
    syncTables(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncTables]', e));
  }, [notifyCrossTabSync, markPending]);

  const setCouponsWrapped: typeof setCoupons = useCallback((updater) => {
    const prev = couponsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setCoupons(next);
    saveLS('izy_coupons', next);
    syncCoupons(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncCoupons]', e));
  }, [notifyCrossTabSync, markPending]);

  const setNoteOptionsWrapped: typeof setNoteOptions = useCallback((updater) => {
    const prev = noteOptionsRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    setNoteOptions(next);
    saveLS('izy_note_options', next);
    syncNoteOptions(prev, next, markPending).then(() => notifyCrossTabSync()).catch(e => console.error('[syncNoteOptions]', e));
  }, [notifyCrossTabSync, markPending]);

  const updateTableCount = useCallback(async (count: number) => {
    const validCount = Math.max(5, count);
    setSettings(prev => ({ ...prev, tableCount: validCount }));
    const currentTables = await supabase.from('store_tables').select('number, status').order('number');
    const currentData = currentTables.data || [];
    const currentNumbers = currentData.map(t => t.number);
    const maxNumber = currentNumbers.length > 0 ? Math.max(...currentNumbers) : 0;

    if (validCount > currentNumbers.length) {
      const newTables = Array.from({ length: validCount - currentNumbers.length }, (_, i) => ({
        number: maxNumber + i + 1,
        status: 'available' as const,
      }));
      await supabase.from('store_tables').insert(newTables);
    } else if (validCount < currentNumbers.length) {
      const occupiedNumbers = new Set(currentData.filter(t => t.status === 'occupied').map(t => t.number));
      const availableToDelete = currentNumbers
        .filter(num => !occupiedNumbers.has(num))
        .sort((a, b) => b - a);
      const deleteCount = Math.min(availableToDelete.length, currentNumbers.length - validCount);
      const toDelete = availableToDelete.slice(0, deleteCount);
      if (toDelete.length > 0) {
        await supabase.from('store_tables').delete().in('number', toDelete);
      }
    }
    const { data: tbls } = await supabase.from('store_tables').select('*').order('number');
    const uniqueTbls = [];
    const seen = new Set();
    for (const t of (tbls || [])) {
      if (!seen.has(t.number)) {
        seen.add(t.number);
        uniqueTbls.push(t);
      }
    }
    setTables(uniqueTbls.map(dbToTable));
  }, []);

  const occupyTable = useCallback(async (tableNumber: number, orderId: string) => {
    markPending(tableNumber);
    markPending(orderId);
    setTables(prev => {
      const next = prev.map(t => t.number === tableNumber ? { ...t, status: 'occupied' as const, orderId } : t);
      saveLS('izy_tables', next);
      return next;
    });
    try {
      await supabase.from('store_tables').upsert(
        { number: tableNumber, status: 'occupied', order_id: orderId },
        { onConflict: 'number' }
      );
    } catch (err) {
      console.error('[occupyTable] DB upsert error:', err);
    }
    notifyCrossTabSync();
  }, [notifyCrossTabSync, markPending]);

  const freeTable = useCallback(async (tableNumber: number) => {
    markPending(tableNumber);
    setTables(prev => {
      const next = prev.map(t => t.number === tableNumber ? { ...t, status: 'available' as const, orderId: undefined } : t);
      saveLS('izy_tables', next);
      return next;
    });
    try {
      await supabase.from('store_tables').upsert(
        { number: tableNumber, status: 'available', order_id: null },
        { onConflict: 'number' }
      );
    } catch (err) {
      console.error('[freeTable] DB upsert error:', err);
    }
    notifyCrossTabSync();
  }, [notifyCrossTabSync, markPending]);

  const deductStock = useCallback(async (items: OrderItem[]) => {
    for (const item of items) {
      const qty = item.weight || item.quantity;
      const { data: prod } = await supabase.from('products').select('stock, control_stock').eq('id', item.productId).single();
      if (prod && prod.control_stock !== false) {
        await supabase.from('products').update({ stock: Math.max(0, Number(prod.stock) - qty) }).eq('id', item.productId);
      }
    }
  }, []);

  const completeSale = useCallback(async (order: Order) => {
    markPending(order.id);
    if (order.tableNumber != null) markPending(order.tableNumber);

    await supabase.from('sales').insert({
      order_id: order.id,
      total: order.total,
      payment_method: order.paymentMethod!,
      customer_id: order.customerId || null,
      items: order.items as any,
      payment_splits: order.paymentSplits && order.paymentSplits.length > 0 ? order.paymentSplits as any : null,
    });

    await deductStock(order.items);

    if (order.customerId) {
      const { data: custData } = await supabase.from('customers').select('*').eq('id', order.customerId).single();
      if (custData) {
        const eligibleCount = order.items.filter(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product || !product.loyaltyEligible) return false;
          if (product.type === 'weight') return item.weight && item.weight >= 0.3;
          return true;
        }).length;

        const pointsToSubtract = (order.loyaltyRedemptions || 0) * 10;
        const isFiado = order.paymentMethod === 'fiado';

        await supabase.from('customers').update({
          credit_balance: isFiado ? Number(custData.credit_balance) + order.total : Number(custData.credit_balance),
          loyalty_points: Math.max(0, (custData.loyalty_points || 0) + eligibleCount - pointsToSubtract),
        }).eq('id', order.customerId);
      }
    }

    if (order.tableNumber != null) {
      await freeTable(order.tableNumber);
    }

    const orderUpdate: Record<string, any> = {
      status: 'finalizado',
      completed_at: new Date().toISOString(),
      total: order.total,
      payment_method: order.paymentMethod,
      payment_splits: order.paymentSplits && order.paymentSplits.length > 0 ? order.paymentSplits as any : null,
      discount: order.discount || null,
      discount_type: order.discountType || null,
      coupon_id: order.couponId || null,
      customer_id: order.customerId || null,
      loyalty_redemptions: order.loyaltyRedemptions || null,
      service_fee: order.serviceFee || null,
    };
    if (order.orderType === 'delivery' || order.orderType === 'retirada') {
      orderUpdate.delivery_status = 'finalizado';
    }
    await supabase.from('orders').update(orderUpdate as any).eq('id', order.id);
  }, [deductStock, products, freeTable, markPending]);

  return (
    <StoreContext.Provider value={{
      products, setProducts: setProductsWrapped, categories, setCategories: setCategoriesWrapped,
      orders, setOrders: setOrdersWrapped, customers, setCustomers: setCustomersWrapped,
      tables, setTables: setTablesWrapped, suppliers, setSuppliers: setSuppliersWrapped,
      sales, setSales: setSalesWrapped, stockEntries, setStockEntries: setStockEntriesWrapped,
      coupons, setCoupons: setCouponsWrapped, noteOptions, setNoteOptions: setNoteOptionsWrapped,
      settings, setSettings,
      printSettings, setPrintSettings,
      occupyTable, freeTable,
      completeSale, deductStock, getCategoryById, updateTableCount, isCashRegisterOpen, loading,
      realtimeStatus, lastRealtimeEventTime, realtimeEventCounts, fetchAll,
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

async function syncProducts(prev: Product[], next: Product[], markPending: (id: string) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => {
    const p = prev.find(pp => pp.id === n.id);
    return p && JSON.stringify(p) !== JSON.stringify(n);
  });

  const tenantId = tenantIdRef.current;

  for (const p of added) {
    markPending(p.id);
    const item: any = {
      id: p.id, name: p.name, description: p.description || null, price: p.price,
      category_id: p.categoryId || null, type: p.type, unit: p.unit, stock: p.stock, image: p.image || null,
      loyalty_eligible: p.loyaltyEligible, control_stock: p.controlStock,
    };
    if (tenantId) item.tenant_id = tenantId;
    const { error } = await supabase.from('products').insert(item);
    if (error) {
      console.warn('Initial product insert with tenant_id failed, fallback without tenant_id:', error.message);
      delete item.tenant_id;
      const { error: err2 } = await supabase.from('products').insert(item);
      if (err2) console.error('Error inserting product into Supabase:', err2);
    }
  }
  for (const p of updated) {
    markPending(p.id);
    const { error } = await supabase.from('products').update({
      name: p.name, description: p.description || null, price: p.price,
      category_id: p.categoryId || null, type: p.type, unit: p.unit, stock: p.stock, image: p.image || null,
      loyalty_eligible: p.loyaltyEligible, control_stock: p.controlStock,
    }).eq('id', p.id);
    if (error) console.error('Error updating product in Supabase:', error);
  }
  for (const p of removed) {
    markPending(p.id);
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) console.error('Error deleting product from Supabase:', error);
  }
}

async function syncCategories(prev: ProductCategory[], next: ProductCategory[], markPending: (id: string) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && p.name !== n.name; });

  const tenantId = tenantIdRef.current;

  for (const c of added) {
    markPending(c.id);
    const item: any = { id: c.id, name: c.name };
    if (tenantId) item.tenant_id = tenantId;
    const { error } = await supabase.from('categories').insert(item);
    if (error) {
      console.warn('Initial category insert failed, retrying without tenant_id:', error.message);
      const { error: err2 } = await supabase.from('categories').insert({ id: c.id, name: c.name });
      if (err2) console.error('Error inserting category into Supabase:', err2);
    }
  }
  for (const c of updated) {
    markPending(c.id);
    const { error } = await supabase.from('categories').update({ name: c.name }).eq('id', c.id);
    if (error) console.error('Error updating category in Supabase:', error);
  }
  for (const c of removed) {
    markPending(c.id);
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) console.error('Error deleting category in Supabase:', error);
  }
}

async function syncCustomers(prev: Customer[], next: Customer[], markPending: (id: string) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const c of added) { markPending(c.id); await supabase.from('customers').insert({ id: c.id, name: c.name, phone: c.phone, address: c.address, notes: c.notes, credit_balance: c.creditBalance, loyalty_points: c.loyaltyPoints }); }
  for (const c of updated) { markPending(c.id); await supabase.from('customers').update({ name: c.name, phone: c.phone, address: c.address, notes: c.notes, credit_balance: c.creditBalance, loyalty_points: c.loyaltyPoints }).eq('id', c.id); }
  for (const c of removed) { markPending(c.id); await supabase.from('customers').delete().eq('id', c.id); }
}

async function syncSuppliers(prev: Supplier[], next: Supplier[], markPending: (id: string) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const s of added) { markPending(s.id); await supabase.from('suppliers').insert({ id: s.id, name: s.name, contact: s.contact }); }
  for (const s of updated) { markPending(s.id); await supabase.from('suppliers').update({ name: s.name, contact: s.contact }).eq('id', s.id); }
  for (const s of removed) { markPending(s.id); await supabase.from('suppliers').delete().eq('id', s.id); }
}

async function syncOrders(prev: Order[], next: Order[], markPending: (id: string | number) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const o of removed) {
    markPending(o.id);
    if (o.tableNumber) markPending(o.tableNumber);
    try {
      await supabase.from('orders').delete().eq('id', o.id);
    } catch (err) {
      console.error('[syncOrders] DB delete error:', err);
    }
  }

  const toUpsert = [...added, ...updated];
  for (const o of toUpsert) {
    markPending(o.id);
    if (o.tableNumber) markPending(o.tableNumber);
    try {
      await supabase.from('orders').upsert({
        id: o.id, items: o.items as any, total: o.total, order_type: o.orderType, status: o.status,
        table_number: o.tableNumber || null, customer_id: o.customerId || null,
        customer_name: o.customerName || null, customer_phone: o.customerPhone || null,
        customer_address: o.customerAddress || null, delivery_fee: o.deliveryFee || null,
        delivery_status: o.deliveryStatus || null, order_source: o.orderSource || null,
        motoboy_name: o.motoboyName || null, payment_method: o.paymentMethod || null,
        payment_splits: o.paymentSplits as any || null, discount: o.discount || null,
        discount_type: o.discountType || null, coupon_id: o.couponId || null,
        loyalty_redemptions: o.loyaltyRedemptions || null, held_at: o.heldAt || null,
        completed_at: o.completedAt || null,
        pickup_person: o.pickupPerson || null, production_time: o.productionTime || null,
        pickup_time: o.pickupTime || null, pickup_notes: o.pickupNotes || null,
        is_locked: o.isLocked ?? false,
      } as any, { onConflict: 'id' });

      if (o.orderType === 'mesa' && o.tableNumber && o.status !== 'cancelado' && o.status !== 'concluido') {
        await supabase.from('store_tables').upsert(
          { number: Number(o.tableNumber), status: 'occupied', order_id: o.id },
          { onConflict: 'number' }
        );
      }
    } catch (err) {
      console.error('[syncOrders] DB upsert error:', err);
    }
  }
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

async function syncTables(prev: TableInfo[], next: TableInfo[], markPending: (id: number) => void) {
  const updated = next.filter(n => {
    const p = prev.find(pp => pp.number === n.number);
    if (!p) return false;
    return JSON.stringify(p) !== JSON.stringify(n);
  });
  for (const t of updated) {
    markPending(t.number);
    await supabase.from('store_tables').upsert({
      number: t.number,
      status: t.status,
      order_id: t.status === 'occupied' ? t.orderId || null : null,
    }, { onConflict: 'number' });
  }
}

async function syncCoupons(prev: DiscountCoupon[], next: DiscountCoupon[], markPending: (id: string) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const c of added) { markPending(c.id); await supabase.from('coupons').insert({ id: c.id, code: c.code, type: c.type, value: c.value, active: c.active, min_order: c.minOrder || null, expires_at: c.expiresAt || null }); }
  for (const c of updated) { markPending(c.id); await supabase.from('coupons').update({ code: c.code, type: c.type, value: c.value, active: c.active, min_order: c.minOrder || null, expires_at: c.expiresAt || null }).eq('id', c.id); }
  for (const c of removed) { markPending(c.id); await supabase.from('coupons').delete().eq('id', c.id); }
}

async function syncNoteOptions(prev: ProductNoteOption[], next: ProductNoteOption[], markPending: (id: string) => void) {
  const added = next.filter(n => !prev.find(p => p.id === n.id));
  const removed = prev.filter(p => !next.find(n => n.id === p.id));
  const updated = next.filter(n => { const p = prev.find(pp => pp.id === n.id); return p && JSON.stringify(p) !== JSON.stringify(n); });

  for (const o of added) { markPending(o.id); await supabase.from('product_note_options').insert({ id: o.id, name: o.name, type: o.type, price: o.price, category_ids: o.categoryIds, active: o.active }); }
  for (const o of updated) { markPending(o.id); await supabase.from('product_note_options').update({ name: o.name, type: o.type, price: o.price, category_ids: o.categoryIds, active: o.active }).eq('id', o.id); }
  for (const o of removed) { markPending(o.id); await supabase.from('product_note_options').delete().eq('id', o.id); }
}

