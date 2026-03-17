import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product, Order, Customer, TableInfo, Supplier, Sale, StockEntry, OrderItem, ProductCategory, DiscountCoupon, StoreSettings } from '@/types';
import { seedProducts, seedCustomers, seedSuppliers, seedCategories } from '@/data/seed';

function load<T>(key: string, fallback: T): T {
  const s = localStorage.getItem(key);
  return s ? JSON.parse(s) : fallback;
}

const defaultSettings: StoreSettings = { tableCount: 20 };

function generateTables(count: number): TableInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    status: 'available' as const,
  }));
}

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
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(() => load('pos_settings', defaultSettings));
  const [products, setProducts] = useState<Product[]>(() => load('pos_products', seedProducts));
  const [categories, setCategories] = useState<ProductCategory[]>(() => load('pos_categories', seedCategories));
  const [orders, setOrders] = useState<Order[]>(() => load('pos_orders', []));
  const [customers, setCustomers] = useState<Customer[]>(() => load('pos_customers', seedCustomers));
  const [tables, setTables] = useState<TableInfo[]>(() => load('pos_tables', generateTables(settings.tableCount)));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => load('pos_suppliers', seedSuppliers));
  const [sales, setSales] = useState<Sale[]>(() => load('pos_sales', []));
  const [stockEntries, setStockEntries] = useState<StockEntry[]>(() => load('pos_stock_entries', []));
  const [coupons, setCoupons] = useState<DiscountCoupon[]>(() => load('pos_coupons', []));

  useEffect(() => { localStorage.setItem('pos_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('pos_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('pos_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('pos_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('pos_customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('pos_tables', JSON.stringify(tables)); }, [tables]);
  useEffect(() => { localStorage.setItem('pos_suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('pos_sales', JSON.stringify(sales)); }, [sales]);
  useEffect(() => { localStorage.setItem('pos_stock_entries', JSON.stringify(stockEntries)); }, [stockEntries]);
  useEffect(() => { localStorage.setItem('pos_coupons', JSON.stringify(coupons)); }, [coupons]);

  const getCategoryById = useCallback((id: string) => categories.find(c => c.id === id), [categories]);

  const updateTableCount = useCallback((count: number) => {
    setSettings(prev => ({ ...prev, tableCount: count }));
    setTables(prev => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, (_, i) => ({
          number: prev.length + i + 1,
          status: 'available' as const,
        }))];
      }
      return prev.slice(0, count);
    });
  }, []);

  const deductStock = useCallback((items: OrderItem[]) => {
    setProducts(prev => prev.map(p => {
      const item = items.find(i => i.productId === p.id);
      if (!item) return p;
      const qty = item.weight || item.quantity;
      return { ...p, stock: Math.max(0, p.stock - qty) };
    }));
  }, []);

  const completeSale = useCallback((order: Order) => {
    const sale: Sale = {
      id: crypto.randomUUID(),
      orderId: order.id,
      total: order.total,
      paymentMethod: order.paymentMethod!,
      customerId: order.customerId,
      date: new Date().toISOString(),
      items: order.items,
    };
    setSales(prev => [...prev, sale]);
    deductStock(order.items);

    // Customer updates: fiado credit + loyalty points
    if (order.customerId) {
      const acaiCategoryIds = categories
        .filter(c => c.name.toLowerCase().includes('açaí') || c.name.toLowerCase().includes('acai'))
        .map(c => c.id);

      const eligibleCount = order.items.filter(item => {
        const product = products.find(p => p.id === item.productId);
        return product && acaiCategoryIds.includes(product.categoryId) && item.weight && item.weight >= 0.3;
      }).length;

      const pointsToSubtract = (order.loyaltyRedemptions || 0) * 10;
      const isFiado = order.paymentMethod === 'fiado';

      setCustomers(prev => prev.map(c => {
        if (c.id !== order.customerId) return c;
        return {
          ...c,
          creditBalance: isFiado ? c.creditBalance + order.total : c.creditBalance,
          loyaltyPoints: Math.max(0, (c.loyaltyPoints || 0) + eligibleCount - pointsToSubtract),
        };
      }));
    }

    if (order.tableNumber) {
      setTables(prev => prev.map(t =>
        t.number === order.tableNumber ? { ...t, status: 'available', orderId: undefined } : t
      ));
    }

    setOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, status: 'finalizado', completedAt: new Date().toISOString() } : o
    ));
  }, [deductStock, products, categories]);

  return (
    <StoreContext.Provider value={{
      products, setProducts, categories, setCategories,
      orders, setOrders, customers, setCustomers,
      tables, setTables, suppliers, setSuppliers, sales, setSales,
      stockEntries, setStockEntries, coupons, setCoupons,
      settings, setSettings, completeSale, deductStock, getCategoryById, updateTableCount,
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
