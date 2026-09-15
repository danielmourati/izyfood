import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/contexts/StoreContext';
import { supabase } from '@/integrations/supabase/client';
import { Order, PaymentMethod, PaymentSplit, Customer } from '@/types';
import { fmt } from '@/lib/utils';
import { generatePixPayload } from '@/lib/qrcode';
import {
  CreditCard, QrCode, Wallet, Banknote, Plus, Trash2, Percent, DollarSign,
  Ticket, Star, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Printer,
  Info, CheckCircle2, ChevronLeft, ShoppingBag, X, Check, Copy, Search, Brush, UserPlus, Menu
} from 'lucide-react';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  selectedCustomerId?: string | null;
  onComplete: () => void;
}

type SubModalType = 'list' | 'dinheiro' | 'cartao' | 'fiado' | 'pix';
type CardBrand = 'visa' | 'master' | 'amex' | 'outra';

const paymentMethodsConfig: { key: PaymentMethod; cardSubtype?: 'credito' | 'debito' | 'refeicao'; shortcut: string; label: string; icon: React.ElementType }[] = [
  { key: 'dinheiro', shortcut: 'A', label: 'Dinheiro', icon: Banknote },
  { key: 'pix', shortcut: 'P', label: 'Pix', icon: QrCode },
  { key: 'cartao', cardSubtype: 'credito', shortcut: 'C', label: 'Crédito', icon: CreditCard },
  { key: 'cartao', cardSubtype: 'debito', shortcut: 'B', label: 'Débito', icon: CreditCard },
  { key: 'cartao', cardSubtype: 'refeicao', shortcut: 'D', label: 'V. Refeição', icon: ShoppingBag },
  { key: 'fiado', shortcut: 'F', label: 'Fiado', icon: Wallet },
];

