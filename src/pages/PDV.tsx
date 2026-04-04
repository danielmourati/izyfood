import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmt, fmtWeight } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Product, OrderItem, Order, OrderType, TableInfo, Customer } from '@/types';
import { WeightModal } from '@/components/WeightModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, ShoppingCart, Pause, X, ArrowLeft, UserPlus, User, Star, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [weightModal, setWeightModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string>(() => crypto.randomUUID());
  const [initialized, setInitialized] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize from existing order or create new one immediately
  useEffect(() => {
    if (initialized) return;
    if (existingOrder) {
      setCart(existingOrder.items);
      setOrderType(existingOrder.orderType);
      setCurrentOrderId(existingOrder.id);
      if (existingOrder.customerId) setSelectedCustomerId(existingOrder.customerId);
      setInitialized(true);
    } else if (pedidoParam) {
      // pedidoParam exists but order not found yet (loading from realtime)
      // Wait for it
    } else {
      // No pedidoParam — create order immediately in DB
      const newId = currentOrderId;
      const newOrderType = tableNumber ? 'mesa' as const : 'balcao' as const;
      if (tableNumber) setOrderType('mesa');
      const order: Order = {
        id: newId,
        items: [],
        total: 0,
        orderType: newOrderType,
        status: 'aberto',
        tableNumber,
        createdAt: new Date().toISOString(),
      };
      setOrders(prev => [...prev, order]);
      // Redirect to include pedido param so auto-save works
      const params = new URLSearchParams(searchParams);
      params.set('pedido', newId);
      navigate(`/pdv?${params.toString()}`, { replace: true });
      setInitialized(true);
    }
  }, [existingOrder, tableNumber, initialized, pedidoParam]);

  // Helper: resolve customer details from ID
  const { customers } = useStore();
  const resolveCustomer = useCallback((custId: string | null | undefined) => {
    if (!custId) return {};
    const c = customers.find(cx => cx.id === custId);
    if (!c) return {};
    return { customerName: c.name, customerPhone: c.phone, customerAddress: c.address };
  }, [customers]);

  // Debounced auto-save: sync cart + customer to order in DB
  useEffect(() => {
    if (!pedidoParam || !initialized) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const currentTotal = cart.reduce((s, i) => s + i.subtotal, 0);
      setOrders(prev => prev.map(o => {
        if (o.id !== pedidoParam) return o;
        // Don't overwrite held/finalized/cancelled orders with auto-save
        if (o.status === 'segurado' || o.status === 'finalizado' || o.status === 'cancelado') return o;
        const custId = selectedCustomerId || o.customerId;
        return {
          ...o,
          items: cart,
          total: currentTotal,
          customerId: custId,
          ...resolveCustomer(custId),
          orderType,
        };
      }));
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cart, pedidoParam, initialized, setOrders, selectedCustomerId, orderType, resolveCustomer]);

  const filteredProducts = useMemo(() => activeCategoryId === 'all' ? products : products.filter(p => p.categoryId === activeCategoryId), [products, activeCategoryId]);
  const total = useMemo(() => cart.reduce((s, i) => s + i.subtotal, 0), [cart]);

  const addToCart = (product: Product) => {
    if (product.type === 'weight') {
      setWeightModal({ open: true, product });
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id && !i.weight);
      if (existing) {
        return prev.map(i => i.productId === product.id && !i.weight
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
          : i
        );
      }
      return [...prev, {
        id: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
        addedBy: user?.id,
        addedByName: user?.name,
      }];
    });
  };

  const addWeightItem = (weight: number) => {
    const product = weightModal.product!;
    setCart(prev => [...prev, {
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      weight,
      subtotal: weight * product.price,
      addedBy: user?.id,
      addedByName: user?.name,
    }]);
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;
      const newQty = Math.max(1, i.quantity + delta);
      return { ...i, quantity: newQty, subtotal: i.weight ? i.weight * i.price : newQty * i.price };
    }));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

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
    // If order has no value, discard it entirely; otherwise mark as canceled
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
      // Order already exists in DB — just update it with table info
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, orderType: 'mesa', tableNumber: table.number, customerId: selectedCustomerId || undefined } : o
      ));
    } else {
      const order: Order = {
        id: orderId,
        items: cart,
        total,
        orderType: 'mesa',
        status: 'aberto',
        tableNumber: table.number,
        customerId: selectedCustomerId || undefined,
        createdAt: new Date().toISOString(),
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
    // Flush debounce and update with held status
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setOrders(prev => {
      const exists = prev.some(o => o.id === orderId);
      if (exists) {
        return prev.map(o => {
          if (o.id !== orderId) return o;
          const custId = selectedCustomerId || o.customerId;
          return {
            ...o,
            items: cart,
            total,
            status: 'segurado' as const,
            customerId: custId,
            ...resolveCustomer(custId),
            heldAt: new Date().toISOString(),
          };
        });
      }
      // Fallback: create if somehow not yet in state
      const custId = selectedCustomerId || undefined;
      return [...prev, {
        id: orderId,
        items: cart,
        total,
        orderType,
        status: 'segurado' as const,
        tableNumber,
        customerId: custId,
        ...resolveCustomer(custId),
        createdAt: new Date().toISOString(),
        heldAt: new Date().toISOString(),
      }];
    });
    setCart([]);
    setSelectedCustomerId(null);
    if (tableNumber) navigate('/');
  };

  const isHeldMesa = !!(existingOrder && existingOrder.orderType === 'mesa' && (existingOrder.status === 'segurado' || (existingOrder.status === 'aberto' && existingOrder.items.length > 0)));

  const currentOrder: Order = {
    id: currentOrderId,
    items: cart,
    total,
    orderType,
    status: 'aberto',
    tableNumber,
    customerId: selectedCustomerId || undefined,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col p-3 md:p-4 overflow-hidden">
        {tableNumber && (
          <div className="flex items-center gap-3 mb-3">
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

        <div className="flex gap-2 mb-3 md:mb-4 overflow-x-auto pb-1">
          <Button
            variant={activeCategoryId === 'all' ? 'default' : 'outline'}
            className="h-10 md:h-12 px-3 md:px-5 text-sm md:text-base whitespace-nowrap shrink-0"
            onClick={() => setActiveCategoryId('all')}
          >
            Todos
          </Button>
          {categories.map(cat => (
            <Button
              key={cat.id}
              variant={activeCategoryId === cat.id ? 'default' : 'outline'}
              className="h-10 md:h-12 px-3 md:px-5 text-sm md:text-base whitespace-nowrap shrink-0"
              onClick={() => setActiveCategoryId(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {filteredProducts.map(product => {
              const cat = getCategoryById(product.categoryId);
              return (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all active:scale-95 select-none"
                  onClick={() => addToCart(product)}
                >
                  <div className="p-3 md:p-4 text-center space-y-1 md:space-y-2">
                    {product.image ? (
                      <div className="h-12 w-12 md:h-16 md:w-16 mx-auto rounded-xl overflow-hidden">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 md:h-16 md:w-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center text-sm md:text-base font-bold text-primary">
                        {cat?.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <h3 className="font-semibold text-xs md:text-sm leading-tight text-foreground">{product.name}</h3>
                    <p className="text-primary font-bold text-sm">
                      R$ {fmt(product.price)}
                      {product.type === 'weight' && <span className="text-xs text-muted-foreground">/kg</span>}
                    </p>
                    {product.stock <= 5 && (
                      <Badge variant="destructive" className="text-[10px]">Estoque baixo</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="lg:hidden fixed bottom-4 right-4 z-50">
          <Button size="lg" className="h-14 w-14 rounded-full shadow-lg relative" onClick={() => setShowCart(true)}>
            <ShoppingCart className="h-6 w-6" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="hidden lg:flex w-80 xl:w-96 border-l bg-card flex-col">
        <CartContent cart={cart} orderType={orderType} setOrderType={setOrderType} tableNumber={tableNumber} total={total}
          updateQty={updateQty} removeItem={removeItem} cancelOrder={cancelOrder} holdOrder={holdOrder} setCheckoutOpen={setCheckoutOpen}
          tables={tables} onSelectTable={(t) => handleSelectTable(t)}
          selectedCustomerId={selectedCustomerId} onSelectCustomer={setSelectedCustomerId} isHeldMesa={isHeldMesa} />
      </div>

      {showCart && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="ml-auto w-full max-w-sm bg-card flex flex-col relative z-10 animate-in slide-in-from-right">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold text-foreground">Carrinho</span>
              <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <CartContent cart={cart} orderType={orderType} setOrderType={setOrderType} tableNumber={tableNumber} total={total}
              updateQty={updateQty} removeItem={removeItem}
              cancelOrder={() => { cancelOrder(); setShowCart(false); }}
              holdOrder={() => { holdOrder(); setShowCart(false); }}
              setCheckoutOpen={(v) => { setCheckoutOpen(v); setShowCart(false); }}
              tables={tables} onSelectTable={(t) => { setShowCart(false); handleSelectTable(t); }}
              selectedCustomerId={selectedCustomerId} onSelectCustomer={setSelectedCustomerId} isHeldMesa={isHeldMesa} />
          </div>
        </div>
      )}

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
    </div>
  );
};

function CartContent({
  cart, orderType, setOrderType, tableNumber, total, updateQty, removeItem, cancelOrder, holdOrder, setCheckoutOpen, tables, onSelectTable,
  selectedCustomerId, onSelectCustomer, isHeldMesa,
}: {
  cart: OrderItem[]; orderType: OrderType; setOrderType: (t: OrderType) => void; tableNumber?: number;
  total: number; updateQty: (id: string, delta: number) => void; removeItem: (id: string) => void;
  cancelOrder: () => void; holdOrder: () => void; setCheckoutOpen: (v: boolean) => void;
  tables: TableInfo[]; onSelectTable: (t: TableInfo) => void;
  selectedCustomerId: string | null; onSelectCustomer: (id: string | null) => void;
  isHeldMesa: boolean;
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
  // Admin auth for mesa item removal
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

  // Check if cart has items eligible for loyalty
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
      id: crypto.randomUUID(),
      name: newName.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim(),
      notes: '',
      creditBalance: 0,
      loyaltyPoints: 0,
    };
    setCustomers(prev => [...prev, newCustomer]);
    onSelectCustomer(newCustomer.id);
    setNewCustomerOpen(false);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
  };

  return (
    <>
      <div className="p-3 border-b">
        {tableNumber ? (
          <div className="text-center py-1"><Badge className="text-sm px-3 py-1">🪑 Mesa {tableNumber}</Badge></div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(orderTypeLabels) as [OrderType, string][]).map(([key, label]) => (
              <Button key={key} variant={orderType === key ? 'default' : 'ghost'} size="sm" className="text-xs h-9" onClick={() => handleOrderTypeClick(key)}>
                {label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Customer Selector */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-primary" onClick={() => setNewCustomerOpen(true)}>
            <UserPlus className="h-3 w-3" /> Novo
          </Button>
        </div>
        {selectedCustomerId && customerObj ? (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">{customerObj.name}</p>
              <p className="text-xs text-muted-foreground">
                ⭐ {customerObj.loyaltyPoints || 0} pontos
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onSelectCustomer(null)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <Input
              placeholder="Buscar cliente..."
              className="h-8 text-xs"
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
              onFocus={() => setCustomerDropdownOpen(true)}
              onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
            />
            {customerDropdownOpen && customerSearch.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
                {filteredCustomers.map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      onSelectCustomer(c.id);
                      setCustomerSearch('');
                      setCustomerDropdownOpen(false);
                    }}
                  >
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

        {/* Loyalty alert */}
        {selectedCustomerId && customerObj && redeemableCount > 0 && hasEligibleAcaiInCart && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-center animate-in fade-in">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">
              🎉 {redeemableCount} resgate{redeemableCount > 1 ? 's' : ''} de açaí 300g grátis disponível!
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">Carrinho vazio</p>
          </div>
        ) : cart.map(item => {
          const eligible = isItemEligible(item);
          return (
            <div key={item.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm text-foreground">{item.name}</p>
                    {eligible && selectedCustomerId && (
                      <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600 dark:text-green-400 px-1 py-0">
                        <Star className="h-2.5 w-2.5 mr-0.5" />+1 pt
                      </Badge>
                    )}
                  </div>
                  {item.weight && <p className="text-xs text-muted-foreground">{fmtWeight(item.weight)}kg × R$ {fmt(item.price)}/kg</p>}
                  {item.addedByName && <p className="text-[10px] text-muted-foreground">por {item.addedByName}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleProtectedRemove(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                {!item.weight ? (
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                ) : <div />}
                <p className="font-bold text-primary text-sm">R$ {fmt(item.subtotal)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t p-3 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-foreground">Total</span>
          <span className="text-2xl font-bold text-primary">R$ {fmt(total)}</span>
        </div>
        {orderType === 'balcao' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" className="h-12 text-xs" onClick={handleProtectedCancel} disabled={cart.length === 0}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button className="h-12 text-xs" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Pagar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="destructive" className="h-12 text-xs" onClick={handleProtectedCancel} disabled={cart.length === 0 && !tableNumber}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button variant="outline" className="h-12 text-xs" onClick={holdOrder} disabled={cart.length === 0}>
              <Pause className="h-4 w-4 mr-1" /> Segurar
            </Button>
            <Button className="h-12 text-xs" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Pagar
            </Button>
          </div>
        )}
      </div>

      {/* Table selection dialog */}
      <Dialog open={tableModalOpen} onOpenChange={setTableModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Mesa</DialogTitle>
          </DialogHeader>
          {availableTables.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma mesa disponível</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableTables.map(t => (
                <Button
                  key={t.number}
                  variant="outline"
                  className="h-14 text-base font-semibold hover:bg-primary hover:text-primary-foreground"
                  onClick={() => { setTableModalOpen(false); onSelectTable(t); }}
                >
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
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do cliente" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Endereço</Label>
              <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Endereço completo" className="h-9" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setNewCustomerOpen(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={handleCreateCustomer} disabled={!newName.trim()}>Cadastrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin auth for mesa item removal / cancel */}
      <Dialog open={adminAuthModal.open} onOpenChange={() => { setAdminAuthModal({ open: false, action: 'remove' }); setAdminAuthEmail(''); setAdminAuthPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> Autorização necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                {adminAuthModal.action === 'cancel'
                  ? 'Cancelar um pedido de mesa requer autorização de um administrador.'
                  : 'Remover itens de um pedido de mesa requer autorização de um administrador.'}
              </AlertDescription>
            </Alert>
            <div>
              <Label>Email do administrador</Label>
              <Input type="email" placeholder="admin@email.com" value={adminAuthEmail} onChange={e => setAdminAuthEmail(e.target.value)} />
            </div>
            <div>
              <Label>Senha do administrador</Label>
              <Input type="password" placeholder="••••••" value={adminAuthPassword} onChange={e => setAdminAuthPassword(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setAdminAuthModal({ open: false, action: 'remove' }); setAdminAuthEmail(''); setAdminAuthPassword(''); }}>
              Cancelar
            </Button>
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
