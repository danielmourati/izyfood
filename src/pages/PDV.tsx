import React, { useState, useMemo } from 'react';
import { useStore } from '@/contexts/StoreContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Product, OrderItem, Order, OrderType, ProductCategory } from '@/types';
import { categoryLabels } from '@/data/seed';
import { WeightModal } from '@/components/WeightModal';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Plus, Minus, Trash2, ShoppingCart, Pause, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const orderTypeLabels: Record<OrderType, string> = {
  balcao: '🏪 Balcão',
  mesa: '🪑 Mesa',
  delivery: '🛵 Delivery',
  retirada: '📦 Retirada',
};

const PDV = () => {
  const { products, orders, setOrders } = useStore();
  const [category, setCategory] = useState<ProductCategory>('acai');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('balcao');
  const [weightModal, setWeightModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentOrderId] = useState(() => crypto.randomUUID());

  const filteredProducts = useMemo(() => products.filter(p => p.category === category), [products, category]);
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
    toast({ title: 'Pedido cancelado' });
  };

  const holdOrder = () => {
    if (cart.length === 0) return;
    const order: Order = {
      id: currentOrderId,
      items: cart,
      total,
      orderType,
      status: 'segurado',
      createdAt: new Date().toISOString(),
      heldAt: new Date().toISOString(),
    };
    setOrders(prev => [...prev, order]);
    setCart([]);
    toast({ title: 'Pedido segurado', description: `#${order.id.slice(0, 6)}` });
  };

  const currentOrder: Order = {
    id: currentOrderId,
    items: cart,
    total,
    orderType,
    status: 'aberto',
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Left: Products */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(Object.entries(categoryLabels) as [ProductCategory, string][]).map(([key, label]) => (
            <Button
              key={key}
              variant={category === key ? 'default' : 'outline'}
              className="h-12 px-5 text-base"
              onClick={() => setCategory(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredProducts.map(product => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all active:scale-95 select-none"
                onClick={() => addToCart(product)}
              >
                <div className="p-4 text-center space-y-2">
                  <div className="h-16 w-16 mx-auto rounded-xl bg-primary/10 flex items-center justify-center text-3xl">
                    {product.category === 'acai' ? '🍇' : product.category === 'sorvetes' ? '🍦' : product.category === 'bebidas' ? '🥤' : '✨'}
                  </div>
                  <h3 className="font-semibold text-sm leading-tight text-foreground">{product.name}</h3>
                  <p className="text-primary font-bold">
                    R$ {product.price.toFixed(2)}
                    {product.type === 'weight' && <span className="text-xs text-muted-foreground">/kg</span>}
                  </p>
                  {product.stock <= 5 && (
                    <Badge variant="destructive" className="text-[10px]">Estoque baixo</Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 border-l bg-card flex flex-col">
        {/* Order Type */}
        <div className="p-3 border-b">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(orderTypeLabels) as [OrderType, string][]).map(([key, label]) => (
              <Button
                key={key}
                variant={orderType === key ? 'default' : 'ghost'}
                size="sm"
                className="text-xs h-9"
                onClick={() => setOrderType(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-2 opacity-30" />
              <p className="text-sm">Carrinho vazio</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-foreground">{item.name}</p>
                    {item.weight && <p className="text-xs text-muted-foreground">{item.weight}kg × R$ {item.price.toFixed(2)}/kg</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  {!item.weight ? (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQty(item.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : <div />}
                  <p className="font-bold text-primary text-sm">R$ {item.subtotal.toFixed(2)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Actions */}
        <div className="border-t p-3 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-foreground">Total</span>
            <span className="text-2xl font-bold text-primary">R$ {total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="destructive" className="h-12" onClick={cancelOrder} disabled={cart.length === 0}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button variant="outline" className="h-12" onClick={holdOrder} disabled={cart.length === 0}>
              <Pause className="h-4 w-4 mr-1" /> Segurar
            </Button>
            <Button className="h-12" onClick={() => setCheckoutOpen(true)} disabled={cart.length === 0}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Pagar
            </Button>
          </div>
        </div>
      </div>

      <WeightModal
        open={weightModal.open}
        onClose={() => setWeightModal({ open: false, product: null })}
        productName={weightModal.product?.name || ''}
        pricePerKg={weightModal.product?.price || 0}
        onConfirm={addWeightItem}
      />

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        order={cart.length > 0 ? currentOrder : null}
        onComplete={() => setCart([])}
      />
    </div>
  );
};

export default PDV;
