import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/contexts/StoreContext';
import { supabase } from '@/integrations/supabase/client';
import { Order, PaymentMethod, PaymentSplit } from '@/types';
import { fmt } from '@/lib/utils';
import { CreditCard, QrCode, Wallet, Banknote, Plus, Trash2, Percent, DollarSign, Ticket, Star, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Printer, Info, CheckCircle2, ChevronLeft, ShoppingBag, X } from 'lucide-react';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { toast } from 'sonner';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  selectedCustomerId?: string | null;
  onComplete: () => void;
}

const paymentMethodsConfig: { key: PaymentMethod; shortcut: string; label: string; icon: React.ElementType }[] = [
  { key: 'dinheiro', shortcut: 'A', label: 'Dinheiro', icon: Banknote },
  { key: 'pix', shortcut: 'P', label: 'Pix', icon: QrCode },
  { key: 'cartao', shortcut: 'C', label: 'Crédito', icon: CreditCard },
  { key: 'cartao', shortcut: 'B', label: 'Débito', icon: CreditCard },
  { key: 'cartao', shortcut: 'D', label: 'V. Refeição', icon: ShoppingBag },
  { key: 'fiado', shortcut: 'F', label: 'Fiado', icon: Wallet },
  { key: 'pix', shortcut: 'O', label: 'Outros', icon: DollarSign },
];

