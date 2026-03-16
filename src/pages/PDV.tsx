import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fmt, fmtWeight } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Product, OrderItem, Order, OrderType, TableInfo } from '@/types';
import { WeightModal } from '@/components/WeightModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Minus, Trash2, ShoppingCart, Pause, X, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const orderTypeLabels: Record<OrderType, string> = {
  balcao: '🏪 Balcão',
  mesa: '🪑 Mesa',
  delivery: '🛵 Delivery',
  retirada: '📦 Retirada',
};

const PDV = () => {
  const { products, categories, orders, setOrders, tables, setTables, getCategoryById } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showCart, setShowCart] = useState(false);

  const mesaParam = searchParams.get('mesa');
  const pedidoParam = searchParams.get('pedido');
  const tableNumber = mesaParam ? parseInt(mesaParam) : undefined;

  const existingOrder = useMemo(() => {
    if (pedidoParam) return orders.find(o => o.id === pedidoParam);
    return undefined;
  }, [pedidoParam, orders]);

  const [activeCategoryId, setActiveCategoryId] = useState<string>(() => categories[0]?.id || '');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('balcao');
  const [weightModal, setWeightModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string>(() => crypto.randomUUID());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (existingOrder) {
      setCart(existingOrder.items);
      setOrderType(existingOrder.orderType);
      setCurrentOrderId(existingOrder.id);
    } else if (tableNumber) {
      setOrderType('mesa');
    }
    setInitialized(true);
  }, [existingOrder, tableNumber, initialized]);

  useEffect(() => {
    if (!pedidoParam || !initialized) return;
    if (cart.length === 0) return;
    const total = cart.reduce((s, i) => s + i.subtotal, 0);
    setOrders(prev => prev.map(o =>
      o.id === pedidoParam ? { ...o, items: cart, total } : o
    ));
  }, [cart, pedidoParam, initialized, setOrders]);

  const filteredProducts = useMemo(() => products.filter(p => p.categoryId === activeCategoryId), [products, activeCategoryId]);
  const total = useMemo(() => cart.reduce((s, i) => s + i.subtotal, 0), [cart]);

  const addToCart = (product: Product) => {
    if (product.type === 'weight') {
      setWeightModal({ open: true, product });
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id
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
    setCart([]);
    if (tableNumber && pedidoParam) {
      setTables(prev => prev.map(t =>
        t.number === tableNumber ? { ...t, status: 'available', orderId: undefined } : t
      ));
      setOrders(prev => prev.filter(o => o.id !== pedidoParam));
    }
    toast({ title: 'Pedido cancelado' });
    if (tableNumber) navigate('/');
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    if (!pedidoParam) {
      const order: Order = {
        id: currentOrderId,
        items: cart,
        total,
        orderType,
        status: 'segurado',
        tableNumber,
        createdAt: new Date().toISOString(),
        heldAt: new Date().toISOString(),
      };
      setOrders(prev => [...prev, order]);
    }
    setCart([]);
    toast({ title: 'Pedido segurado', description: tableNumber ? `Mesa ${tableNumber}` : `#${currentOrderId.slice(0, 6)}` });
    if (tableNumber) navigate('/');
  };

  const currentOrder: Order = {
    id: currentOrderId,
    items: cart,
    total,
    orderType,
    status: 'aberto',
    tableNumber,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3rem)]">
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

        {/* Category Tabs */}
        <div className="flex gap-2 mb-3 md:mb-4 overflow-x-auto pb-1">
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

        {/* Product Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
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

        <div className="md:hidden fixed bottom-4 right-4 z-50">
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

      <div className="hidden md:flex w-80 lg:w-96 border-l bg-card flex-col">
        <CartContent cart={cart} orderType={orderType} setOrderType={setOrderType} tableNumber={tableNumber} total={total}
          updateQty={updateQty} removeItem={removeItem} cancelOrder={cancelOrder} holdOrder={holdOrder} setCheckoutOpen={setCheckoutOpen}
          tables={tables} onSelectTable={(t) => handleSelectTable(t)} />
      </div>

      {showCart && (
        <div className="md:hidden fixed inset-0 z-50 flex">
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
              tables={tables} onSelectTable={(t) => { setShowCart(false); navigate(`/pdv?mesa=${t.number}`); }} />
          </div>
        </div>
      )}

      <WeightModal open={weightModal.open} onClose={() => setWeightModal({ open: false, product: null })}
        productName={weightModal.product?.name || ''} pricePerKg={weightModal.product?.price || 0} onConfirm={addWeightItem} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)}
        order={cart.length > 0 ? currentOrder : null} onComplete={() => { setCart([]); if (tableNumber) navigate('/'); }} />
    </div>
  );
};

function CartContent({
  cart, orderType, setOrderType, tableNumber, total, updateQty, removeItem, cancelOrder, holdOrder, setCheckoutOpen, tables, onSelectTable,
}: {
  cart: OrderItem[]; orderType: OrderType; setOrderType: (t: OrderType) => void; tableNumber?: number;
  total: number; updateQty: (id: string, delta: number) => void; removeItem: (id: string) => void;
  cancelOrder: () => void; holdOrder: () => void; setCheckoutOpen: (v: boolean) => void;
  tables: TableInfo[]; onSelectTable: (t: TableInfo) => void;
}) {
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const availableTables = tables.filter(t => t.status === 'available');

  const handleOrderTypeClick = (key: OrderType) => {
    if (key === 'mesa') {
      setTableModalOpen(true);
    } else {
      setOrderType(key);
    }
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
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">Carrinho vazio</p>
          </div>
        ) : cart.map(item => (
          <div key={item.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium text-sm text-foreground">{item.name}</p>
                {item.weight && <p className="text-xs text-muted-foreground">{fmtWeight(item.weight)}kg × R$ {fmt(item.price)}/kg</p>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
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
        ))}
      </div>
      <div className="border-t p-3 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-foreground">Total</span>
          <span className="text-2xl font-bold text-primary">R$ {fmt(total)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="destructive" className="h-12 text-xs" onClick={cancelOrder} disabled={cart.length === 0 && !tableNumber}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button variant="outline" className="h-12 text-xs" onClick={holdOrder} disabled={cart.length === 0}>
            <Pause className="h-4 w-4 mr-1" /> Segurar
          </Button>
          <Button className="h-12 text-xs" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Pagar
          </Button>
        </div>
      </div>

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
    </>
  );
}

export default PDV;
