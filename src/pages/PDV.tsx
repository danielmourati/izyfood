import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmt, fmtWeight } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Product, OrderItem, Order, OrderType, TableInfo, Customer } from '@/types';
import { WeightModal } from '@/components/WeightModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ItemNotesModal } from '@/components/ItemNotesModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, ShoppingCart, Pause, X, ArrowLeft, UserPlus, User, Star, ShieldAlert, AlertTriangle, Search, Printer, FileEdit } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CategoryBar } from '@/components/CategoryBar';
import { ProductCard } from '@/components/ProductCard';
import { TableBar } from '@/components/TableBar';
import { usePrinter } from '@/hooks/use-printer';

const orderTypeLabels: Record<OrderType, string> = {
  balcao: '🏪 Balcão',
  mesa: '🪑 Mesa',
  delivery: '🛵 Delivery',
  retirada: '📦 Retirada',
};

const PDV = () => {
  const { products, categories, orders, setOrders, tables, setTables, getCategoryById } = useStore();
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useTenantNavigate();
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const mesaParam = searchParams.get('mesa');
  const pedidoParam = searchParams.get('pedido');
  const tableNumber = mesaParam ? parseInt(mesaParam) : undefined;

  const existingOrder = useMemo(() => {
    if (pedidoParam) return orders.find(o => o.id === pedidoParam);
    return undefined;
  }, [pedidoParam, orders]);

  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('balcao');
  const [mobileView, setMobileView] = useState<'categories' | 'products' | 'cart'>(() => {
    return new URLSearchParams(window.location.search).get('pedido') ? 'cart' : 'categories';
  });
  const [mobileLastAddedId, setMobileLastAddedId] = useState<string | null>(null);
  const [editingItemNotesId, setEditingItemNotesId] = useState<string | null>(null);
  const [weightModal, setWeightModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string>(() => crypto.randomUUID());
  const [initialized, setInitialized] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { printOrder } = usePrinter();

  useEffect(() => {
    if (initialized) return;
    if (existingOrder) {
      setCart(existingOrder.items);
      setOrderType(existingOrder.orderType);
      setCurrentOrderId(existingOrder.id);
      if (existingOrder.customerId) setSelectedCustomerId(existingOrder.customerId);
      setInitialized(true);
    } else if (pedidoParam) {
      // Wait for realtime
    } else {
      const newId = currentOrderId;
      const newOrderType = tableNumber ? 'mesa' as const : 'balcao' as const;
      if (tableNumber) setOrderType('mesa');
      const order: Order = {
        id: newId, items: [], total: 0, orderType: newOrderType, status: 'aberto',
        tableNumber, createdAt: new Date().toISOString(),
      };
      setOrders(prev => [...prev, order]);
      const params = new URLSearchParams(searchParams);
      params.set('pedido', newId);
      navigate(`/pdv?${params.toString()}`, { replace: true });
      setInitialized(true);
    }
  }, [existingOrder, tableNumber, initialized, pedidoParam]);

  const { customers } = useStore();
  const resolveCustomer = useCallback((custId: string | null | undefined) => {
    if (!custId) return {};
    const c = customers.find(cx => cx.id === custId);
    if (!c) return {};
    return { customerName: c.name, customerPhone: c.phone, customerAddress: c.address };
  }, [customers]);

  useEffect(() => {
    if (!pedidoParam || !initialized) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const currentTotal = cart.reduce((s, i) => s + i.subtotal, 0);
      setOrders(prev => prev.map(o => {
        if (o.id !== pedidoParam) return o;
        if (o.status === 'segurado' || o.status === 'finalizado' || o.status === 'cancelado') return o;
        const custId = selectedCustomerId || o.customerId;
        return { ...o, items: cart, total: currentTotal, customerId: custId, ...resolveCustomer(custId), orderType };
      }));
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cart, pedidoParam, initialized, setOrders, selectedCustomerId, orderType, resolveCustomer]);

  const handleConfirmNotes = (itemId: string, newNotes: string, newComplements: { name: string, price: number, quantity: number }[]) => {
    setCart(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const compsTotal = newComplements.reduce((acc, c) => acc + (c.price * c.quantity), 0);
      const baseSubtotal = i.weight ? i.weight * i.price : i.quantity * i.price;
      const subtotal = baseSubtotal + (compsTotal * i.quantity);
      return { ...i, notes: newNotes, selectedComplements: newComplements, subtotal };
    }));
  };

  const filteredProducts = useMemo(() => {
    let list = activeCategoryId === 'all' ? products : products.filter(p => p.categoryId === activeCategoryId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategoryId, searchQuery]);

  const productCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    }
    return counts;
  }, [products]);

  const total = useMemo(() => cart.reduce((s, i) => s + i.subtotal, 0), [cart]);

  const addToCart = (product: Product) => {
    if (product.type === 'weight') {
      setWeightModal({ open: true, product });
      return;
    }

    const existing = cart.find(i => i.productId === product.id && !i.weight && i.addedBy === user?.id);
    if (existing) {
      setMobileLastAddedId(existing.id);
      setCart(prev => prev.map(i => {
        if (i.id === existing.id) {
          const compsTotal = (i.selectedComplements || []).reduce((a, c) => a + c.price * c.quantity, 0);
          return { ...i, quantity: i.quantity + 1, subtotal: (i.price + compsTotal) * (i.quantity + 1) };
        }
        return i;
      }));
    } else {
      const newId = crypto.randomUUID();
      setMobileLastAddedId(newId);
      setCart(prev => [...prev, {
        id: newId, productId: product.id, name: product.name, price: product.price,
        quantity: 1, subtotal: product.price, addedBy: user?.id, addedByName: user?.name,
      }]);
    }
  };

  const addWeightItem = (weight: number) => {
    const product = weightModal.product!;
    setCart(prev => [...prev, {
      id: crypto.randomUUID(), productId: product.id, name: product.name, price: product.price,
      quantity: 1, weight, subtotal: weight * product.price, addedBy: user?.id, addedByName: user?.name,
    }]);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = Math.max(1, i.quantity + delta);
      const compsTotal = (i.selectedComplements || []).reduce((a, c) => a + c.price * c.quantity, 0);
      const baseSubtotal = i.weight ? i.weight * i.price : newQty * i.price;
      return { ...i, quantity: newQty, subtotal: baseSubtotal + (compsTotal * newQty) };
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
    if (mobileLastAddedId === id) setMobileLastAddedId(null);
  };

  const cancelOrder = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const orderId = pedidoParam || currentOrderId;
    const order = orders.find(o => o.id === orderId);
    setCart([]);
    setSelectedCustomerId(null);
    if (tableNumber) {
      setTables(prev => prev.map(t =>
        t.number === tableNumber ? { ...t, status: 'available', orderId: undefined } : t
      ));
    }
    if (!order || order.total === 0) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelado' } : o));
    }
    if (tableNumber) navigate('/');
    else navigate('/pdv', { replace: true });
  };

  const handleSelectTable = (table: TableInfo) => {
    const orderId = currentOrderId;
    if (pedidoParam) {
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, orderType: 'mesa', tableNumber: table.number, customerId: selectedCustomerId || undefined } : o
      ));
    } else {
      const order: Order = {
        id: orderId, items: cart, total, orderType: 'mesa', status: 'aberto',
        tableNumber: table.number, customerId: selectedCustomerId || undefined, createdAt: new Date().toISOString(),
      };
      setOrders(prev => [...prev, order]);
    }
    setTables(prev => prev.map(t =>
      t.number === table.number ? { ...t, status: 'occupied', orderId } : t
    ));
    setOrderType('mesa');
    navigate(`/pdv?mesa=${table.number}&pedido=${orderId}`);
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    const orderId = pedidoParam || currentOrderId;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setOrders(prev => {
      const exists = prev.some(o => o.id === orderId);
      if (exists) {
        return prev.map(o => {
          if (o.id !== orderId) return o;
          const custId = selectedCustomerId || o.customerId;
          return { ...o, items: cart, total, status: 'segurado' as const, customerId: custId, ...resolveCustomer(custId), heldAt: new Date().toISOString() };
        });
      }
      const custId = selectedCustomerId || undefined;
      return [...prev, {
        id: orderId, items: cart, total, orderType, status: 'segurado' as const,
        tableNumber, customerId: custId, ...resolveCustomer(custId), createdAt: new Date().toISOString(), heldAt: new Date().toISOString(),
      }];
    });
    setCart([]);
    setSelectedCustomerId(null);
    if (tableNumber) navigate('/');
  };

  const isHeldMesa = !!(existingOrder && existingOrder.orderType === 'mesa' && (existingOrder.status === 'segurado' || (existingOrder.status === 'aberto' && existingOrder.items.length > 0)));

  const currentOrder: Order = {
    id: currentOrderId, items: cart, total, orderType, status: 'aberto',
    tableNumber, customerId: selectedCustomerId || undefined, createdAt: new Date().toISOString(),
  };

  const handlePrintOrder = async () => {
    const cust = customers.find(c => c.id === currentOrder.customerId);
    const orderData = {
      ...currentOrder,
      operatorName: user?.name,
      customerName: cust?.name || undefined,
    };
    await printOrder(orderData);
    toast.success('Comanda enviada para impressão!');
  };

  const handleTableBarSelect = (table: TableInfo) => {
    if (table.orderId) {
      navigate(`/pdv?mesa=${table.number}&pedido=${table.orderId}`);
    }
  };

  return (
    <>
      <div className="hidden lg:flex flex-col h-[calc(100vh-3rem)]">
        <div className="flex flex-1 overflow-hidden">
          {/* Main product area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top bar */}
            <div className="px-4 pt-4 pb-2 space-y-3">
              {tableNumber && (
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (cart.length === 0 && pedidoParam) {
                      setTables(prev => prev.map(t =>
                        t.number === tableNumber ? { ...t, status: 'available', orderId: undefined } : t
                      ));
                      setOrders(prev => prev.filter(o => o.id !== pedidoParam));
                    }
                    navigate('/');
                  }}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <h2 className="text-lg font-bold text-foreground">Mesa {tableNumber}</h2>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  className="pl-10 h-10 bg-card"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category bar */}
              <CategoryBar
                categories={categories}
                activeCategoryId={activeCategoryId}
                onSelect={setActiveCategoryId}

              />
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-auto px-4 pb-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    category={getCategoryById(product.categoryId)}
                    onAdd={addToCart}
                  />
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Search className="h-12 w-12 mb-2 opacity-30" />
                  <p className="text-sm">Nenhum produto encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart panel - desktop */}
          <div className="w-80 xl:w-96 border-l bg-card flex-col flex">
            <CartContent cart={cart} orderType={orderType} setOrderType={setOrderType} tableNumber={tableNumber} total={total}
              updateQty={updateQty} removeItem={removeItem} cancelOrder={cancelOrder} holdOrder={holdOrder} setCheckoutOpen={setCheckoutOpen}
              tables={tables} onSelectTable={(t) => handleSelectTable(t)}
              selectedCustomerId={selectedCustomerId} onSelectCustomer={setSelectedCustomerId} isHeldMesa={isHeldMesa}
              onPrintOrder={handlePrintOrder} setEditingItemNotesId={setEditingItemNotesId} isMobile={false} />
          </div>
        </div>
      </div>

      {/* --- MOBILE LAYOUT --- */}
      <div className="flex lg:hidden flex-col h-[calc(100vh-4rem)] bg-background">
        {mobileView === 'categories' && (
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-2xl font-black text-foreground drop-shadow-sm">Categorias</h2>
              {tableNumber && <Badge variant="secondary" className="text-xs uppercase bg-primary text-primary-foreground font-bold">Mesa {tableNumber}</Badge>}
            </div>

            <div className="grid grid-cols-2 gap-3 pb-8">
              {categories.map((cat, idx) => (
                <Button key={cat.id}
                  variant="default"
                  className="h-28 flex flex-col items-center justify-center gap-2 rounded-2xl text-lg relative font-bold shadow-md active:scale-95 transition-all text-white hover:bg-primary/95"
                  style={{ backgroundColor: idx % 2 === 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.85)' }}
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    setMobileView('products');
                  }}>
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {mobileView === 'products' && (
          <div className="flex-1 flex flex-col overflow-hidden relative bg-card">
            <div className="flex items-center gap-2 p-3 border-b bg-card shrink-0 shadow-sm z-10">
              <Button variant="ghost" size="icon" onClick={() => setMobileView('categories')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-bold truncate">
                {activeCategoryId === 'all' ? 'Todos os Produtos' : getCategoryById(activeCategoryId)?.name}
              </h2>
            </div>

            <div className="flex-1 overflow-auto px-3 py-3 pb-40 bg-muted/10">
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} category={getCategoryById(product.categoryId)} onAdd={addToCart} />
                ))}
              </div>
            </div>

            {/* Mobile Action Bar Overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col">
              {mobileLastAddedId && (() => {
                const lastItem = cart.find(i => i.id === mobileLastAddedId);
                if (lastItem) return (
                  <div className="bg-primary p-3 flex flex-col gap-3 shadow-[0_-8px_15px_-3px_rgba(0,0,0,0.2)]">
                    <div className="flex justify-between items-center text-primary-foreground">
                      <div className="flex items-center gap-1 font-bold">
                        <span className="truncate max-w-[180px]">{lastItem.name}</span>
                        <span>R$ {fmt(lastItem.price)}</span>
                      </div>
                      <Badge variant="secondary" className="font-bold">x{lastItem.quantity}</Badge>
                    </div>
                    <div className="flex items-stretch gap-2 h-10">
                      <Button variant="secondary" className="flex-1 font-bold text-lg" onClick={() => updateQty(lastItem.id, 1)}><Plus className="h-4 w-4" /></Button>
                      <Button variant="secondary" className="flex-1 font-bold text-lg" onClick={() => updateQty(lastItem.id, -1)} disabled={lastItem.quantity <= 1}><Minus className="h-4 w-4" /></Button>
                      <Button variant="destructive" className="w-12 shrink-0 font-bold" onClick={() => removeItem(lastItem.id)}><Trash2 className="h-4 w-4" /></Button>
                      <div className="flex-[2] flex">
                        <Button variant="secondary" className="w-full h-full font-bold text-xs flex justify-between bg-white text-primary hover:bg-gray-100" onClick={() => setEditingItemNotesId(lastItem.id)}>
                          <span className="truncate">{lastItem.notes || 'Notas da cozinha...'}</span>
                          <FileEdit className="h-4 w-4 ml-1 shrink-0" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
                return null;
              })()}

              <div className="flex bg-card p-3 gap-2 border-t mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <Button variant="outline" className="flex-1 h-12 flex items-center justify-center font-bold text-xs bg-muted/30" onClick={() => setMobileView('categories')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> VOLTAR
                </Button>
                <Button className="flex-[2] h-12 flex items-center justify-center font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white relative overflow-hidden shadow-sm" onClick={() => setMobileView('cart')}>
                  <span className="flex items-center gap-1">REVISAR <ShoppingCart className="h-4 w-4 ml-1.5" /></span>
                  {cart.length > 0 && (
                    <span className="bg-emerald-800 text-white text-[10px] rounded-full px-2 py-0.5 ml-2 shadow-sm font-bold">
                      R$ {fmt(total)}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {mobileView === 'cart' && (
          <div className="flex flex-col h-full bg-card">
            <div className="flex items-center justify-between p-3 border-b shadow-sm z-10 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setMobileView('products')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-semibold text-lg flex-1 text-center pr-8">
                {tableNumber ? `Mesa ${tableNumber}` : 'Revisar Pedido'}
              </span>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/10 pb-16">
              <CartContent
                cart={cart} orderType={orderType} setOrderType={setOrderType} tableNumber={tableNumber} total={total}
                updateQty={updateQty} removeItem={removeItem}
                cancelOrder={() => { cancelOrder(); setMobileView('categories'); }}
                holdOrder={() => { holdOrder(); setMobileView('categories'); }}
                setCheckoutOpen={(v) => { setCheckoutOpen(v); }}
                tables={tables} onSelectTable={(t) => { handleSelectTable(t); }}
                selectedCustomerId={selectedCustomerId} onSelectCustomer={setSelectedCustomerId} isHeldMesa={isHeldMesa}
                onPrintOrder={handlePrintOrder} setEditingItemNotesId={setEditingItemNotesId}
                isMobile={true} onAddNewItem={() => setMobileView('categories')}
              />
            </div>
          </div>
        )}
      </div>

      <WeightModal open={weightModal.open} onClose={() => setWeightModal({ open: false, product: null })}
        productName={weightModal.product?.name || ''} pricePerKg={weightModal.product?.price || 0} onConfirm={addWeightItem} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)}
        order={cart.length > 0 ? currentOrder : null}
        selectedCustomerId={selectedCustomerId}
        onComplete={() => {
          const isDeliveryOrPickup = orderType === 'delivery' || orderType === 'retirada';
          setCart([]); setSelectedCustomerId(null);
          if (isDeliveryOrPickup) { navigate('/entregas'); }
          else if (tableNumber) { navigate('/'); }
        }} />
      <ItemNotesModal
        open={!!editingItemNotesId}
        onClose={() => setEditingItemNotesId(null)}
        item={cart.find(i => i.id === editingItemNotesId) || null}
        onConfirm={handleConfirmNotes}
      />
    </>
  );
};

// ============ CartContent (kept inline for compatibility) ============

function CartContent({
  cart, orderType, setOrderType, tableNumber, total, updateQty, removeItem, cancelOrder, holdOrder, setCheckoutOpen, tables, onSelectTable,
  selectedCustomerId, onSelectCustomer, isHeldMesa, onPrintOrder, setEditingItemNotesId, isMobile, onAddNewItem
}: {
  cart: OrderItem[]; orderType: OrderType; setOrderType: (t: OrderType) => void; tableNumber?: number;
  total: number; updateQty: (id: string, delta: number) => void; removeItem: (id: string) => void;
  cancelOrder: () => void; holdOrder: () => void; setCheckoutOpen: (v: boolean) => void;
  tables: TableInfo[]; onSelectTable: (t: TableInfo) => void;
  selectedCustomerId: string | null; onSelectCustomer: (id: string | null) => void;
  isHeldMesa: boolean;
  onPrintOrder?: () => void;
  setEditingItemNotesId?: (id: string) => void;
  isMobile?: boolean;
  onAddNewItem?: () => void;
}) {
  const { customers, setCustomers, products, categories } = useStore();
  const { isAdmin } = useAuth();
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [adminAuthModal, setAdminAuthModal] = useState<{ open: boolean; action: 'remove' | 'cancel'; itemId?: string }>({ open: false, action: 'remove' });
  const [adminAuthEmail, setAdminAuthEmail] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [adminAuthChecking, setAdminAuthChecking] = useState(false);

  const needsAdminAuth = isHeldMesa && !isAdmin;
  const availableTables = tables.filter(t => t.status === 'available');
  const customerObj = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [customers, customerSearch]);

  const isItemEligible = (item: OrderItem) => {
    const product = products.find(p => p.id === item.productId);
    if (!product || !product.loyaltyEligible) return false;
    if (product.type === 'weight') return item.weight && item.weight >= 0.3;
    return true;
  };

  const hasEligibleAcaiInCart = cart.some(isItemEligible);
  const redeemableCount = customerObj ? Math.floor((customerObj.loyaltyPoints || 0) / 10) : 0;

  const handleProtectedRemove = (itemId: string) => {
    if (needsAdminAuth) {
      setAdminAuthModal({ open: true, action: 'remove', itemId });
    } else {
      removeItem(itemId);
    }
  };

  const handleProtectedCancel = () => {
    if (needsAdminAuth) {
      setAdminAuthModal({ open: true, action: 'cancel' });
    } else {
      cancelOrder();
    }
  };

  const handleAdminAuth = async () => {
    if (!adminAuthEmail.trim() || !adminAuthPassword.trim()) {
      toast.error('Informe email e senha do administrador');
      return;
    }
    setAdminAuthChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-admin-password', {
        body: { email: adminAuthEmail, password: adminAuthPassword },
      });
      if (error || !data?.success) {
        toast.error(data?.error || 'Credenciais inválidas');
        setAdminAuthChecking(false);
        return;
      }
      const { action, itemId } = adminAuthModal;
      setAdminAuthModal({ open: false, action: 'remove' });
      setAdminAuthEmail('');
      setAdminAuthPassword('');
      setAdminAuthChecking(false);
      if (action === 'remove' && itemId) removeItem(itemId);
      else if (action === 'cancel') cancelOrder();
    } catch {
      toast.error('Erro ao verificar credenciais');
      setAdminAuthChecking(false);
    }
  };

  const handleOrderTypeClick = (key: OrderType) => {
    if (key === 'mesa') {
      setTableModalOpen(true);
    } else {
      setOrderType(key);
    }
  };

  const handleCreateCustomer = () => {
    if (!newName.trim()) return;
    const newCustomer: Customer = {
      id: crypto.randomUUID(), name: newName.trim(), phone: newPhone.trim(),
      address: newAddress.trim(), notes: '', creditBalance: 0, loyaltyPoints: 0,
    };
    setCustomers(prev => [...prev, newCustomer]);
    onSelectCustomer(newCustomer.id);
    setNewCustomerOpen(false);
    setNewName(''); setNewPhone(''); setNewAddress('');
  };

  return (
    <>
      {/* Order type / table header */}
      <div className="px-3 py-1.5 border-b bg-muted/20">
        {tableNumber ? (
          <div className="text-center"><Badge variant="default" className="text-[10px] uppercase font-bold px-2 py-0.5 opacity-80">Mesa {tableNumber}</Badge></div>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            {(Object.entries(orderTypeLabels) as [OrderType, string][]).map(([key, label]) => (
              <Button key={key} variant={orderType === key ? 'default' : 'ghost'} size="sm" className="text-[10px] h-6" onClick={() => handleOrderTypeClick(key)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Customer Selector */}
      <div className="px-3 py-2 border-b space-y-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase opacity-70">Cliente</span>
          <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] gap-1 text-primary" onClick={() => setNewCustomerOpen(true)}>
            <UserPlus className="h-2.5 w-2.5" /> Novo
          </Button>
        </div>
        {selectedCustomerId && customerObj ? (
          <div className="flex items-center justify-between bg-muted/40 rounded px-2 py-1">
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold truncate text-foreground leading-none">{customerObj.name}</span>
              {customerObj.loyaltyPoints > 0 && <span className="text-[9px] text-muted-foreground mt-0.5">⭐ {customerObj.loyaltyPoints} pts</span>}
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-50 hover:opacity-100" onClick={() => onSelectCustomer(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <Input placeholder="Buscar cliente..." className="h-8 text-xs" value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
              onFocus={() => setCustomerDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)} />
            {customerDropdownOpen && customerSearch.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
                {filteredCustomers.map(c => (
                  <button key={c.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { onSelectCustomer(c.id); setCustomerSearch(''); setCustomerDropdownOpen(false); }}>
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{c.phone}</span>
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum cliente encontrado</p>
                )}
              </div>
            )}
          </div>
        )}

        {selectedCustomerId && customerObj && redeemableCount > 0 && hasEligibleAcaiInCart && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 text-center animate-in fade-in">
            <p className="text-xs font-semibold text-primary">
              🎉 {redeemableCount} resgate{redeemableCount > 1 ? 's' : ''} de açaí 300g grátis disponível!
            </p>
          </div>
        )}
      </div>

      {/* Customer Info / Table Header on Mobile Cart */}
      {isMobile && tableNumber && (
        <div className="px-3 py-3 bg-white border-b shrink-0 flex flex-col gap-1.5 shadow-sm">
          {customerObj && (
            <p className="text-[13px] font-medium text-muted-foreground leading-tight">
              Cliente: {customerObj.name} {customerObj.phone ? `(${customerObj.phone})` : ''}
            </p>
          )}
          <p className="text-[14px] font-medium text-foreground mt-1">
            <span className="font-bold border-b-2 border-primary/20 pb-0.5">Itens</span>
          </p>
        </div>
      )}

      {/* Cart items */}
      <div className="flex-1 overflow-auto px-2 py-2 space-y-1 bg-muted/10">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mb-2 opacity-20" /><p className="text-xs">Carrinho vazio</p>
          </div>
        ) : cart.map(item => {
          const eligible = isItemEligible(item);
          return (
            <div key={item.id} className="bg-background border rounded p-2 flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-foreground leading-tight">{item.name}</span>
                    {eligible && selectedCustomerId && (
                      <Badge variant="outline" className="text-[8px] text-primary px-1 py-0 leading-none h-3 border-primary/30">
                        <Star className="h-2 w-2 mr-0.5" />+1
                      </Badge>
                    )}
                  </div>
                  {item.weight ? (
                    <p className="text-[10px] text-muted-foreground leading-none mt-1">{fmtWeight(item.weight)}kg × R$ {fmt(item.price)}/kg</p>
                  ) : null}
                  {item.addedByName && <p className="text-[9px] text-muted-foreground opacity-70 mt-0.5">por {item.addedByName}</p>}
                  <div className="mt-1.5 flex flex-col items-start gap-1">
                    {item.notes && <p className="text-[10px] font-medium leading-tight opacity-90 text-foreground"><span className="font-bold text-primary">Obs:</span> {item.notes}</p>}
                    {setEditingItemNotesId && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 w-fit bg-muted/60 border-muted-foreground/30 hover:bg-muted" onClick={() => setEditingItemNotesId(item.id)}>
                        <FileEdit className="h-3 w-3 mr-1" /> {item.notes ? 'Editar' : 'Anotações'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 justify-between h-full gap-2">
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive/80 hover:text-destructive opacity-50 hover:opacity-100" onClick={() => handleProtectedRemove(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  <span className="font-bold text-xs text-primary leading-none">R$ {fmt(item.subtotal)}</span>
                </div>
              </div>
              {!item.weight && (
                <div className="flex items-center gap-0.5 self-start mt-1 bg-muted/30 rounded-md p-0.5">
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-background shadow-sm rounded-sm" onClick={() => updateQty(item.id, -1)}><Minus className="h-2.5 w-2.5" /></Button>
                  <span className="w-6 text-center font-bold text-[11px]">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-background shadow-sm rounded-sm" onClick={() => updateQty(item.id, 1)}><Plus className="h-2.5 w-2.5" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer totals + actions */}
      <div className="border-t p-2 space-y-2 bg-card">
        <div className="flex justify-between items-end px-1">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-muted-foreground leading-none">Subtotal</span>
            <span className="text-sm font-bold text-foreground">R$ {fmt(total)}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-muted-foreground opacity-60 leading-none">Total</span>
            <p className="text-lg font-bold text-primary leading-none">R$ {fmt(total)}</p>
          </div>
        </div>
        {isMobile && tableNumber ? (
          <div className="grid grid-cols-4 gap-2 pt-2">
            <Button variant="outline" className="h-14 flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-background border-muted-foreground/20 text-foreground" onClick={() => { window.location.href = '/'; }}>
              <ArrowLeft className="h-4 w-4" /> VOLTAR
            </Button>
            <Button className="h-14 flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-[#4CAF50] hover:bg-[#388E3C] text-white" onClick={onPrintOrder} disabled={cart.length === 0}>
              <Printer className="h-4 w-4" /> FECHAR
            </Button>
            <Button className="h-14 flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-[#673AB7] hover:bg-[#512DA8] text-white" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <span className="text-lg font-black leading-none">$</span> PAGAR
            </Button>
            <Button className="h-14 flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-[#2196F3] hover:bg-[#1976D2] text-white" onClick={onAddNewItem}>
              <Plus className="h-5 w-5" /> NOVO
            </Button>
          </div>
        ) : orderType === 'balcao' ? (
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="destructive" className="h-8 text-[11px] font-semibold" onClick={handleProtectedCancel} disabled={cart.length === 0}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
            <Button className="h-8 text-[11px] font-semibold shadow-sm" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Pagar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            <Button variant="ghost" className="h-8 px-0 text-destructive bg-destructive/10 hover:bg-destructive/20 text-[10px]" onClick={handleProtectedCancel} disabled={cart.length === 0 && !tableNumber}>
              <X className="h-3 w-3" />
            </Button>
            <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold" onClick={holdOrder} disabled={cart.length === 0}>
              <Pause className="h-3 w-3 mr-0.5" /> Segur.
            </Button>
            <Button variant="secondary" className="h-8 text-[10px] px-1 font-semibold" onClick={onPrintOrder} disabled={cart.length === 0}>
              <Printer className="h-3 w-3 mr-0.5" /> Impr.
            </Button>
            <Button className="h-8 text-[11px] px-1 font-bold shadow-sm" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Pagar
            </Button>
          </div>
        )}
      </div>

      {/* Table selection dialog */}
      <Dialog open={tableModalOpen} onOpenChange={setTableModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Selecionar Mesa</DialogTitle></DialogHeader>
          {availableTables.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma mesa disponível</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableTables.map(t => (
                <Button key={t.number} variant="outline"
                  className="h-14 text-base font-semibold hover:bg-primary hover:text-primary-foreground"
                  onClick={() => { setTableModalOpen(false); onSelectTable(t); }}>
                  {t.number}
                </Button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New customer dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do cliente" className="h-9" /></div>
            <div><Label className="text-xs">Telefone</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-9" /></div>
            <div><Label className="text-xs">Endereço</Label><Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Endereço completo" className="h-9" /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setNewCustomerOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateCustomer} disabled={!newName.trim()}>Cadastrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin auth */}
      <Dialog open={adminAuthModal.open} onOpenChange={() => { setAdminAuthModal({ open: false, action: 'remove' }); setAdminAuthEmail(''); setAdminAuthPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> Autorização necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert className="border-warning/50 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                {adminAuthModal.action === 'cancel'
                  ? 'Cancelar um pedido de mesa requer autorização de um administrador.'
                  : 'Remover itens de um pedido de mesa requer autorização de um administrador.'}
              </AlertDescription>
            </Alert>
            <div><Label>Email do administrador</Label><Input type="email" placeholder="admin@email.com" value={adminAuthEmail} onChange={e => setAdminAuthEmail(e.target.value)} /></div>
            <div><Label>Senha do administrador</Label><Input type="password" placeholder="••••••" value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setAdminAuthModal({ open: false, action: 'remove' }); setAdminAuthEmail(''); setAdminAuthPassword(''); }}>Cancelar</Button>
            <Button className="flex-1" onClick={handleAdminAuth} disabled={adminAuthChecking}>
              {adminAuthChecking ? 'Verificando...' : 'Autorizar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PDV;
