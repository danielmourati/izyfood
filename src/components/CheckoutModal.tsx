import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/contexts/StoreContext';
import { Order, PaymentMethod, PaymentSplit } from '@/types';
import { fmt } from '@/lib/utils';
import { CreditCard, QrCode, Wallet, Banknote, Plus, Trash2, Percent, DollarSign, Ticket, Star } from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  selectedCustomerId?: string | null;
  onComplete: () => void;
}

const methods: { key: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { key: 'pix', label: 'PIX', icon: QrCode },
  { key: 'cartao', label: 'Cartão', icon: CreditCard },
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'fiado', label: 'Fiado', icon: Wallet },
];

export function CheckoutModal({ open, onClose, order, selectedCustomerId, onComplete }: CheckoutModalProps) {
  const { completeSale, customers, coupons, products } = useStore();
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [addingMethod, setAddingMethod] = useState<PaymentMethod | null>(null);
  const [addingAmount, setAddingAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [cashGiven, setCashGiven] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [redeemCount, setRedeemCount] = useState(0);

  // Sync selectedCustomer from prop
  useEffect(() => {
    if (open && selectedCustomerId) {
      setSelectedCustomer(selectedCustomerId);
    }
  }, [open, selectedCustomerId]);

  const customerObj = useMemo(() =>
    selectedCustomer ? customers.find(c => c.id === selectedCustomer) : null,
    [customers, selectedCustomer]
  );

  const redeemableCount = customerObj ? Math.floor((customerObj.loyaltyPoints || 0) / 10) : 0;

  // Calculate redemption discount based on eligible items
  const acaiRedemptionDiscount = useMemo(() => {
    if (redeemCount <= 0 || !order) return 0;
    const eligibleItems = order.items.filter(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product || !product.loyaltyEligible) return false;
      if (product.type === 'weight') return item.weight;
      return true;
    });
    if (eligibleItems.length === 0) return 0;
    const cheapestPrice = Math.min(...eligibleItems.map(i => i.price));
    return cheapestPrice * 0.3 * redeemCount;
  }, [redeemCount, order, products]);

  const subtotal = order?.total ?? 0;

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue.replace(',', '.')) || 0;
    if (appliedCoupon) {
      const coupon = coupons.find(c => c.id === appliedCoupon);
      if (coupon) {
        return coupon.type === 'percentage' ? (subtotal * coupon.value) / 100 : coupon.value;
      }
    }
    if (val <= 0) return 0;
    return discountType === 'percentage' ? (subtotal * val) / 100 : val;
  }, [discountValue, discountType, subtotal, appliedCoupon, coupons]);

  const finalTotal = Math.max(0, subtotal - discountAmount - acaiRedemptionDiscount);
  const totalAssigned = splits.reduce((s, p) => s + p.amount, 0);
  const remaining = finalTotal - totalAssigned;
  const hasFiado = splits.some(s => s.method === 'fiado');

  if (!order) return null;

  const addSplit = () => {
    if (!addingMethod) return;
    const amount = parseFloat(addingAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) return;
    setSplits(prev => [...prev, { method: addingMethod, amount }]);
    setAddingMethod(null);
    setAddingAmount('');
  };

  const addFullRemaining = (method: PaymentMethod) => {
    if (remaining <= 0) return;
    setSplits(prev => [...prev, { method, amount: Math.round(remaining * 100) / 100 }]);
  };

  const removeSplit = (idx: number) => {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    const coupon = coupons.find(c => c.code === code && c.active);
    if (!coupon) return;
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return;
    if (coupon.minOrder && subtotal < coupon.minOrder) return;
    setAppliedCoupon(coupon.id);
    setDiscountValue('');
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const handleFinalize = () => {
    if (finalTotal > 0 && splits.length === 0) return;
    if (finalTotal > 0 && Math.abs(remaining) > 0.01 && remaining > 0) return;
    if (hasFiado && !selectedCustomer) return;

    const primaryMethod = splits.length > 0
      ? splits.reduce((a, b) => a.amount >= b.amount ? a : b).method
      : 'pix';

    const finalOrder: Order = {
      ...order,
      total: finalTotal,
      paymentMethod: primaryMethod,
      paymentSplits: splits,
      discount: (discountAmount + acaiRedemptionDiscount) > 0 ? discountAmount + acaiRedemptionDiscount : undefined,
      discountType: discountAmount > 0 ? discountType : undefined,
      couponId: appliedCoupon || undefined,
      customerId: selectedCustomer || order.customerId,
      loyaltyRedemptions: redeemCount > 0 ? redeemCount : undefined,
    };

    completeSale(finalOrder);

    // Reset
    setSplits([]);
    setAddingMethod(null);
    setAddingAmount('');
    setSelectedCustomer(null);
    setCashGiven('');
    setDiscountValue('');
    setAppliedCoupon(null);
    setCouponCode('');
    setRedeemCount(0);
    onComplete();
    onClose();
  };

  const cashSplit = splits.find(s => s.method === 'dinheiro');
  const cashChange = cashSplit && cashGiven ? parseFloat(cashGiven.replace(',', '.')) - cashSplit.amount : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Pagamento</DialogTitle>
        </DialogHeader>

        {/* Customer info */}
        {customerObj && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-foreground">{customerObj.name}</span>
            <Badge variant="outline" className="text-xs">
              ⭐ {customerObj.loyaltyPoints || 0} pts
            </Badge>
          </div>
        )}

        {/* Subtotal */}
        <div className="bg-primary/10 rounded-xl p-3 text-center">
          <p className="text-sm text-muted-foreground">Subtotal</p>
          <p className="text-3xl font-bold text-primary">R$ {fmt(subtotal)}</p>
        </div>

        {/* Loyalty redemption */}
        {customerObj && redeemableCount > 0 && (
          <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Programa Fidelidade</p>
                <p className="text-xs text-muted-foreground">
                  {customerObj.loyaltyPoints} pontos • {redeemableCount} resgate{redeemableCount > 1 ? 's' : ''} disponível
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={redeemCount > 0 ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => setRedeemCount(prev => prev > 0 ? 0 : 1)}
              >
                {redeemCount > 0 ? `✓ Resgatando ${redeemCount}x açaí 300g` : 'Resgatar açaí 300g grátis'}
              </Button>
              {redeemCount > 0 && redeemableCount > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setRedeemCount(prev => Math.max(1, prev - 1))}>
                    <span className="text-xs">−</span>
                  </Button>
                  <span className="text-sm font-semibold w-6 text-center">{redeemCount}</span>
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setRedeemCount(prev => Math.min(redeemableCount, prev + 1))}>
                    <span className="text-xs">+</span>
                  </Button>
                </div>
              )}
            </div>
            {acaiRedemptionDiscount > 0 && (
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                Desconto fidelidade: -R$ {fmt(acaiRedemptionDiscount)}
              </p>
            )}
          </div>
        )}

        {/* Discount section */}
        <div className="space-y-2 border rounded-lg p-3">
          <p className="text-sm font-semibold text-foreground">Desconto</p>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-accent/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="font-mono font-bold text-sm">{coupons.find(c => c.id === appliedCoupon)?.code}</span>
                <span className="text-sm text-muted-foreground">-R$ {fmt(discountAmount)}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={removeCoupon}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="flex border rounded-lg overflow-hidden">
                  <button
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'}`}
                    onClick={() => setDiscountType('fixed')}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${discountType === 'percentage' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'}`}
                    onClick={() => setDiscountType('percentage')}
                  >
                    <Percent className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  className="flex-1 h-9"
                  placeholder={discountType === 'percentage' ? 'Ex: 10' : 'Ex: 5,00'}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  className="flex-1 h-9"
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={applyCoupon} disabled={!couponCode.trim()}>
                  Aplicar
                </Button>
              </div>
            </>
          )}
          {(discountAmount + acaiRedemptionDiscount) > 0 && (
            <p className="text-sm text-primary font-semibold text-right">
              Total com desconto: R$ {fmt(finalTotal)}
            </p>
          )}
        </div>

        {/* Payment splits */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Formas de pagamento</p>

          {splits.length > 0 && (
            <div className="space-y-1.5">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    {React.createElement(methods.find(m => m.key === s.method)?.icon || QrCode, { className: 'h-4 w-4' })}
                    <span className="text-sm font-medium">{methods.find(m => m.key === s.method)?.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">R$ {fmt(s.amount)}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSplit(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {remaining > 0.01 && (
            <div className="bg-destructive/10 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Restante</p>
              <p className="text-lg font-bold text-destructive">R$ {fmt(remaining)}</p>
            </div>
          )}

          {remaining > 0.01 && (
            <div className="grid grid-cols-4 gap-2">
              {methods.map(m => (
                <Button
                  key={m.key}
                  variant="outline"
                  className="h-14 flex-col gap-1 text-xs"
                  onClick={() => addFullRemaining(m.key)}
                >
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </Button>
              ))}
            </div>
          )}

          {remaining > 0.01 && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Valor parcial</Label>
                <div className="flex gap-1.5">
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={addingMethod || ''}
                    onChange={e => setAddingMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="">Método</option>
                    {methods.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                  <Input
                    className="h-9 flex-1"
                    placeholder="Valor"
                    value={addingAmount}
                    onChange={e => setAddingAmount(e.target.value)}
                  />
                  <Button size="sm" className="h-9" onClick={addSplit} disabled={!addingMethod || !addingAmount}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fiado customer selection (fallback if no customer pre-selected) */}
        {hasFiado && !selectedCustomer && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selecionar cliente (fiado):</p>
            <div className="max-h-32 overflow-auto space-y-1">
              {customers.map(c => (
                <Button
                  key={c.id}
                  variant={selectedCustomer === c.id ? 'default' : 'ghost'}
                  className="w-full justify-start h-10 text-sm"
                  onClick={() => setSelectedCustomer(c.id)}
                >
                  {c.name} {c.creditBalance > 0 && <span className="ml-auto text-xs text-destructive">Débito: R$ {fmt(c.creditBalance)}</span>}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Cash change */}
        {cashSplit && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Valor recebido (dinheiro):</p>
            <Input
              className="h-12 text-center text-2xl font-bold"
              placeholder="0,00"
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
            />
            {cashChange > 0 && (
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="text-2xl font-bold text-accent">R$ {fmt(cashChange)}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 h-12" onClick={onClose}>Voltar</Button>
          <Button className="flex-1 h-12" onClick={handleFinalize}>Finalizar Venda</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
