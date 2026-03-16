import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/contexts/StoreContext';
import { Order, PaymentMethod } from '@/types';
import { fmt } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { CreditCard, QrCode, Wallet, Banknote } from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onComplete: () => void;
}

const methods: { key: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { key: 'pix', label: 'PIX', icon: QrCode },
  { key: 'cartao', label: 'Cartão', icon: CreditCard },
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { key: 'fiado', label: 'Fiado', icon: Wallet },
];

export function CheckoutModal({ open, onClose, order, onComplete }: CheckoutModalProps) {
  const { completeSale, customers } = useStore();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [cashGiven, setCashGiven] = useState('');

  if (!order) return null;

  const handleFinalize = () => {
    if (!selectedMethod) {
      toast({ title: 'Selecione a forma de pagamento', variant: 'destructive' });
      return;
    }
    if (selectedMethod === 'fiado' && !selectedCustomer && !order.customerId) {
      toast({ title: 'Selecione o cliente para fiado', variant: 'destructive' });
      return;
    }

    const finalOrder: Order = {
      ...order,
      paymentMethod: selectedMethod,
      customerId: selectedMethod === 'fiado' ? (selectedCustomer || order.customerId) : order.customerId,
    };

    completeSale(finalOrder);
    toast({ title: 'Venda finalizada!', description: `R$ ${fmt(order.total)} via ${selectedMethod.toUpperCase()}` });
    setSelectedMethod(null);
    setSelectedCustomer(null);
    setCashGiven('');
    onComplete();
    onClose();
  };

  const change = selectedMethod === 'dinheiro' && cashGiven
    ? parseFloat(cashGiven) - order.total
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento</DialogTitle>
        </DialogHeader>

        <div className="bg-primary/10 rounded-xl p-4 text-center">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-4xl font-bold text-primary">R$ {order.total.toFixed(2)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {methods.map(m => (
            <Button
              key={m.key}
              variant={selectedMethod === m.key ? 'default' : 'outline'}
              className="h-16 flex-col gap-1"
              onClick={() => setSelectedMethod(m.key)}
            >
              <m.icon className="h-5 w-5" />
              <span className="text-sm">{m.label}</span>
            </Button>
          ))}
        </div>

        {selectedMethod === 'fiado' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selecionar cliente:</p>
            <div className="max-h-32 overflow-auto space-y-1">
              {customers.map(c => (
                <Button
                  key={c.id}
                  variant={selectedCustomer === c.id ? 'default' : 'ghost'}
                  className="w-full justify-start h-10 text-sm"
                  onClick={() => setSelectedCustomer(c.id)}
                >
                  {c.name} {c.creditBalance > 0 && <span className="ml-auto text-xs text-destructive">Débito: R$ {c.creditBalance.toFixed(2)}</span>}
                </Button>
              ))}
            </div>
          </div>
        )}

        {selectedMethod === 'dinheiro' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Valor recebido:</p>
            <input
              type="number"
              step="0.01"
              className="w-full h-12 text-center text-2xl font-bold border rounded-lg bg-background text-foreground"
              placeholder="0.00"
              value={cashGiven}
              onChange={e => setCashGiven(e.target.value)}
            />
            {change > 0 && (
              <div className="bg-accent/10 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Troco</p>
                <p className="text-2xl font-bold text-accent">R$ {change.toFixed(2)}</p>
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
