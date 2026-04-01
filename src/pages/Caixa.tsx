import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { CashRegister } from '@/types';
import { CashRegisterReceipt } from '@/components/CashRegisterReceipt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Lock, Unlock, History } from 'lucide-react';
import { toast } from 'sonner';

function dbToCashRegister(r: any): CashRegister {
  return {
    id: r.id, openedBy: r.opened_by, openedAt: r.opened_at,
    closedAt: r.closed_at || undefined, initialAmount: Number(r.initial_amount),
    totalCash: Number(r.total_cash), totalPix: Number(r.total_pix),
    totalCard: Number(r.total_card), totalFiado: Number(r.total_fiado),
    totalSales: Number(r.total_sales), notes: r.notes || '',
  };
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Caixa() {
  const { user } = useAuth();
  const { sales } = useStore();
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAmount, setInitialAmount] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [closedRegister, setClosedRegister] = useState<CashRegister | null>(null);
  const [history, setHistory] = useState<CashRegister[]>([]);

  useEffect(() => {
    fetchCurrent();
  }, []);

  async function fetchCurrent() {
    setLoading(true);
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setCurrentRegister(dbToCashRegister(data[0]));
    } else {
      setCurrentRegister(null);
    }

    const { data: hist } = await supabase
      .from('cash_registers')
      .select('*')
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(10);

    setHistory((hist || []).map(dbToCashRegister));
    setLoading(false);
  }

  async function handleOpen() {
    const amount = parseFloat(initialAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) {
      toast.error('Informe um valor válido para o fundo de troco');
      return;
    }

    const { data, error } = await supabase.from('cash_registers').insert({
      opened_by: user!.id,
      initial_amount: amount,
    }).select().single();

    if (error) {
      toast.error('Erro ao abrir caixa');
      return;
    }

    setCurrentRegister(dbToCashRegister(data));
    setInitialAmount('');
    toast.success('Caixa aberto com sucesso!');
  }

  async function handleClose() {
    if (!currentRegister) return;

    const openedAt = new Date(currentRegister.openedAt);
    const now = new Date();

    const salesInPeriod = sales.filter(s => {
      const d = new Date(s.date);
      return d >= openedAt && d <= now;
    });

    let totalCash = 0, totalPix = 0, totalCard = 0, totalFiado = 0;
    for (const s of salesInPeriod) {
      if (s.paymentSplits && s.paymentSplits.length > 0) {
        for (const sp of s.paymentSplits) {
          switch (sp.method) {
            case 'dinheiro': totalCash += sp.amount; break;
            case 'pix': totalPix += sp.amount; break;
            case 'cartao': totalCard += sp.amount; break;
            case 'fiado': totalFiado += sp.amount; break;
          }
        }
      } else {
        const amt = Number(s.total);
        switch (s.paymentMethod) {
          case 'dinheiro': totalCash += amt; break;
          case 'pix': totalPix += amt; break;
          case 'cartao': totalCard += amt; break;
          case 'fiado': totalFiado += amt; break;
        }
      }
    }
    const totalSales = totalCash + totalPix + totalCard + totalFiado;

    const { data, error } = await supabase.from('cash_registers').update({
      closed_at: now.toISOString(),
      total_cash: totalCash,
      total_pix: totalPix,
      total_card: totalCard,
      total_fiado: totalFiado,
      total_sales: totalSales,
    }).eq('id', currentRegister.id).select().single();

    if (error) {
      toast.error('Erro ao fechar caixa');
      return;
    }

    const closed = dbToCashRegister(data);
    setClosedRegister(closed);
    setCurrentRegister(null);
    setShowReceipt(true);
    toast.success('Caixa fechado com sucesso!');
    fetchCurrent();
  }

  // Live totals for open register
  const liveTotals = (() => {
    if (!currentRegister) return { cash: 0, pix: 0, card: 0, fiado: 0, total: 0 };
    const openedAt = new Date(currentRegister.openedAt);
    const filtered = sales.filter(s => new Date(s.date) >= openedAt);
    let cash = 0, pix = 0, card = 0, fiado = 0;
    for (const s of filtered) {
      const amt = Number(s.total);
      switch (s.paymentMethod) {
        case 'dinheiro': cash += amt; break;
        case 'pix': pix += amt; break;
        case 'cartao': card += amt; break;
        case 'fiado': fiado += amt; break;
      }
    }
    return { cash, pix, card, fiado, total: cash + pix + card + fiado };
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground">Caixa</h1>

      {!currentRegister ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Unlock className="h-5 w-5" /> Abrir Caixa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Fundo de Troco (R$)</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={initialAmount}
                onChange={e => setInitialAmount(e.target.value)}
              />
            </div>
            <Button onClick={handleOpen} className="w-full gap-2">
              <DollarSign className="h-4 w-4" /> Abrir Caixa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-primary" /> Caixa Aberto
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Aberto em {new Date(currentRegister.openedAt).toLocaleString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Fundo de Troco</p>
                <p className="text-lg font-bold text-foreground">{fmt(currentRegister.initialAmount)}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Total Vendas</p>
                <p className="text-lg font-bold text-foreground">{fmt(liveTotals.total)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Vendas por forma de pagamento:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                  <span className="text-muted-foreground">Dinheiro</span>
                  <span className="font-medium text-foreground">{fmt(liveTotals.cash)}</span>
                </div>
                <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                  <span className="text-muted-foreground">PIX</span>
                  <span className="font-medium text-foreground">{fmt(liveTotals.pix)}</span>
                </div>
                <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                  <span className="text-muted-foreground">Cartão</span>
                  <span className="font-medium text-foreground">{fmt(liveTotals.card)}</span>
                </div>
                <div className="flex justify-between bg-muted/50 rounded px-3 py-2">
                  <span className="text-muted-foreground">Fiado</span>
                  <span className="font-medium text-foreground">{fmt(liveTotals.fiado)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">Saldo em Caixa (Fundo + Dinheiro)</p>
              <p className="text-xl font-bold text-primary">{fmt(currentRegister.initialAmount + liveTotals.cash)}</p>
            </div>

            <Button onClick={handleClose} variant="destructive" className="w-full gap-2">
              <Lock className="h-4 w-4" /> Fechar Caixa
            </Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => { setClosedRegister(h); setShowReceipt(true); }}
                  className="w-full flex justify-between items-center rounded-lg bg-muted/50 hover:bg-muted px-4 py-3 text-sm transition-colors"
                >
                  <div className="text-left">
                    <p className="font-medium text-foreground">
                      {new Date(h.openedAt).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      {h.closedAt && new Date(h.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="font-bold text-foreground">{fmt(h.totalSales)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {closedRegister && (
        <CashRegisterReceipt
          register={closedRegister}
          operatorName={user?.name || 'Operador'}
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
}
