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
import { Plus, Minus, Trash2, ShoppingCart, Pause, X, ArrowLeft, UserPlus, User, Star, ShieldAlert, AlertTriangle, Search, Printer, FileEdit, MoreHorizontal, Settings, ShieldCheck, Trash, Check, ListChecks, SendHorizontal, RefreshCcw, ReceiptText } from 'lucide-react';
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
  const [initialized, setInitialized] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(() => crypto.randomUUID());

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
  const [mobileView, setMobileView] = useState<'categories' | 'products' | 'cart'>('categories');
  const [mobileLastAddedId, setMobileLastAddedId] = useState<string | null>(null);
  const [editingItemNotesId, setEditingItemNotesId] = useState<string | null>(null);
  const [weightModal, setWeightModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (mobileView !== 'products') {
      setMobileLastAddedId(null);
    }
  }, [mobileView]);

  const { printOrder, printBill } = usePrinter();

  useEffect(() => {
    if (initialized) return;
    if (existingOrder) {
      setCart(existingOrder.items);
      setOrderType(existingOrder.orderType);
      setCurrentOrderId(existingOrder.id);
      if (existingOrder.customerId) setSelectedCustomerId(existingOrder.customerId);
      setInitialized(true);
      if (existingOrder.items.length > 0) {
        setMobileView('cart');
      }
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

  // Clean ghost tables: occupied status but no items in order
  useEffect(() => {
    if (initialized) {
      setTables(prev => {
        let changed = false;
        const next = prev.map(t => {
          if (t.status === 'occupied' && t.orderId) {
            const order = orders.find(o => o.id === t.orderId);
            if (!order || order.items.length === 0) {
              changed = true;
              return { ...t, status: 'available', orderId: undefined };
            }
          }
          return t;
        });
        return changed ? next : prev;
      });
    }
  }, [initialized, orders, setTables]);

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

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id && !i.weight && i.addedBy === user?.id);
      if (existing) {
        setMobileLastAddedId(existing.id);
        return prev.map(i => {
          if (i.id === existing.id) {
            const compsTotal = (i.selectedComplements || []).reduce((a, c) => a + c.price * c.quantity, 0);
            return { ...i, quantity: i.quantity + 1, subtotal: (i.price + compsTotal) * (i.quantity + 1) };
          }
          return i;
        });
      } else {
        const newId = crypto.randomUUID();
        setMobileLastAddedId(newId);
        return [...prev, {
          id: newId, productId: product.id, name: product.name, price: product.price,
          quantity: 1, subtotal: product.price, addedBy: user?.id, addedByName: user?.name,
        }];
      }
    });
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

  const holdOrder = (shouldRedirect = true) => {
    // Only save if we have items
    if (cart.length === 0) return;

    const orderId = pedidoParam || currentOrderId;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Save current items to the persistent store
    const currentCart = [...cart];
    const currentTotal = total;
    const currentOrderType = orderType;
    const custId = selectedCustomerId;

    setOrders(prev => {
      const exists = prev.some(o => o.id === orderId);
      if (exists) {
        return prev.map(o => {
          if (o.id !== orderId) return o;
          const finalCustId = custId || o.customerId;
          return {
            ...o,
            items: currentCart,
            total: currentTotal,
            status: 'segurado' as const,
            customerId: finalCustId,
            ...resolveCustomer(finalCustId),
            heldAt: new Date().toISOString()
          };
        });
      }
      return [...prev, {
        id: orderId,
        items: currentCart,
        total: currentTotal,
        orderType: currentOrderType,
        status: 'segurado' as const,
        tableNumber,
        customerId: custId || undefined,
        ...resolveCustomer(custId),
        createdAt: new Date().toISOString(),
        heldAt: new Date().toISOString(),
      }];
    });

    if (tableNumber) {
      setTables(prev => prev.map(t =>
        t.number === tableNumber ? { ...t, status: 'occupied', orderId } : t
      ));
    }

    if (shouldRedirect) {
      setCart([]);
      setSelectedCustomerId(null);
      setCurrentOrderId(crypto.randomUUID());
      if (tableNumber) navigate('/');
    }
  };

  const isHeldMesa = !!(existingOrder && existingOrder.orderType === 'mesa' && (existingOrder.status === 'segurado' || (existingOrder.status === 'aberto' && existingOrder.items.length > 0)));

  // Only go to cart view on mobile when opening an already held/occupied table
  // This logic is now handled during initial product load to avoid jumping while adding items.

  const executeDeleteOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    setOrders(prev => prev.filter(o => o.id !== orderId));
    if (order.tableNumber) {
      setTables(prev => prev.map(t =>
        t.number === order.tableNumber ? { ...t, status: 'available', orderId: undefined } : t
      ));
    }
    setCart([]);
    setSelectedCustomerId(null);
    toast.success('Pedido excluído com sucesso!');
    navigate('/');
  };

  const currentOrder: Order = {
    id: currentOrderId, items: cart, total, orderType, status: 'aberto',
    tableNumber, customerId: selectedCustomerId || undefined, createdAt: new Date().toISOString(),
  };

  const handleSendAndHold = async () => {
    if (cart.length === 0) return;
    const cust = customers.find(c => c.id === currentOrder.customerId);
    const markedCart = cart.map(i => ({ ...i, printed: true }));
    
    const orderData = {
      ...currentOrder,
      items: markedCart,
      operatorName: user?.name,
      customerName: cust?.name || undefined,
    };

    // 1. Enviar para a impressora
    try {
      await printOrder(orderData);
      toast.success('Comanda enviada para impressão!');
    } catch (err) {
      toast.error('Erro na impressão, mas o pedido será salvo.');
    }

    // 2. Atualizar estado interno
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const orderId = pedidoParam || currentOrderId;
    
    setOrders(prev => {
      const exists = prev.some(o => o.id === orderId);
      if (exists) {
        return prev.map(o => {
          if (o.id !== orderId) return o;
          const custId = selectedCustomerId || o.customerId;
          return { ...o, items: markedCart, total, status: 'segurado' as const, customerId: custId, ...resolveCustomer(custId), heldAt: new Date().toISOString() };
        });
      }
      const custId = selectedCustomerId || undefined;
      return [...prev, {
        id: orderId, items: markedCart, total, orderType, status: 'segurado' as const,
        tableNumber, customerId: custId, ...resolveCustomer(custId), createdAt: new Date().toISOString(), heldAt: new Date().toISOString(),
      }];
    });

    if (tableNumber) {
      setTables(prev => prev.map(t =>
        t.number === tableNumber ? { ...t, status: 'occupied', orderId } : t
      ));
    }

    // 3. Reset visual
    setCart([]);
    setSelectedCustomerId(null);
    setCurrentOrderId(crypto.randomUUID());
    if (orderType === 'delivery' || orderType === 'retirada') {
      navigate('/entregas');
    } else if (tableNumber) {
      navigate('/');
    } else {
      setMobileView('categories');
    }
  };

  const handleReprintOrder = async (items: OrderItem[]) => {
    if (items.length === 0) return;
    const cust = customers.find(c => c.id === currentOrder.customerId);
    const orderData = {
      ...currentOrder,
      items,
      operatorName: user?.name,
      customerName: cust?.name || undefined,
    };
    try {
      await printOrder(orderData);
      toast.success(`${items.length} item(ns) reimpresso(s)!`);
    } catch (err) {
      toast.error('Erro na reimpressão.');
    }
  };

  const handlePrintBill = async () => {
    if (cart.length === 0) return;
    const cust = customers.find(c => c.id === currentOrder.customerId);
    const billData = {
      ...currentOrder,
      operatorName: user?.name,
      customerName: cust?.name || currentOrder.customerName || 'Consumidor',
    };
    try {
      await printBill(billData);
      toast.success('Conta enviada para impressão!');
    } catch (err) {
      toast.error('Erro ao imprimir conta.');
    }
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
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9 2xl:grid-cols-11 gap-2">
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
              onPrintOrder={handleSendAndHold} onReprintOrder={handleReprintOrder} onPrintBill={handlePrintBill}
              setEditingItemNotesId={setEditingItemNotesId} isMobile={false}
              onDeleteOrder={() => executeDeleteOrder(pedidoParam || currentOrderId)} />
          </div>
        </div>
      </div>

      {/* --- MOBILE LAYOUT --- */}
      <div className="flex lg:hidden flex-col h-full bg-background overflow-hidden">
        {mobileView === 'categories' && (
          <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-foreground drop-shadow-sm">Categorias</h2>
              </div>
              <div className="flex items-center gap-2">
                {tableNumber && <Badge variant="secondary" className="text-xs uppercase bg-primary text-primary-foreground font-bold">Mesa {tableNumber}</Badge>}
              </div>
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

            {/* Footer Categorias */}
            <div className="mt-auto border-t bg-card p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] shrink-0 pb-safe">
              <div className="flex gap-3 h-16">
                <Button variant="outline" className="flex-1 h-full flex flex-col items-center justify-center font-bold text-xs bg-background border-muted-foreground/20 text-foreground shadow-sm" onClick={() => navigate('/')}>
                  <ArrowLeft className="h-6 w-6 mb-0.5" /> VOLTAR
                </Button>
                <Button className="flex-[2] h-full flex flex-col items-center justify-center font-bold text-xs bg-[#4CAF50] hover:bg-[#388E3C] text-white relative shadow-sm" onClick={() => setMobileView('cart')} disabled={cart.length === 0}>
                  <ShoppingCart className="h-5 w-5 mb-0.5 opacity-90" />
                  <span className="flex items-center">
                    REVISAR
                    {cart.length > 0 && (
                      <span className="font-extrabold ml-1.5 opacity-95 text-sm">R$ {fmt(total)}</span>
                    )}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {mobileView === 'products' && (
          <div className="flex-1 flex flex-col overflow-hidden relative bg-card">
            <div className="flex items-center gap-2 p-3 border-b bg-card shrink-0 shadow-sm z-10">
              <Button variant="ghost" size="icon" onClick={() => setMobileView('categories')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-bold truncate flex-1">
                {activeCategoryId === 'all' ? 'Todos os Produtos' : getCategoryById(activeCategoryId)?.name}
              </h2>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={() => navigate('/')} title="Ver mesas">
                <span className="text-base leading-none">⊞</span>
              </Button>
            </div>

            <div className="flex-1 overflow-auto px-3 py-3 pb-24 bg-muted/10">
              <div className="grid grid-cols-3 gap-2">
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
                  <div className="bg-[#4CAF50] p-3 flex flex-col gap-3 shadow-[0_-8px_20px_-3px_rgba(0,0,0,0.3)]">
                    <div className="flex justify-between items-center text-white px-1">
                      <div className="flex items-center gap-1.5 font-bold text-[17px] drop-shadow-sm leading-none">
                        <Check className="h-5 w-5" /> {lastItem.name} 
                        <span className="opacity-90 font-medium ml-1">R$ {fmt(lastItem.price)}</span>
                      </div>
                      <div className="bg-blue-500/90 border border-blue-400 rounded-sm text-sm px-2 py-0.5 font-black shadow-sm tracking-widest text-white leading-none">
                        x{lastItem.quantity}
                      </div>
                    </div>
                    <div className="flex gap-2 h-12">
                      <Button variant="outline" className="flex-1 bg-white text-emerald-700 hover:bg-gray-100 font-black text-xl rounded shadow-sm border border-black/10 active:scale-95" onClick={() => updateQty(lastItem.id, 1)}>
                        <Plus className="h-5 w-5 mr-1 stroke-[3]" /> 1
                      </Button>
                      <Button variant="outline" className="flex-1 bg-white text-destructive hover:bg-gray-100 font-black text-xl rounded shadow-sm border border-black/10 active:scale-95" onClick={() => updateQty(lastItem.id, -1)} disabled={lastItem.quantity <= 1}>
                        <Minus className="h-5 w-5 mr-1 stroke-[3]" /> 1
                      </Button>
                      <Button variant="outline" className="w-[60px] bg-white text-destructive hover:bg-gray-100 rounded shadow-sm border border-black/10 active:scale-95 px-0" onClick={() => removeItem(lastItem.id)}>
                        <Trash2 className="h-5 w-5 stroke-[2.5]" />
                      </Button>
                      <Button variant="outline" className="w-[60px] bg-white text-blue-500 hover:bg-gray-100 rounded shadow-sm border border-black/10 active:scale-95 px-0 relative" onClick={() => setEditingItemNotesId(lastItem.id)}>
                        <ListChecks className="h-5 w-5 stroke-[2.5]" />
                        {lastItem.notes && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive outline outline-2 outline-white"></span>}
                      </Button>
                    </div>
                  </div>
                );
                return null;
              })()}

              <div className="flex bg-card p-2 gap-2 border-t mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] h-[68px]">
                <Button variant="outline" className="flex-1 h-full flex flex-col items-center justify-center font-bold text-[10px] bg-muted/30 border-muted-foreground/20 text-foreground" onClick={() => setMobileView('categories')}>
                  <ArrowLeft className="h-6 w-6 mb-0.5" /> VOLTAR
                </Button>
                <Button className="flex-[2] h-full flex flex-col items-center justify-center font-bold text-xs bg-[#4CAF50] hover:bg-[#388E3C] text-white relative shadow-sm" onClick={() => setMobileView('cart')} disabled={cart.length === 0}>
                  <ShoppingCart className="h-5 w-5 mb-0.5 opacity-90" />
                  <span className="flex items-center">
                    REVISAR
                    {cart.length > 0 && (
                      <span className="font-extrabold ml-1.5 opacity-95">R$ {fmt(total)}</span>
                    )}
                  </span>
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
              <span className="font-semibold text-lg flex-1 text-center">
                {tableNumber ? `Mesa ${tableNumber}` : 'Revisar Pedido'}
              </span>
            </div>
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/10 pb-16">
              <CartContent
                cart={cart} orderType={orderType} setOrderType={setOrderType} tableNumber={tableNumber} total={total}
                updateQty={updateQty} removeItem={removeItem}
                cancelOrder={() => { cancelOrder(); setMobileView('categories'); }}
                holdOrder={() => { holdOrder(false); setMobileView('categories'); }}
                setCheckoutOpen={(v) => { setCheckoutOpen(v); }}
                tables={tables} onSelectTable={(t) => { handleSelectTable(t); }}
                selectedCustomerId={selectedCustomerId} onSelectCustomer={setSelectedCustomerId} isHeldMesa={isHeldMesa}
                onPrintOrder={handleSendAndHold} onReprintOrder={handleReprintOrder} onPrintBill={handlePrintBill}
                setEditingItemNotesId={setEditingItemNotesId}
                isMobile={true} onAddNewItem={() => setMobileView('categories')}
                onDeleteOrder={() => executeDeleteOrder(pedidoParam || currentOrderId)}
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
  selectedCustomerId, onSelectCustomer, isHeldMesa, onPrintOrder, onReprintOrder, onPrintBill, setEditingItemNotesId, isMobile, onAddNewItem, onDeleteOrder
}: {
  cart: OrderItem[]; orderType: OrderType; setOrderType: (t: OrderType) => void; tableNumber?: number;
  total: number; updateQty: (id: string, delta: number) => void; removeItem: (id: string) => void;
  cancelOrder: () => void; holdOrder: () => void; setCheckoutOpen: (v: boolean) => void;
  tables: TableInfo[]; onSelectTable: (t: TableInfo) => void;
  selectedCustomerId: string | null; onSelectCustomer: (id: string | null) => void;
  isHeldMesa: boolean;
  onPrintOrder?: () => void;
  onReprintOrder?: (items: OrderItem[]) => void;
  onPrintBill?: () => void;
  setEditingItemNotesId?: (id: string) => void;
  isMobile?: boolean;
  onAddNewItem?: () => void;
  onDeleteOrder?: () => void;
}) {
  const { customers, setCustomers, products, categories } = useStore();
  const { isAdmin } = useAuth();
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [adminAuthModal, setAdminAuthModal] = useState<{ open: boolean; action: 'remove' | 'cancel' | 'delete'; itemId?: string }>({ open: false, action: 'remove' });
  const [adminAuthEmail, setAdminAuthEmail] = useState('');
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [adminAuthChecking, setAdminAuthChecking] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [reprintModalOpen, setReprintModalOpen] = useState(false);
  const [reprintSelected, setReprintSelected] = useState<Set<string>>(new Set());

  const printedItems = cart.filter(i => i.printed);
  const hasAnyPrinted = printedItems.length > 0;

  const handleReprintClick = () => {
    if (!hasAnyPrinted) {
      // Nothing printed yet — just print all
      if (onReprintOrder) onReprintOrder(cart);
    } else {
      // Has printed items — open modal
      setReprintSelected(new Set(cart.map(i => i.id)));
      setReprintModalOpen(true);
    }
  };

  const toggleReprintItem = (id: string) => {
    setReprintSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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

  const handleProtectedDelete = () => {
    if (needsAdminAuth) {
      setAdminAuthModal({ open: true, action: 'delete' });
    } else {
      if (onDeleteOrder) onDeleteOrder();
    }
    setMoreOptionsOpen(false);
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
      else if (action === 'delete') {
        if (onDeleteOrder) onDeleteOrder();
      }
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
      {/* Order type / table header - hides badge in mobile (shown in page header) */}
      {!isMobile && (
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
      )}

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
          <button
            className="text-primary text-[11px] font-semibold hover:underline underline-offset-2 flex items-center gap-1"
            onClick={() => setCustomerModalOpen(true)}
          >
            <User className="h-3 w-3" /> Vincular Cliente
          </button>
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
            <p className="text-[16px] font-medium text-muted-foreground leading-tight">
              Cliente: {customerObj.name} {customerObj.phone ? `(${customerObj.phone})` : ''}
            </p>
          )}
          <p className="text-[18px] font-medium text-foreground mt-1">
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
                    <span className="font-bold text-[16px] text-foreground leading-tight">{item.name}</span>
                    {item.printed && <Printer className="h-4 w-4 text-muted-foreground ml-1" title="Impresso/Enviado" />}
                    {eligible && selectedCustomerId && (
                      <Badge variant="outline" className="text-[10px] text-primary px-1 py-0 leading-none h-4 border-primary/30">
                        <Star className="h-2.5 w-2.5 mr-0.5" />+1
                      </Badge>
                    )}
                  </div>
                  {item.weight ? (
                    <p className="text-[14px] text-muted-foreground leading-none mt-1">{fmtWeight(item.weight)}kg × R$ {fmt(item.price)}/kg</p>
                  ) : null}
                  {item.addedByName && <p className="text-[12px] text-muted-foreground opacity-70 mt-0.5">por {item.addedByName}</p>}
                  <div className="mt-1.5 flex flex-col items-start gap-1">
                    {item.notes && <p className="text-[14px] font-medium leading-tight opacity-90 text-foreground"><span className="font-bold text-primary">Obs:</span> {item.notes}</p>}
                    {setEditingItemNotesId && (
                      <Button variant="outline" size="sm" className="h-8 text-[12px] px-3 w-fit bg-muted/60 border-muted-foreground/30 hover:bg-muted" onClick={() => setEditingItemNotesId(item.id)}>
                        <FileEdit className="h-3.5 w-3.5 mr-1" /> {item.notes ? 'Editar' : 'Anotações'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 justify-between h-full gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/80 hover:text-destructive opacity-50 hover:opacity-100" onClick={() => handleProtectedRemove(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <span className="font-bold text-[16px] text-primary leading-none">R$ {fmt(item.subtotal)}</span>
                </div>
              </div>
              {!item.weight && (
                <div className="flex items-center gap-1 self-start mt-1 bg-muted/30 rounded-md p-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-background shadow-sm rounded-sm" onClick={() => updateQty(item.id, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                  <span className="w-8 text-center font-bold text-[16px]">{item.quantity}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-background shadow-sm rounded-sm" onClick={() => updateQty(item.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
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
            <span className="text-[12px] font-medium text-muted-foreground leading-none">Subtotal</span>
            <span className="text-lg font-bold text-foreground">R$ {fmt(total)}</span>
          </div>
          <div className="text-right">
            <span className="text-[12px] uppercase font-bold text-muted-foreground opacity-60 leading-none">Total</span>
            <p className="text-2xl font-bold text-primary leading-none">R$ {fmt(total)}</p>
          </div>
        </div>
        {isMobile && tableNumber ? (
          <div className="grid grid-cols-4 gap-2 pt-2">
            <Button variant="outline" className="h-[68px] flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-background border-muted-foreground/20 text-foreground" onClick={() => {
              if (cart.length === 0) cancelOrder();
              else holdOrder();
            }}>
              <ArrowLeft className="h-6 w-6" /> VOLTAR
            </Button>
            <div className="flex flex-col gap-1 h-[68px]">
              <Button className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold shadow-sm bg-[#4CAF50] hover:bg-[#388E3C] text-white h-auto py-1" onClick={onPrintOrder} disabled={cart.length === 0}>
                <SendHorizontal className="h-5 w-5" /> ENVIAR
              </Button>
              <Button variant="secondary" className="h-5 shrink-0 text-[10px] font-bold p-0 rounded border border-border/50 text-foreground" onClick={() => setMoreOptionsOpen(true)}>
                MAIS
              </Button>
            </div>
            <Button className="h-[68px] flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-[#673AB7] hover:bg-[#512DA8] text-white" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <span className="text-2xl font-black leading-none">$</span> PAGAR
            </Button>
            {cart.some(i => i.printed) && (
              <Button className="h-[68px] flex flex-col gap-1 text-[10px] font-bold shadow-sm bg-[#2196F3] hover:bg-[#1976D2] text-white" onClick={onAddNewItem}>
                <Plus className="h-6 w-6" /> NOVO
              </Button>
            )}
          </div>
        ) : orderType === 'mesa' ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1.5">
              <Button variant="ghost" className="h-8 px-0 text-destructive bg-destructive/10 hover:bg-destructive/20 text-[10px]" onClick={handleProtectedCancel} disabled={cart.length === 0 && !tableNumber}>
                <X className="h-3 w-3" />
              </Button>
              <Button className="h-8 text-[11px] px-1 font-bold shadow-sm bg-[#4CAF50] hover:bg-[#388E3C] text-white" onClick={onPrintOrder} disabled={cart.length === 0}>
                <SendHorizontal className="h-3.5 w-3.5 mr-1.5" /> ENVIAR
              </Button>
              <Button className="h-8 text-[11px] px-1 font-bold shadow-sm" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Pagar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold gap-1" onClick={handleReprintClick} disabled={cart.length === 0}>
                <RefreshCcw className="h-3 w-3" /> Reimpr.
              </Button>
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold gap-1" onClick={onPrintBill} disabled={cart.length === 0}>
                <ReceiptText className="h-3 w-3" /> Conta
              </Button>
            </div>
          </div>
        ) : orderType === 'balcao' ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="destructive" className="h-8 text-[11px] font-semibold" onClick={handleProtectedCancel} disabled={cart.length === 0}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
              <Button className="h-8 text-[11px] font-semibold shadow-sm" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
                <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Pagar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold gap-1" onClick={handleReprintClick} disabled={cart.length === 0}>
                <RefreshCcw className="h-3 w-3" /> Reimpr.
              </Button>
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold gap-1" onClick={onPrintBill} disabled={cart.length === 0}>
                <ReceiptText className="h-3 w-3" /> Conta
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-4 gap-1.5">
              <Button variant="ghost" className="h-8 px-0 text-destructive bg-destructive/10 hover:bg-destructive/20 text-[10px]" onClick={handleProtectedCancel} disabled={cart.length === 0 && !tableNumber}>
                <X className="h-3 w-3" />
              </Button>
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold" onClick={holdOrder} disabled={cart.length === 0}>
                <Pause className="h-3 w-3 mr-0.5" /> Segur.
              </Button>
              <Button className="h-8 text-[10px] px-1 font-bold shadow-sm bg-[#4CAF50] hover:bg-[#388E3C] text-white" onClick={onPrintOrder} disabled={cart.length === 0}>
                <SendHorizontal className="h-3 w-3 mr-0.5" /> Enviar
              </Button>
              <Button className="h-8 text-[11px] px-1 font-bold shadow-sm" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Pagar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold gap-1" onClick={handleReprintClick} disabled={cart.length === 0}>
                <RefreshCcw className="h-3 w-3" /> Reimprimir
              </Button>
              <Button variant="outline" className="h-8 text-[10px] px-1 font-semibold gap-1" onClick={onPrintBill} disabled={cart.length === 0}>
                <ReceiptText className="h-3 w-3" /> Conta
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reprint Modal */}
      <Dialog open={reprintModalOpen} onOpenChange={setReprintModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4 text-primary" /> Reimprimir Itens
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione os itens que deseja reimprimir:</p>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {cart.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={reprintSelected.has(item.id)}
                    onChange={() => toggleReprintItem(item.id)}
                    className="h-4 w-4 accent-primary rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantity}× R$ {fmt(item.price)}</p>
                  </div>
                  {item.printed && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">Impresso</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex gap-2 pt-1 border-t">
              <Button
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => {
                  if (onReprintOrder) onReprintOrder(cart);
                  setReprintModalOpen(false);
                }}
              >
                <RefreshCcw className="h-3.5 w-3.5" /> Todos
              </Button>
              <Button
                className="flex-1 gap-1.5"
                disabled={reprintSelected.size === 0}
                onClick={() => {
                  const selected = cart.filter(i => reprintSelected.has(i.id));
                  if (onReprintOrder && selected.length > 0) onReprintOrder(selected);
                  setReprintModalOpen(false);
                }}
              >
                <Printer className="h-3.5 w-3.5" /> Selecionados ({reprintSelected.size})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Table selection dialog */}
      < Dialog open={tableModalOpen} onOpenChange={setTableModalOpen} >
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
      </Dialog >

      {/* Customer search/link modal */}
      < Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen} >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Vincular Cliente</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setCustomerModalOpen(false); setNewCustomerOpen(true); }}>
                <UserPlus className="h-3 w-3" /> Novo
              </Button>
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Buscar por nome ou telefone..."
            className="h-9"
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
          />
          <div className="max-h-56 overflow-auto rounded-md border divide-y">
            {filteredCustomers.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado</p>
            ) : filteredCustomers.map(c => (
              <button key={c.id} className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex justify-between items-center"
                onClick={() => { onSelectCustomer(c.id); setCustomerSearch(''); setCustomerModalOpen(false); }}>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                </div>
                {(c.loyaltyPoints || 0) > 0 && (
                  <span className="text-xs text-primary font-bold shrink-0 ml-2">⭐ {c.loyaltyPoints} pts</span>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog >

      {/* New customer dialog */}
      < Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen} >
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
      </Dialog >

      {/* Mais Opções */}
      <Dialog open={moreOptionsOpen} onOpenChange={setMoreOptionsOpen}>
        <DialogContent className="max-w-xs rounded-2xl w-[90vw]">
          <DialogHeader>
            <DialogTitle>Mais Opções</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button variant="outline" className="flex items-center gap-2 justify-start h-12 text-base font-semibold shadow-sm text-foreground" onClick={() => { setMoreOptionsOpen(false); setTableModalOpen(true); }}>
              <ArrowLeft className="h-5 w-5" /> Trocar de Mesa
            </Button>
            <Button variant="destructive" className="flex items-center gap-2 justify-start h-12 text-base font-bold shadow-sm" onClick={handleProtectedDelete}>
              <Trash2 className="h-5 w-5" /> Excluir Pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin auth */}
      < Dialog open={adminAuthModal.open} onOpenChange={() => { setAdminAuthModal({ open: false, action: 'remove' }); setAdminAuthEmail(''); setAdminAuthPassword(''); }
      }>
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
                  : adminAuthModal.action === 'delete'
                  ? 'Excluir completamente um pedido requer autorização de um administrador.'
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
      </Dialog >
    </>
  );
}

export default PDV;