export function CheckoutModal({ open, onClose, order, selectedCustomerId, onComplete }: CheckoutModalProps) {
  const navigate = useTenantNavigate();
  const { completeSale, customers, setCustomers, coupons, products, isCashRegisterOpen, settings, printSettings } = useStore();

  const [cashRegisterChecked, setCashRegisterChecked] = useState(false);
  const [localCashOpen, setLocalCashOpen] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([]);
  const [activeSubModal, setActiveSubModal] = useState<SubModalType>('list');
  const [cardSubtype, setCardSubtype] = useState<'credito' | 'debito' | 'refeicao'>('credito');

  // Selected customer for Fiado or Order
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [cashGiven, setCashGiven] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [showTaxDiscountModal, setShowTaxDiscountModal] = useState(false);
  const [summaryAccordionOpen, setSummaryAccordionOpen] = useState(true);

  // Sub-modal specific states
  const [subAmountStr, setSubAmountStr] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [shiftPressed, setShiftPressed] = useState(false);

  // Cartão sub-modal states
  const [selectedCardBrand, setSelectedCardBrand] = useState<CardBrand>('visa');
  const [posTerminal, setPosTerminal] = useState('Maquininha 1');
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [nsuCode, setNsuCode] = useState('');

  // Fiado search & quick new customer
  const [fiadoSearch, setFiadoSearch] = useState('');
  const [selectedFiadoCustomerId, setSelectedFiadoCustomerId] = useState<string | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCreditLimit, setNewCustCreditLimit] = useState('500.00');

  // Track SHIFT key state for quick bill summation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftPressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ESC key handler for CheckoutModal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTaxDiscountModal) { setShowTaxDiscountModal(false); return; }
        if (activeSubModal !== 'list') { setActiveSubModal('list'); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeSubModal, showTaxDiscountModal, onClose]);

  useEffect(() => {
    if (open) {
      supabase.from('cash_registers').select('id').is('closed_at', null).limit(1).then(({ data }) => {
        setLocalCashOpen(!!(data && data.length > 0));
        setCashRegisterChecked(true);
      });
      setSplits([]);
      setActiveSubModal('list');
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

  const serviceFeePercentage = settings.serviceFeePercentage ?? 0;
  const isMesa = order?.orderType === 'mesa';
  const serviceFeeAmount = isMesa && serviceFeePercentage > 0 ? (subtotal * serviceFeePercentage) / 100 : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount + serviceFeeAmount);
  const totalAssigned = splits.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, finalTotal - totalAssigned);
  const hasFiado = splits.some(s => s.method === 'fiado');

  // Handle global shortcuts for opening sub-modals (A, P, C, B, D, F) when in 'list' mode
  useEffect(() => {
    if (!open || activeSubModal !== 'list') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toUpperCase();
      if (key === 'A') openSubModal('dinheiro');
      else if (key === 'P') openSubModal('pix');
      else if (key === 'C') openSubModal('cartao', 'credito');
      else if (key === 'B') openSubModal('cartao', 'debito');
      else if (key === 'D') openSubModal('cartao', 'refeicao');
      else if (key === 'F') openSubModal('fiado');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeSubModal, remaining]);

  // ESC key returns to list view when inside a sub-modal
  useEffect(() => {
    if (!open || activeSubModal === 'list') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActiveSubModal('list');
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, activeSubModal]);

  if (!order) return null;

  // Open specific payment sub-modal
  const openSubModal = (modal: SubModalType, cardType?: 'credito' | 'debito' | 'refeicao') => {
    setActiveSubModal(modal);
    setSubAmountStr(remaining.toFixed(2).replace('.', ','));
    setSubNotes('');
    if (cardType) setCardSubtype(cardType);
    if (modal === 'fiado') {
      setSelectedFiadoCustomerId(selectedCustomer || (customers[0]?.id || null));
    }
  };

  // Quick Bill buttons handler (Click = set, Shift+Click = sum)
  const handleQuickBillClick = (billVal: number) => {
    const currentVal = parseFloat(subAmountStr.replace(',', '.')) || 0;
    if (shiftPressed) {
      const newVal = currentVal + billVal;
      setSubAmountStr(newVal.toFixed(2).replace('.', ','));
    } else {
      setSubAmountStr(billVal.toFixed(2).replace('.', ','));
    }
  };

  // Save Split from Dinheiro or Cartão Sub-modal
  const handleSaveSubSplit = (method: PaymentMethod) => {
    const amt = parseFloat(subAmountStr.replace(',', '.')) || 0;
    if (amt <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }

    let notesFormatted = subNotes.trim();
    if (method === 'cartao') {
      const details = [];
      details.push(`[${cardSubtype.toUpperCase()}]`);
      if (selectedCardBrand) details.push(`Bandeira: ${selectedCardBrand.toUpperCase()}`);
      if (posTerminal) details.push(`POS: ${posTerminal}`);
      if (authorizationCode) details.push(`Aut: ${authorizationCode}`);
      if (nsuCode) details.push(`NSU: ${nsuCode}`);
      if (subNotes) details.push(`Obs: ${subNotes}`);
      notesFormatted = details.join(' | ');
    }

    setSplits(prev => [...prev, { method, amount: Math.round(amt * 100) / 100, notes: notesFormatted || undefined }]);
    toast.success(`Pagamento de R$ ${fmt(amt)} adicionado em ${method.toUpperCase()}`);
    setActiveSubModal('list');
  };

  // Save Fiado Split
  const handleSaveFiadoSplit = () => {
    if (!selectedFiadoCustomerId) {
      toast.error('Selecione um cliente para marcar Fiado.');
      return;
    }
    const amt = remaining > 0 ? remaining : finalTotal;
    const cust = customers.find(c => c.id === selectedFiadoCustomerId);
    setSelectedCustomer(selectedFiadoCustomerId);
    setSplits(prev => [...prev, { method: 'fiado', amount: Math.round(amt * 100) / 100, notes: `Cliente: ${cust?.name || ''}` }]);
    toast.success(`Fiado no valor de R$ ${fmt(amt)} registrado para ${cust?.name || 'Cliente'}`);
    setActiveSubModal('list');
  };

  // Save PIX Split
  const handleSavePixSplit = () => {
    const amt = remaining > 0 ? remaining : finalTotal;
    setSplits(prev => [...prev, { method: 'pix', amount: Math.round(amt * 100) / 100 }]);
    toast.success(`Pagamento Pix de R$ ${fmt(amt)} adicionado!`);
    setActiveSubModal('list');
  };

  const removeSplit = (idx: number) => {
    setSplits(prev => prev.filter((_, i) => i !== idx));
  };

  // Create new customer quick modal
  const handleCreateCustomer = () => {
    if (!newCustName.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    const newId = crypto.randomUUID();
    const newCust: Customer = {
      id: newId,
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '',
      address: newCustAddress.trim() || '',
      notes: '',
      creditBalance: 0,
      loyaltyPoints: 0,
    };
    setCustomers(prev => [...prev, newCust]);
    setSelectedFiadoCustomerId(newId);
    setNewCustomerOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    toast.success(`Cliente ${newCust.name} cadastrado e selecionado!`);
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
    setActiveSubModal('list');
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

  // PIX key & QR code string
  const pixKey = printSettings?.pixKey || '';
  const pixPayload = pixKey ? generatePixPayload(pixKey, remaining > 0 ? remaining : finalTotal, printSettings.storeName || 'IZYFOOD') : '';

  const isMobile = useIsMobile();

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(fiadoSearch.toLowerCase()) ||
    (c.phone && c.phone.includes(fiadoSearch))
  );

  if (!open || !order) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[95] bg-background flex flex-col h-full overflow-hidden font-sans">
        {/* Blue Header matching Anexo 5 */}
        <div className="bg-[#0099ff] text-white px-4 py-3 flex justify-between items-center shadow-sm shrink-0">
          <span className="text-lg font-bold">Pagar Pedido - Mesa {order.tableNumber || 1}</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Yellow Summary Block (Anexo 5) */}
          <div className="bg-[#fff3d6] border border-[#ffe099] p-3 rounded text-xs font-mono font-bold text-[#553a00] space-y-1">
            <div className="flex justify-between">
              <span>+ Total Itens:</span>
              <span>R$ {fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>+ Total Serviço:</span>
              <span>R$ {fmt(serviceFeeAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>- Desconto:</span>
              <span>R$ {fmt(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#ffe099] pt-1.5 mt-1">
              <span>= Total a Pagar:</span>
              <span>R$ {fmt(finalTotal)}</span>
            </div>
          </div>

          {/* Pink Summary Block (Anexo 5) */}
          <div className="bg-[#f5d0f5] border border-[#f0b0f0] p-3 rounded text-xs font-mono font-bold text-[#600060] space-y-1">
            <div className="flex justify-between">
              <span>Total Pago:</span>
              <span>R$ {fmt(totalAssigned)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[#f0b0f0] pt-1 mt-1 text-purple-900">
              <span>Falta Pagar:</span>
              <span>R$ {fmt(remaining > 0 ? remaining : 0)}</span>
            </div>
          </div>

          {/* Orange Warning Banner (Anexo 5) */}
          {splits.length === 0 ? (
            <div className="bg-[#ff9400] text-white font-bold p-3 rounded text-xs flex items-center gap-2 shadow-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Não há pagamentos efetuados.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {splits.map((s, idx) => (
                <div key={idx} className="bg-muted p-2 rounded text-xs flex justify-between items-center">
                  <span>{s.method.toUpperCase()} - R$ {fmt(s.amount)}</span>
                  <button onClick={() => setSplits(prev => prev.filter((_, i) => i !== idx))} className="text-destructive p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Payment Method Grid 3x2 (Anexo 5) */}
          <div className="pt-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  const split: PaymentSplit = { id: crypto.randomUUID(), method: 'dinheiro', amount: remaining > 0 ? remaining : finalTotal };
                  setSplits(prev => [...prev, split]);
                  toast.success('Pagamento em Dinheiro adicionado!');
                }}
                className="bg-card border border-border hover:bg-muted p-4 rounded-md flex flex-col items-center justify-center text-center shadow-xs active:scale-95"
              >
                <Banknote className="h-6 w-6 text-foreground mb-1" />
                <span className="text-[11px] font-bold text-foreground">DINHEIRO</span>
              </button>

              <button
                onClick={() => {
                  const split: PaymentSplit = { id: crypto.randomUUID(), method: 'cartao', amount: remaining > 0 ? remaining : finalTotal };
                  setSplits(prev => [...prev, split]);
                  toast.success('Pagamento no Débito adicionado!');
                }}
                className="bg-card border border-border hover:bg-muted p-4 rounded-md flex flex-col items-center justify-center text-center shadow-xs active:scale-95"
              >
                <CreditCard className="h-6 w-6 text-foreground mb-1" />
                <span className="text-[11px] font-bold text-foreground">DÉBITO</span>
              </button>

              <button
                onClick={() => {
                  const split: PaymentSplit = { id: crypto.randomUUID(), method: 'cartao', amount: remaining > 0 ? remaining : finalTotal };
                  setSplits(prev => [...prev, split]);
                  toast.success('Pagamento no Crédito adicionado!');
                }}
                className="bg-card border border-border hover:bg-muted p-4 rounded-md flex flex-col items-center justify-center text-center shadow-xs active:scale-95"
              >
                <CreditCard className="h-6 w-6 text-foreground mb-1" />
                <span className="text-[11px] font-bold text-foreground">CRÉDITO</span>
              </button>

              <button
                onClick={() => {
                  const split: PaymentSplit = { id: crypto.randomUUID(), method: 'fiado', amount: remaining > 0 ? remaining : finalTotal };
                  setSplits(prev => [...prev, split]);
                  toast.success('Pagamento em Cheque/Fiado adicionado!');
                }}
                className="bg-card border border-border hover:bg-muted p-4 rounded-md flex flex-col items-center justify-center text-center shadow-xs active:scale-95"
              >
                <Wallet className="h-6 w-6 text-foreground mb-1" />
                <span className="text-[11px] font-bold text-foreground">CHEQUE</span>
              </button>

              <button
                onClick={() => {
                  const split: PaymentSplit = { id: crypto.randomUUID(), method: 'cartao', amount: remaining > 0 ? remaining : finalTotal };
                  setSplits(prev => [...prev, split]);
                  toast.success('Pagamento Vale Alim. adicionado!');
                }}
                className="bg-card border border-border hover:bg-muted p-4 rounded-md flex flex-col items-center justify-center text-center shadow-xs active:scale-95"
              >
                <ShoppingBag className="h-6 w-6 text-foreground mb-1" />
                <span className="text-[11px] font-bold text-foreground">VALE ALIM.</span>
              </button>

              <button
                onClick={() => {
                  const split: PaymentSplit = { id: crypto.randomUUID(), method: 'cartao', amount: remaining > 0 ? remaining : finalTotal };
                  setSplits(prev => [...prev, split]);
                  toast.success('Pagamento Vale Ref. adicionado!');
                }}
                className="bg-card border border-border hover:bg-muted p-4 rounded-md flex flex-col items-center justify-center text-center shadow-xs active:scale-95"
              >
                <ShoppingBag className="h-6 w-6 text-foreground mb-1" />
                <span className="text-[11px] font-bold text-foreground">VALE REF.</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Footer Action Bar matching Anexo 5 */}
        <div className="p-3 bg-card border-t border-border flex gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-12 text-xs font-bold flex items-center justify-center gap-2 border-border"
          >
            <ChevronLeft className="h-4 w-4" /> VOLTAR
          </Button>
          <Button
            onClick={handleFinalize}
            className="flex-1 h-12 text-xs font-bold bg-[#00b050] hover:bg-[#009544] text-white flex items-center justify-center gap-2 shadow-md"
          >
            <Plus className="h-4 w-4" /> ADICIONAR PAGAMENTO
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden bg-card text-card-foreground border-border p-0 font-sans shadow-2xl [&>button.absolute]:hidden">
        
        {/* Custom Titlebar (Matching Anexo 3/Degust Theme) */}
        <div className="bg-muted/70 px-4 py-2.5 flex justify-between items-center border-b border-border shrink-0">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Pagamento — Pedido #{shortOrderId}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Fechar (ESC)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-Header Bar (Conferir e rachar | Caixa status) */}
        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border text-xs shrink-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
            <span>Conferir e rachar a conta (Múltiplos pagamentos)</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <Info className="h-3.5 w-3.5" />
            <span>{effectiveCashOpen ? 'Caixa aberto' : 'Caixa fechado'}</span>
          </div>
        </div>

        {!effectiveCashOpen && (
          <div className="p-3 bg-destructive/10 border-b border-destructive/30 shrink-0">
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

        {/* ================= BODY CONTENT AREA ================= */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-background">
          
          {/* VIEW 1: Main Methods List & Summary */}
          {activeSubModal === 'list' && (
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] bg-background">
              
              {/* Left Column: Adicionar Pagamento Methods list */}
              <div className="md:col-span-5 bg-muted/20 border-r border-border p-3 flex flex-col gap-2 overflow-y-auto">
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
                        onClick={() => openSubModal(m.key as SubModalType, m.cardSubtype)}
                        className="w-full flex items-center gap-3 p-3 rounded-md border border-border/80 bg-card hover:bg-accent/60 text-foreground transition-all shadow-xs group text-left active:scale-[0.99]"
                      >
                        <div className="p-2 rounded bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 font-extrabold">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold flex-1">
                          <strong className="font-black text-primary mr-1 text-sm">[{m.shortcut}]</strong> {m.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium group-hover:text-foreground">
                          Abrir &gt;
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Resumo dos Totais & Splits List */}
              <div className="md:col-span-7 p-4 flex flex-col justify-between overflow-y-auto">
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
                          <span className="font-semibold">R$ {fmt(subtotal)}</span>
                        </div>

                        {serviceFeeAmount > 0 && (
                          <div className="flex justify-between py-1 text-muted-foreground">
                            <span>(+) Serviço ({serviceFeePercentage}%)</span>
                            <span className="font-semibold text-foreground">R$ {fmt(serviceFeeAmount)}</span>
                          </div>
                        )}

                        {discountAmount > 0 && (
                          <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>(-) Desconto</span>
                            <span>- R$ {fmt(discountAmount)}</span>
                          </div>
                        )}

                        <div className="flex justify-between py-1.5 font-bold text-sm text-foreground pt-2">
                          <span>Total a Pagar</span>
                          <span>R$ {fmt(finalTotal)}</span>
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
                              <div>
                                <span className="font-bold text-foreground uppercase">{s.method}</span>
                                {s.notes && <p className="text-[10px] text-muted-foreground">{s.notes}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-foreground text-sm">R$ {fmt(s.amount)}</span>
                              <button
                                type="button"
                                onClick={() => removeSplit(i)}
                                className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                                title="Remover pagamento"
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

                {/* Bottom Summary Totals Box */}
                <div className="pt-4 border-t border-border flex items-center justify-between mt-4">
                  <div>
                    <span className="text-xs text-muted-foreground font-medium block">Total Pago</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      R$ {fmt(totalAssigned)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-muted-foreground font-medium block">Falta pagar</span>
                    <span className="text-2xl font-extrabold text-foreground">
                      R$ {fmt(remaining)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Dinheiro Sub-Modal (Matching Anexo Image 1) */}
          {activeSubModal === 'dinheiro' && (
            <div className="p-6 max-w-lg mx-auto space-y-5 bg-card text-card-foreground">
              <div className="text-center space-y-1">
                <h4 className="text-lg font-extrabold text-foreground">Pagamento em Dinheiro</h4>
                <p className="text-xs text-muted-foreground">Informe o valor pago ou utilize os atalhos rápidos</p>
              </div>

              {/* Amount Display Input */}
              <div className="bg-background border border-input rounded-md p-3 text-center shadow-xs">
                <Input
                  type="text"
                  value={subAmountStr}
                  onChange={e => setSubAmountStr(e.target.value)}
                  className="text-center font-extrabold text-2xl h-12 bg-primary/10 border-primary text-primary tracking-wider"
                />
                <span className="text-[11px] text-muted-foreground block mt-1">Auto preencher:</span>
                
                {/* Auto-fill Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSubAmountStr(remaining.toFixed(2).replace('.', ','))}
                  className="w-full mt-1 bg-card hover:bg-muted font-bold text-xs h-9 border-border"
                >
                  <strong className="text-primary mr-1">[A]</strong> R$ {fmt(remaining)} (Faltando)
                </Button>
              </div>

              {/* Quick Bill Buttons Grid */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  {[2, 5, 10, 20, 50, 100].map(val => (
                    <Button
                      key={val}
                      type="button"
                      variant="outline"
                      onClick={() => handleQuickBillClick(val)}
                      className="h-11 text-base font-extrabold bg-muted/40 hover:bg-muted border-border text-foreground"
                    >
                      {val},00
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground text-center italic">
                  Clique para preencher. Segure <kbd className="font-mono bg-muted px-1 rounded text-foreground">SHIFT</kbd> para somar ao clicar.
                  {shiftPressed && <span className="text-emerald-500 font-bold ml-1">(Modo Soma Ativo)</span>}
                </p>
              </div>

              {/* Limpar & Observação */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSubAmountStr('0,00')}
                    className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <Brush className="h-4 w-4" /> Limpar
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Observação (Opcional):</Label>
                  <Input
                    placeholder="Ex: Troco para R$ 50"
                    value={subNotes}
                    onChange={e => setSubNotes(e.target.value)}
                    className="bg-background border-input text-xs h-9"
                  />
                </div>
              </div>

              {/* Sub-modal Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModal('list')}
                  className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold h-10 px-5 text-xs border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>

                <Button
                  type="button"
                  onClick={() => handleSaveSubSplit('dinheiro')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 text-xs shadow-md"
                >
                  <Check className="h-4 w-4 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          )}

          {/* VIEW 3: Cartão Sub-Modal (Matching Anexo Image 2) */}
          {activeSubModal === 'cartao' && (
            <div className="p-6 max-w-3xl mx-auto bg-card text-card-foreground">
              <div className="text-center space-y-1 mb-5">
                <h4 className="text-lg font-extrabold text-foreground uppercase">
                  Pagamento Cartão ({cardSubtype})
                </h4>
                <p className="text-xs text-muted-foreground">Preencha o valor e os dados da maquininha/bandeira</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Side: Value & Quick Bills */}
                <div className="space-y-4">
                  <div className="bg-background border border-input rounded-md p-3 text-center shadow-xs">
                    <Input
                      type="text"
                      value={subAmountStr}
                      onChange={e => setSubAmountStr(e.target.value)}
                      className="text-center font-extrabold text-2xl h-12 bg-primary/10 border-primary text-primary tracking-wider"
                    />
                    <span className="text-[11px] text-muted-foreground block mt-1">Auto preencher:</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSubAmountStr(remaining.toFixed(2).replace('.', ','))}
                      className="w-full mt-1 bg-card hover:bg-muted font-bold text-xs h-9 border-border"
                    >
                      <strong className="text-primary mr-1">[{cardSubtype[0].toUpperCase()}]</strong> R$ {fmt(remaining)} (Faltando)
                    </Button>
                  </div>

                  {/* Quick Bill Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[2, 5, 10, 20, 50, 100].map(val => (
                      <Button
                        key={val}
                        type="button"
                        variant="outline"
                        onClick={() => handleQuickBillClick(val)}
                        className="h-10 text-sm font-extrabold bg-muted/40 hover:bg-muted border-border text-foreground"
                      >
                        {val},00
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSubAmountStr('0,00')}
                      className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    >
                      <Brush className="h-4 w-4" /> Limpar
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Observação:</Label>
                    <Input
                      placeholder="Observações do cartão"
                      value={subNotes}
                      onChange={e => setSubNotes(e.target.value)}
                      className="bg-background border-input text-xs h-9"
                    />
                  </div>
                </div>

                {/* Right Side: Bandeira, POS, Aut, NSU */}
                <div className="space-y-4 bg-muted/20 p-4 border border-border rounded-md">
                  <span className="text-xs font-bold text-foreground block">Selecione a Bandeira</span>

                  {/* Card Brand Radio Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'visa', label: '[V] Visa', color: 'text-blue-500' },
                      { key: 'master', label: '[M] Master', color: 'text-red-500' },
                      { key: 'amex', label: '[X] Amex', color: 'text-sky-500' },
                      { key: 'outra', label: '[S] Outra', color: 'text-amber-500' },
                    ].map(b => (
                      <Button
                        key={b.key}
                        type="button"
                        variant={selectedCardBrand === b.key ? 'default' : 'outline'}
                        onClick={() => setSelectedCardBrand(b.key as CardBrand)}
                        className={`h-10 text-xs font-bold justify-start ${selectedCardBrand === b.key ? '' : b.color}`}
                      >
                        <CreditCard className="h-4 w-4 mr-2" /> {b.label}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">POS (Maquininha):</Label>
                      <select
                        value={posTerminal}
                        onChange={e => setPosTerminal(e.target.value)}
                        className="w-full bg-background border border-input text-foreground text-xs rounded h-9 px-3 focus:outline-none focus:border-primary"
                      >
                        <option value="Maquininha 1">Maquininha 1</option>
                        <option value="Stone">Stone</option>
                        <option value="Rede">Rede</option>
                        <option value="PagSeguro">PagSeguro</option>
                        <option value="Cielo">Cielo</option>
                        <option value="Getnet">Getnet</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Nº Aut.:</Label>
                      <Input
                        placeholder="Código de autorização"
                        value={authorizationCode}
                        onChange={e => setAuthorizationCode(e.target.value)}
                        className="bg-background border-input text-xs h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">NSU:</Label>
                      <Input
                        placeholder="Número NSU da transação"
                        value={nsuCode}
                        onChange={e => setNsuCode(e.target.value)}
                        className="bg-background border-input text-xs h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-border mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModal('list')}
                  className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold h-10 px-5 text-xs border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>

                <Button
                  type="button"
                  onClick={() => handleSaveSubSplit('cartao')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 text-xs shadow-md"
                >
                  <Check className="h-4 w-4 mr-1" /> Salvar
                </Button>
              </div>
            </div>
          )}

          {/* VIEW 4: Fiado Sub-Modal (Matching Anexo Image 3) */}
          {activeSubModal === 'fiado' && (
            <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 bg-card text-card-foreground">
              
              {/* Fiado Header Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
                <div>
                  <h4 className="text-base font-extrabold text-foreground">Marcar Fiado - Selecione um Contato</h4>
                  <p className="text-xs text-muted-foreground">Escolha o cliente para registrar a venda a prazo</p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase">
                    TOTAL (FALTANDO): R$ {fmt(remaining)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setNewCustomerOpen(true)}
                    className="bg-primary text-primary-foreground font-bold text-xs gap-1 h-9"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Novo Cliente
                  </Button>
                </div>
              </div>

              {/* Customer Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nome ou telefone..."
                  value={fiadoSearch}
                  onChange={e => setFiadoSearch(e.target.value)}
                  className="pl-9 h-10 bg-background border-input text-xs"
                />
              </div>

              {/* Customers Table */}
              <div className="border border-border rounded-md overflow-hidden bg-background max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-muted text-foreground border-b border-border font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-16 text-center">Selecionar</th>
                      <th className="py-2.5 px-3">Nome</th>
                      <th className="py-2.5 px-3">Fone Principal</th>
                      <th className="py-2.5 px-3">Celular</th>
                      <th className="py-2.5 px-3 text-right">Saldo Atual</th>
                      <th className="py-2.5 px-3 text-right">Limite de Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                          Não há registros para mostrar.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(c => {
                        const isSelected = selectedFiadoCustomerId === c.id;
                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedFiadoCustomerId(c.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-primary/15 font-bold text-foreground' : 'hover:bg-muted/40 text-foreground'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="radio"
                                name="fiadoCustomer"
                                checked={isSelected}
                                onChange={() => setSelectedFiadoCustomerId(c.id)}
                                className="accent-primary h-4 w-4"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-semibold">{c.name}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{c.phone || '-'}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{c.phone || '-'}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">
                              R$ {fmt(c.creditBalance || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                              R$ 500,00
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModal('list')}
                  className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold h-10 px-5 text-xs border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveFiadoSplit}
                  disabled={!selectedFiadoCustomerId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 text-xs shadow-md"
                >
                  <Check className="h-4 w-4 mr-1" /> Selecionar
                </Button>
              </div>
            </div>
          )}

          {/* VIEW 5: PIX Sub-Modal */}
          {activeSubModal === 'pix' && (
            <div className="p-6 max-w-md mx-auto space-y-5 bg-card text-card-foreground text-center">
              <div className="space-y-1">
                <h4 className="text-lg font-extrabold text-foreground">Pagamento por PIX</h4>
                <p className="text-xs text-muted-foreground">Escaneie o QR Code ou copie o código Pix</p>
              </div>

              {!pixKey ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-md text-left space-y-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Nenhuma Chave PIX Cadastrada</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Para gerar o QR Code dinâmico do Pix, cadastre a Chave PIX do seu restaurante no menu Configurações.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => { onClose(); navigate('/configuracoes'); }}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                  >
                    Ir para Configurações
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 bg-background border border-border p-4 rounded-md">
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground block">Valor a pagar:</span>
                    <span className="text-2xl font-extrabold text-primary">R$ {fmt(remaining)}</span>
                  </div>

                  {/* Generated QR Code Image */}
                  <div className="flex justify-center py-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm border border-border">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pixPayload)}&size=180x180`}
                        alt="QR Code Pix"
                        className="w-44 h-44 object-contain"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded truncate max-w-full">
                    Chave: <strong className="text-foreground">{pixKey}</strong>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(pixPayload);
                      toast.success('Código Pix Copia e Cola copiado para a área de transferência!');
                    }}
                    className="w-full bg-card hover:bg-muted text-xs font-bold gap-2 border-border"
                  >
                    <Copy className="h-4 w-4" /> Copiar Código Pix
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveSubModal('list')}
                  className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold h-10 px-5 text-xs border-border"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>

                <Button
                  type="button"
                  onClick={handleSavePixSplit}
                  disabled={!pixKey}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-6 text-xs shadow-md"
                >
                  <Check className="h-4 w-4 mr-1" /> Confirmar Pagamento Pix
                </Button>
              </div>
            </div>
          )}

        </div>

        {/* ================= FOOTER ACTION BAR (MAIN VIEW) ================= */}
        {activeSubModal === 'list' && (
          <div className="bg-muted/60 p-3 border-t border-border flex justify-between items-center shrink-0 text-xs">
            
            {/* Left Buttons: % Taxas e Descontos & Imprimir Cupom */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTaxDiscountModal(true)}
                className="bg-card hover:bg-muted border-border text-foreground h-9 text-xs gap-1.5 font-semibold"
              >
                <Percent className="h-3.5 w-3.5" /> Taxas e Descontos
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success('Imprimindo cupom de recibo...')}
                className="bg-card hover:bg-muted border-border text-foreground h-9 text-xs gap-1.5 font-semibold"
              >
                <Printer className="h-3.5 w-3.5" /> Imprimir Cupom
              </Button>
            </div>

            {/* Right Buttons: < Voltar & Aguardando Pagamento / Finalizar */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold h-10 px-4 text-xs gap-1 border-border"
              >
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>

              <Button
                onClick={handleFinalize}
                disabled={!effectiveCashOpen || (finalTotal > 0 && remaining > 0.01)}
                className={`font-extrabold h-10 px-6 text-xs shadow-md tracking-wide ${
                  remaining <= 0.01
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-muted text-muted-foreground opacity-70 cursor-not-allowed'
                }`}
              >
                {remaining <= 0.01 ? '✓ Finalizar Venda' : 'Aguardando Pagamento'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Tax & Discount Custom Dialog */}
      <Dialog open={showTaxDiscountModal} onOpenChange={setShowTaxDiscountModal}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Taxas e Descontos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Desconto (R$ ou %)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: 5,00"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  className="bg-background border-input text-foreground h-9"
                />
              </div>
            </div>
            <Button
              className="w-full h-9 text-xs font-bold"
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

      {/* Quick New Customer Dialog (for Fiado) */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="bg-card text-card-foreground border-border max-w-sm p-4 font-sans">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Cadastrar Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input
                placeholder="Ex: João da Silva"
                value={newCustName}
                onChange={e => setNewCustName(e.target.value)}
                className="bg-background border-input text-foreground h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={newCustPhone}
                onChange={e => setNewCustPhone(e.target.value)}
                className="bg-background border-input text-foreground h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Endereço</Label>
              <Input
                placeholder="Rua, número, bairro"
                value={newCustAddress}
                onChange={e => setNewCustAddress(e.target.value)}
                className="bg-background border-input text-foreground h-9"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-9 text-xs"
                onClick={() => setNewCustomerOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 h-9 text-xs font-bold bg-primary text-primary-foreground"
                onClick={handleCreateCustomer}
              >
                Salvar Cliente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