export function CheckoutModal({ open, onClose, order, selectedCustomerId, onComplete }: CheckoutModalProps) {
  const navigate = useTenantNavigate();
  const { completeSale, customers, coupons, products, isCashRegisterOpen, settings } = useStore();
  const [cashRegisterChecked, setCashRegisterChecked] = useState(false);
  const [localCashOpen, setLocalCashOpen] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [addingMethod, setAddingMethod] = useState<PaymentMethod | null>(null);
  const [addingAmount, setAddingAmount] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [cashGiven, setCashGiven] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showTaxDiscountModal, setShowTaxDiscountModal] = useState(false);
  const [summaryAccordionOpen, setSummaryAccordionOpen] = useState(true);

  // Service fee percentage
  const serviceFeePercentage = settings.serviceFeePercentage ?? 0;

  useEffect(() => {
    if (open) {
      supabase.from('cash_registers').select('id').is('closed_at', null).limit(1).then(({ data }) => {
        setLocalCashOpen(!!(data && data.length > 0));
        setCashRegisterChecked(true);
      });
    } else {
      setCashRegisterChecked(false);
    }
  }, [open]);

  const effectiveCashOpen = cashRegisterChecked ? localCashOpen : isCashRegisterOpen;

  useEffect(() => {
    if (open && selectedCustomerId) {
      setSelectedCustomer(selectedCustomerId);
    }
  }, [open, selectedCustomerId]);

  const customerObj = useMemo(() =>
    selectedCustomer ? customers.find(c => c.id === selectedCustomer) : null,
    [customers, selectedCustomer]
  );

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

  const isMesa = order?.orderType === 'mesa';
  const serviceFeeAmount = isMesa && serviceFeePercentage > 0 ? (subtotal * serviceFeePercentage) / 100 : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount + serviceFeeAmount);
  const totalAssigned = splits.reduce((s, p) => s + p.amount, 0);
  const remaining = finalTotal - totalAssigned;
  const hasFiado = splits.some(s => s.method === 'fiado');

  if (!order) return null;

  const handleSelectMethod = (method: PaymentMethod, defaultAmt?: number) => {
    const targetAmt = defaultAmt !== undefined ? defaultAmt : (remaining > 0 ? remaining : finalTotal);
    setSplits(prev => [...prev, { method, amount: Math.round(targetAmt * 100) / 100 }]);
    toast.success(`Adicionado pagamento em ${method.toUpperCase()}`);
  };

  const removeSplit = (idx: number) => {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleFinalize = () => {
    if (!effectiveCashOpen) {
      toast.error('O caixa não está aberto.');
      return;
    }
    if (finalTotal > 0 && splits.length === 0) {
      toast.error('Adicione pelo menos uma forma de pagamento.');
      return;
    }
    if (finalTotal > 0 && totalAssigned < finalTotal - 0.01) {
      toast.error('O valor pago é inferior ao total do pedido.');
      return;
    }
    if (hasFiado && !selectedCustomer) {
      toast.error('Selecione um cliente para venda no Fiado.');
      return;
    }

    const primaryMethod = splits.length > 0
      ? splits.reduce((a, b) => a.amount >= b.amount ? a : b).method
      : 'pix';

    const finalOrder: Order = {
      ...order,
      total: finalTotal,
      paymentMethod: primaryMethod,
      paymentSplits: splits,
      discount: discountAmount > 0 ? discountAmount : undefined,
      discountType: discountAmount > 0 ? discountType : undefined,
      couponId: appliedCoupon || undefined,
      customerId: selectedCustomer || order.customerId,
      serviceFee: serviceFeeAmount > 0 ? serviceFeeAmount : undefined,
    };

    completeSale(finalOrder);

    setSplits([]);
    setAddingMethod(null);
    setAddingAmount('');
    setSelectedCustomer(null);
    setCashGiven('');
    setDiscountValue('');
    setAppliedCoupon(null);
    onComplete();
    onClose();
  };

  const cashSplit = splits.find(s => s.method === 'dinheiro');
  const cashChange = cashSplit && cashGiven ? parseFloat(cashGiven.replace(',', '.')) - cashSplit.amount : 0;
  const shortOrderId = order.id.slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-card text-card-foreground border-border p-0 overflow-hidden font-sans shadow-2xl">
        
        {/* Titlebar (Matching Anexo 3) */}
        <div className="bg-muted/70 px-4 py-2.5 flex justify-between items-center border-b border-border shrink-0">
          <h3 className="text-sm font-bold text-foreground">
            Pagamento - Pedido #{shortOrderId}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" opacity={0.8} />
          </button>
        </div>

        {/* Sub-Header Bar (Conferir e rachar | Caixa status) */}
        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border text-xs shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
            <span>Conferir e rachar a conta</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <Info className="h-3.5 w-3.5" />
            <span>Caixa aberto</span>
          </div>
        </div>

        {!effectiveCashOpen && (
          <div className="p-3 bg-destructive/10 border-b border-destructive/30">
            <Alert variant="destructive" className="border-none p-0 bg-transparent">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs font-medium flex items-center justify-between gap-2">
                <span>O caixa não está aberto. Abra o caixa antes de finalizar uma venda.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => { onClose(); navigate('/caixa'); }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Abrir Caixa
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Body Grid Layout (Matching Anexo 3) */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] bg-background">
          
          {/* Left Column: Adicionar Pagamento Methods list */}
          <div className="md:col-span-4 bg-muted/20 border-r border-border p-3 flex flex-col gap-2 overflow-y-auto">
            <span className="text-xs font-bold text-foreground px-1 mb-1 block">
              Adicionar Pagamento
            </span>

            <div className="space-y-1.5">
              {paymentMethodsConfig.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.shortcut + m.label}
                    type="button"
                    onClick={() => handleSelectMethod(m.key)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md border border-border/80 bg-card hover:bg-muted text-foreground transition-all shadow-xs group text-left"
                  >
                    <div className="p-1.5 rounded bg-muted/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold flex-1">
                      <strong className="font-extrabold mr-1">{m.shortcut} -</strong> {m.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fiado Customer Selection if Fiado selected */}
            {hasFiado && !selectedCustomer && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md space-y-1.5">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Selecione o Cliente (Fiado):</p>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {customers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCustomer(c.id)}
                      className="w-full text-left p-1.5 rounded text-xs hover:bg-muted text-foreground truncate block"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Main Panel: Resumo dos Totais & Splits List */}
          <div className="md:col-span-8 p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              
              {/* Accordion Card: A Pagar / Resumo dos Totais */}
              <div className="border border-border rounded-md overflow-hidden bg-card shadow-xs">
                <button
                  type="button"
                  onClick={() => setSummaryAccordionOpen(!summaryAccordionOpen)}
                  className="w-full px-3 py-2 bg-muted/40 flex items-center justify-between border-b border-border text-xs font-bold text-primary hover:bg-muted/60 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {summaryAccordionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    A Pagar / Resumo dos Totais
                  </span>
                </button>

                {summaryAccordionOpen && (
                  <div className="p-3 space-y-2 text-xs divide-y divide-border/60">
                    <div className="flex justify-between py-1 text-foreground">
                      <span>Total dos itens</span>
                      <span className="font-semibold">{fmt(subtotal)}</span>
                    </div>

                    {serviceFeeAmount > 0 && (
                      <div className="flex justify-between py-1 text-muted-foreground">
                        <span>(+) Serviço ({serviceFeePercentage}%)</span>
                        <span className="font-semibold text-foreground">{fmt(serviceFeeAmount)}</span>
                      </div>
                    )}

                    {discountAmount > 0 && (
                      <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>(-) Desconto</span>
                        <span>- {fmt(discountAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between py-1.5 font-bold text-sm text-foreground pt-2">
                      <span>Total a Pagar</span>
                      <span>{fmt(finalTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Splits List (Added Payments) */}
              {splits.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-foreground block">Pagamentos Lançados</span>
                  <div className="space-y-1.5">
                    {splits.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-muted/40 border border-border rounded-md text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="font-semibold text-foreground uppercase">{s.method}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground">R$ {fmt(s.amount)}</span>
                          <button
                            type="button"
                            onClick={() => removeSplit(i)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dinheiro Change Input */}
              {cashSplit && (
                <div className="p-3 bg-muted/30 border border-border rounded-md space-y-2 text-xs">
                  <Label className="text-xs font-semibold">Valor recebido em Dinheiro:</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R$</span>
                    <Input
                      placeholder="0,00"
                      value={cashGiven}
                      onChange={e => setCashGiven(e.target.value)}
                      className="pl-9 h-9 text-sm bg-background border-input text-foreground font-bold"
                    />
                  </div>
                  {cashChange > 0 && (
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Troco: R$ {fmt(cashChange)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Summary Totals Box (Matching Anexo 3) */}
            <div className="pt-4 border-t border-border flex items-center justify-between mt-4">
              <div>
                <span className="text-xs text-muted-foreground font-medium block">Total Pago</span>
                <span className="text-xl font-bold text-blue-500 dark:text-blue-400">
                  {fmt(totalAssigned)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-muted-foreground font-medium block">Falta pagar</span>
                <span className="text-2xl font-extrabold text-foreground">
                  {fmt(Math.max(0, remaining))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action Bar (Matching Anexo 3) */}
        <div className="bg-muted/60 p-3 border-t border-border flex justify-between items-center shrink-0 text-xs">
          
          {/* Left Buttons: % Taxas e Descontos & Imprimir Cupom */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTaxDiscountModal(true)}
              className="bg-card border-border text-foreground hover:bg-muted h-9 text-xs gap-1.5 font-medium"
            >
              <Percent className="h-3.5 w-3.5" /> Taxas e Descontos
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success('Imprimindo cupom de recibo...')}
              className="bg-card border-border text-foreground hover:bg-muted h-9 text-xs gap-1.5 font-medium"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir Cupom
            </Button>
          </div>

          {/* Right Buttons: < Voltar & Aguardando Pagamento */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground h-9 text-xs gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>

            <Button
              onClick={handleFinalize}
              disabled={!effectiveCashOpen || (finalTotal > 0 && remaining > 0.01)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold h-10 px-5 text-xs shadow-md tracking-wide"
            >
              {remaining <= 0.01 ? 'Finalizar Venda' : 'Aguardando Pagamento'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Tax & Discount Custom Dialog */}
      <Dialog open={showTaxDiscountModal} onOpenChange={setShowTaxDiscountModal}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Taxas e Descontos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Desconto (R$ ou %)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 5.00"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  className="bg-background border-input text-foreground h-9"
                />
              </div>
            </div>
            <Button
              className="w-full h-9 text-xs"
              onClick={() => {
                setShowTaxDiscountModal(false);
                toast.success('Desconto aplicado!');
              }}
            >
              Aplicar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
