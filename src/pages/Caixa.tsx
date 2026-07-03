import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { useAttendantPermissions } from '@/hooks/use-attendant-permissions';
import { CashRegister } from '@/types';
import { CashRegisterReceipt } from '@/components/CashRegisterReceipt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DollarSign, Lock, Unlock, History, Plus, Minus, ArrowDownCircle, ArrowUpCircle, AlertTriangle, ShieldAlert, Filter, Search as SearchIcon, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';

interface CashMovement {
  id: string;
  type: 'entrada' | 'saida';
  amount: number;
  description: string;
  createdAt: string;
}

function dbToCashRegister(r: any): CashRegister {
  return {
    id: r.id, openedBy: r.opened_by, openedAt: r.opened_at,
    closedAt: r.closed_at || undefined, initialAmount: Number(r.initial_amount),
    totalCash: Number(r.total_cash), totalPix: Number(r.total_pix),
    totalCard: Number(r.total_card), totalFiado: Number(r.total_fiado),
    totalSales: Number(r.total_sales), notes: r.notes || '',
  };
}

function dbToMovement(r: any): CashMovement {
  return { id: r.id, type: r.type, amount: Number(r.amount), description: r.description, createdAt: r.created_at };
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Caixa() {
  const { user, isAdmin } = useAuth();
  const { sales, orders } = useStore();
  const { permissions } = useAttendantPermissions();
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialAmount, setInitialAmount] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [closedRegister, setClosedRegister] = useState<CashRegister | null>(null);
  const [history, setHistory] = useState<CashRegister[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [movementModal, setMovementModal] = useState<{ open: boolean; type: 'entrada' | 'saida' }>({ open: false, type: 'entrada' });
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [adminConfirmModal, setAdminConfirmModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirming, setAdminConfirming] = useState(false);
  // Admin auth for movement when attendant lacks manage_cash permission
  const [movementAuthModal, setMovementAuthModal] = useState<{ open: boolean; type: 'entrada' | 'saida' }>({ open: false, type: 'entrada' });
  const [movementAuthEmail, setMovementAuthEmail] = useState('');
  const [movementAuthPassword, setMovementAuthPassword] = useState('');
  const [movementAuthChecking, setMovementAuthChecking] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [hasPendingItems, setHasPendingItems] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingTablesCount, setPendingTablesCount] = useState(0);
  
  // History filters
  const [historyUsers, setHistoryUsers] = useState<{id: string, name: string}[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => { fetchCurrent(); }, []);

  async function fetchCurrent() {
    setLoading(true);
    const { data } = await supabase
      .from('cash_registers')
      .select('*')
      .is('closed_at', null)
      .order('opened_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const reg = dbToCashRegister(data[0]);
      setCurrentRegister(reg);
      const { data: movs } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', data[0].id)
        .order('created_at', { ascending: false });
      setMovements((movs || []).map(dbToMovement));
    } else {
      setCurrentRegister(null);
      setMovements([]);
    }

    const { data: hist } = await supabase
      .from('cash_registers')
      .select('*')
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false })
      .limit(10);

    setHistory((hist || []).map(dbToCashRegister));
    
    // Fetch users for filter
    const { data: profs } = await supabase.from('profiles').select('id, name');
    if (profs) setHistoryUsers(profs);
    
    setLoading(false);
  }

  async function handleFilterHistory() {
    setIsFiltering(true);
    let query = supabase
      .from('cash_registers')
      .select('*')
      .not('closed_at', 'is', null)
      .order('closed_at', { ascending: false });

    if (filterStartDate) {
      query = query.gte('opened_at', new Date(filterStartDate).toISOString());
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('opened_at', end.toISOString());
    }
    if (filterUser !== 'all') {
      query = query.eq('opened_by', filterUser);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao filtrar histórico');
    } else {
      setHistory((data || []).map(dbToCashRegister));
    }
    setIsFiltering(false);
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
    setMovements([]);
    toast.success('Caixa aberto com sucesso!');
    logAudit({ userId: user!.id, userName: user!.name, action: 'open', entityType: 'cash_register', entityId: data.id, details: { fundo_troco: amount } });
  }

  async function checkPendingBeforeClose() {
    // Query the database directly for accurate state
    const { data: openOrders } = await supabase
      .from('orders')
      .select('id')
      .in('status', ['aberto', 'segurado'])
      .limit(1);

    const { data: occupiedTables } = await supabase
      .from('store_tables')
      .select('id')
      .eq('status', 'occupied')
      .limit(1);

    const hasPending = (openOrders && openOrders.length > 0) || (occupiedTables && occupiedTables.length > 0);
    setHasPendingItems(hasPending);

    if (hasPending) {
      if (isAdmin) {
        setCloseConfirmOpen(true);
      } else {
        setAdminConfirmModal(true);
      }
      return;
    }
    setCloseConfirmOpen(true);
  }

  async function handleAdminConfirm() {
    if (!adminPassword) {
      toast.error('Informe a senha do administrador');
      return;
    }
    setAdminConfirming(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: user!.email,
      password: adminPassword,
    });
    setAdminConfirming(false);

    if (error) {
      toast.error('Senha incorreta');
      return;
    }
    setAdminConfirmModal(false);
    setAdminPassword('');
    logAudit({ userId: user!.id, userName: user!.name, action: 'admin_auth', entityType: 'cash_register', details: { motivo: 'Fechamento com pedidos/mesas pendentes' } });
    doClose();
  }

  async function doClose() {
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

    // Save commission records
    try {
      const { data: members } = await supabase.from('tenant_members').select('user_id, commission_percentage, role');
      const { data: profiles } = await supabase.from('profiles').select('id, name');
      if (members && profiles) {
        // Calculate per-attendant sales
        const attendantSales: Record<string, number> = {};
        for (const sale of salesInPeriod) {
          const items = (sale as any).items || [];
          for (const item of items) {
            if (item.addedBy) {
              attendantSales[item.addedBy] = (attendantSales[item.addedBy] || 0) + (item.subtotal || 0);
            }
          }
        }

        const commissionRecords = members
          .filter(m => ['atendente', 'admin'].includes(m.role))
          .map(m => {
            const p = profiles.find(pr => pr.id === m.user_id);
            const vendido = attendantSales[m.user_id] || 0;
            const pct = Number(m.commission_percentage || 0);
            return {
              cash_register_id: currentRegister.id,
              user_id: m.user_id,
              user_name: p?.name || 'Desconhecido',
              total_sales: vendido,
              commission_percentage: pct,
              commission_amount: pct > 0 ? (vendido * pct) / 100 : 0,
            };
          })
          .filter(r => r.total_sales > 0 || r.commission_amount > 0);

        if (commissionRecords.length > 0) {
          await supabase.from('commission_records').insert(commissionRecords as any);
        }
      }
    } catch (e) {
      console.error('Error saving commission records:', e);
    }

    const closed = dbToCashRegister(data);
    setClosedRegister(closed);
    setCurrentRegister(null);
    setMovements([]);
    setShowReceipt(true);
    toast.success('Caixa fechado com sucesso!');
    logAudit({ userId: user!.id, userName: user!.name, action: 'close', entityType: 'cash_register', entityId: currentRegister.id, details: { total_vendas: totalSales, dinheiro: totalCash, pix: totalPix, cartao: totalCard, fiado: totalFiado } });
    fetchCurrent();
  }

  async function handleAddMovement() {
    if (!currentRegister) return;
    const amount = parseFloat(movementAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!movementDescription.trim()) {
      toast.error('Informe a descrição/destino');
      return;
    }

    const { data, error } = await supabase.from('cash_movements').insert({
      cash_register_id: currentRegister.id,
      type: movementModal.type,
      amount,
      description: movementDescription.trim(),
    }).select().single();

    if (error) {
      toast.error('Erro ao registrar movimentação');
      return;
    }

    setMovements(prev => [dbToMovement(data), ...prev]);
    setMovementAmount('');
    setMovementDescription('');
    setMovementModal({ open: false, type: 'entrada' });
    toast.success(movementModal.type === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!');
    logAudit({ userId: user!.id, userName: user!.name, action: movementModal.type, entityType: 'cash_movement', entityId: data.id, details: { valor: amount, descricao: movementDescription.trim() } });
  }

  function handleMovementClick(type: 'entrada' | 'saida') {
    if (isAdmin || permissions.manage_cash) {
      setMovementModal({ open: true, type });
    } else {
      setMovementAuthModal({ open: true, type });
    }
  }

  async function handleMovementAuth() {
    if (!movementAuthEmail.trim() || !movementAuthPassword.trim()) {
      toast.error('Informe email e senha do administrador');
      return;
    }
    setMovementAuthChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-admin-password', {
        body: { email: movementAuthEmail, password: movementAuthPassword },
      });
      if (error || !data?.success) {
        toast.error(data?.error || 'Credenciais inválidas ou sem permissão');
        setMovementAuthChecking(false);
        return;
      }
      setMovementAuthChecking(false);
      const type = movementAuthModal.type;
      setMovementAuthModal({ open: false, type: 'entrada' });
      setMovementAuthEmail('');
      setMovementAuthPassword('');
      setMovementModal({ open: true, type });
    } catch {
      toast.error('Erro ao verificar credenciais');
      setMovementAuthChecking(false);
    }
  }

  // Live totals for open register
  const liveTotals = (() => {
    if (!currentRegister) return { cash: 0, pix: 0, card: 0, fiado: 0, total: 0 };
    const openedAt = new Date(currentRegister.openedAt);
    const filtered = sales.filter(s => new Date(s.date) >= openedAt);
    let cash = 0, pix = 0, card = 0, fiado = 0;
    for (const s of filtered) {
      if (s.paymentSplits && s.paymentSplits.length > 0) {
        for (const sp of s.paymentSplits) {
          switch (sp.method) {
            case 'dinheiro': cash += sp.amount; break;
            case 'pix': pix += sp.amount; break;
            case 'cartao': card += sp.amount; break;
            case 'fiado': fiado += sp.amount; break;
          }
        }
      } else {
        const amt = Number(s.total);
        switch (s.paymentMethod) {
          case 'dinheiro': cash += amt; break;
          case 'pix': pix += amt; break;
          case 'cartao': card += amt; break;
          case 'fiado': fiado += amt; break;
        }
      }
    }
    return { cash, pix, card, fiado, total: cash + pix + card + fiado };
  })();

  const totalEntradas = movements.filter(m => m.type === 'entrada').reduce((s, m) => s + m.amount, 0);
  const totalSaidas = movements.filter(m => m.type === 'saida').reduce((s, m) => s + m.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 pb-24 space-y-6 max-w-2xl mx-auto">
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
        <>
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

            {/* Cash movements summary */}
            {(totalEntradas > 0 || totalSaidas > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Movimentações:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between bg-success/10 rounded px-3 py-2">
                    <span className="text-success dark:text-success">Entradas</span>
                    <span className="font-medium text-success dark:text-success">{fmt(totalEntradas)}</span>
                  </div>
                  <div className="flex justify-between bg-destructive/10 rounded px-3 py-2">
                    <span className="text-destructive dark:text-destructive">Saídas</span>
                    <span className="font-medium text-destructive dark:text-destructive">{fmt(totalSaidas)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">Saldo em Caixa (Fundo + Dinheiro + Entradas - Saídas)</p>
              <p className="text-xl font-bold text-primary">{fmt(currentRegister.initialAmount + liveTotals.cash + totalEntradas - totalSaidas)}</p>
            </div>

            {/* Movement buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleMovementClick('entrada')}
              >
                <ArrowDownCircle className="h-4 w-4 text-success" /> Entrada
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => handleMovementClick('saida')}
              >
                <ArrowUpCircle className="h-4 w-4 text-destructive" /> Saída / Sangria
              </Button>
            </div>

            {/* Movement history */}
            {movements.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Histórico de movimentações:</p>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        {m.type === 'entrada' ? (
                          <Plus className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className="text-foreground">{m.description}</span>
                      </div>
                      <span className={`font-medium ${m.type === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                        {m.type === 'entrada' ? '+' : '-'}{fmt(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={checkPendingBeforeClose} variant="destructive" className="w-full gap-2">
              <Lock className="h-4 w-4" /> Fechar Caixa
            </Button>
          </CardContent>
        </Card>

        {/* Service fee & commission section */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="commissions" className="border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <DollarSign className="h-5 w-5 text-primary" /> Taxa de Serviço & Comissões
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <ServiceFeeCommissionCard orders={orders} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </>
      )}

      <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="history" className="border rounded-xl bg-card overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5 text-primary" /> Histórico de Caixa
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2">
              <div className="space-y-4">
                {/* Quick date shortcuts */}
                <div className="flex flex-wrap gap-1.5">
                  {([['today','Hoje'],['yesterday','Ontem'],['lastweek','Sem. passada'],['lastmonth','Mês passado']] as const).map(([p, l]) => {
                    function applyHistoryQuick(preset: string) {
                      const now = new Date();
                      if (preset === 'today') { const d = now.toISOString().slice(0,10); setFilterStartDate(d); setFilterEndDate(d); }
                      else if (preset === 'yesterday') { const y = new Date(now); y.setDate(y.getDate()-1); const d = y.toISOString().slice(0,10); setFilterStartDate(d); setFilterEndDate(d); }
                      else if (preset === 'lastweek') { const dow = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate()-((dow+6)%7)-7); const sun = new Date(mon); sun.setDate(mon.getDate()+6); setFilterStartDate(mon.toISOString().slice(0,10)); setFilterEndDate(sun.toISOString().slice(0,10)); }
                      else { const first = new Date(now.getFullYear(), now.getMonth()-1, 1); const last = new Date(now.getFullYear(), now.getMonth(), 0); setFilterStartDate(first.toISOString().slice(0,10)); setFilterEndDate(last.toISOString().slice(0,10)); }
                    }
                    return (
                      <button key={p} onClick={() => applyHistoryQuick(p)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-muted bg-muted/30 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors font-medium">
                        {l}
                      </button>
                    );
                  })}
                </div>

                {/* Filter inputs — responsive */}
                <div className="bg-muted/30 p-3 rounded-lg border border-muted space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Início</Label>
                      <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Fim</Label>
                      <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <Label className="text-[10px] uppercase text-muted-foreground">Usuário</Label>
                      <Select value={filterUser} onValueChange={setFilterUser}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {historyUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleFilterHistory} className="h-8 gap-1.5 px-3 shrink-0" disabled={isFiltering}>
                        {isFiltering ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SearchIcon className="h-3.5 w-3.5" />}
                        Filtrar
                      </Button>
                    </div>
                  </div>
                </div>


                <div className="space-y-2">
                  {history.map(h => (
                    <button
                      key={h.id}
                      onClick={() => { setClosedRegister(h); setShowReceipt(true); }}
                      className="w-full flex justify-between items-center rounded-lg bg-muted/50 hover:bg-muted px-4 py-3 text-sm transition-colors border border-transparent hover:border-primary/20"
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
                  {history.length === 0 && (
                    <p className="text-center py-6 text-sm text-muted-foreground">Nenhum caixa encontrado com estes filtros.</p>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

      {closedRegister && (
        <CashRegisterReceipt
          register={closedRegister}
          operatorName={user?.name || 'Operador'}
          open={showReceipt}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Movement Modal */}
      <Dialog open={movementModal.open} onOpenChange={() => setMovementModal({ open: false, type: 'entrada' })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {movementModal.type === 'entrada' ? '📥 Registrar Entrada' : '📤 Registrar Saída / Sangria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {movementModal.type === 'saida' && currentRegister && (() => {
              const cashBalance = currentRegister.initialAmount + liveTotals.cash + totalEntradas - totalSaidas;
              const parsedAmount = parseFloat(movementAmount.replace(',', '.'));
              const exceedsBalance = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount > cashBalance;
              return (
                <>
                  <div className="rounded-lg bg-primary/10 p-3">
                    <p className="text-xs text-muted-foreground">Saldo em Dinheiro no Caixa</p>
                    <p className="text-lg font-bold text-primary">{fmt(cashBalance)}</p>
                  </div>
                  {exceedsBalance && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">
                        O valor informado ({fmt(parsedAmount)}) é maior que o saldo atual em caixa ({fmt(cashBalance)}).
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={movementAmount}
                onChange={e => setMovementAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Descrição / Destino *</Label>
              <Input
                placeholder={movementModal.type === 'entrada' ? 'Ex: Fundo de troco adicional' : 'Ex: Pagamento fornecedor, Sangria'}
                value={movementDescription}
                onChange={e => setMovementDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setMovementModal({ open: false, type: 'entrada' })}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddMovement}
              disabled={movementModal.type === 'saida' && (() => {
                const parsedAmount = parseFloat(movementAmount.replace(',', '.'));
                const cashBalance = currentRegister ? currentRegister.initialAmount + liveTotals.cash + totalEntradas - totalSaidas : 0;
                return !isNaN(parsedAmount) && parsedAmount > cashBalance;
              })()}
            >
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin confirmation modal */}
      <Dialog open={adminConfirmModal} onOpenChange={setAdminConfirmModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Confirmação necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Existem pedidos não finalizados ou mesas abertas. Para fechar o caixa mesmo assim, confirme com a senha do administrador.
            </p>
            <div>
              <Label>Senha do administrador</Label>
              <Input
                type="password"
                placeholder="••••••"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setAdminConfirmModal(false); setAdminPassword(''); }}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleAdminConfirm} disabled={adminConfirming}>
              {adminConfirming ? 'Verificando...' : 'Confirmar e Fechar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement authorization modal (for attendants without manage_cash) */}
      <Dialog open={movementAuthModal.open} onOpenChange={() => { setMovementAuthModal({ open: false, type: 'entrada' }); setMovementAuthEmail(''); setMovementAuthPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning-foreground" /> Autorização necessária
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Alert className="border-warning/40/50 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              <AlertDescription className="text-sm">
                Você não tem permissão para realizar movimentações no caixa. Solicite a autorização de um administrador.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Email do administrador</Label>
              <Input
                type="email"
                placeholder="admin@email.com"
                value={movementAuthEmail}
                onChange={e => setMovementAuthEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Senha do administrador</Label>
              <Input
                type="password"
                placeholder="••••••"
                value={movementAuthPassword}
                onChange={e => setMovementAuthPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setMovementAuthModal({ open: false, type: 'entrada' }); setMovementAuthEmail(''); setMovementAuthPassword(''); }}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleMovementAuth} disabled={movementAuthChecking}>
              {movementAuthChecking ? 'Verificando...' : 'Autorizar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close confirmation */}
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Caixa?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin && hasPendingItems ? (
                <span className="text-destructive font-medium block mb-2">
                  AVISO: Existem pedidos não finalizados ou mesas abertas!
                </span>
              ) : null}
              Tem certeza que deseja fechar o caixa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setCloseConfirmOpen(false); doClose(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Fechamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ServiceFeeCommissionCard({ orders }: { orders: any[] }) {
  const [attendants, setAttendants] = useState<{ id: string; name: string; commission: number }[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAttendant, setSelectedAttendant] = useState('all');
  const [isSearching, setIsSearching] = useState(false);
  const [filterLabel, setFilterLabel] = useState('');

  function applyQuickDate(preset: 'today' | 'yesterday' | 'lastweek' | 'lastmonth', label: string) {
    const now = new Date();
    let s = '', e = '';
    if (preset === 'today') {
      s = e = now.toISOString().slice(0, 10);
    } else if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      s = e = y.toISOString().slice(0, 10);
    } else if (preset === 'lastweek') {
      const dow = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      s = mon.toISOString().slice(0, 10); e = sun.toISOString().slice(0, 10);
    } else {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      s = first.toISOString().slice(0, 10); e = last.toISOString().slice(0, 10);
    }
    setStartDate(s); setEndDate(e); setFilterLabel(label);
  }

  useEffect(() => {
    async function fetchAttendants() {
      const { data: members } = await supabase.from('tenant_members').select('user_id, commission_percentage, role');
      const { data: profiles } = await supabase.from('profiles').select('id, name');
      if (!members) return;
      const atts = members
        .filter(m => (m as any).role === 'atendente' || (m as any).role === 'admin')
        .map(m => {
          const p = profiles?.find(pr => pr.id === m.user_id);
          return { id: m.user_id, name: p?.name || `Atendente (${m.user_id.slice(0,6)})`, commission: Number((m as any).commission_percentage || 0) };
        });
      setAttendants(atts);
    }
    fetchAttendants();
  }, []);

  async function handleSearch() {
    setIsSearching(true);
    let query = supabase.from('sales').select('*');

    if (startDate) {
      query = query.gte('date', new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('date', end.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Erro ao buscar vendas');
    } else {
      setFilteredSales(data || []);
    }
    setIsSearching(false);
  }

  // Calculate service fee total from mesa orders in filtered period
  const mesaSalesInPeriod = filteredSales.filter(s => {
    const order = orders.find((o: any) => o.id === s.order_id || o.id === s.orderId);
    return order?.orderType === 'mesa';
  });

  const totalServiceFee = mesaSalesInPeriod.reduce((sum: number, s: any) => {
    const order = orders.find((o: any) => o.id === s.order_id || o.id === s.orderId);
    return sum + (order?.serviceFee || 0);
  }, 0);

  // Calculate per-attendant sales from item tracking
  const attendantSales: Record<string, number> = {};
  for (const sale of filteredSales) {
    const items = sale.items || [];
    for (const item of items) {
      if (item.addedBy) {
        attendantSales[item.addedBy] = (attendantSales[item.addedBy] || 0) + (item.subtotal || 0);
      }
    }
  }

  const displayedAttendants = selectedAttendant === 'all' ? attendants : attendants.filter(a => a.id === selectedAttendant);
  const periodLabel = filterLabel || (startDate || endDate ? `${startDate} → ${endDate}` : '');

  return (
    <div className="space-y-4">
      {/* Quick date shortcuts */}
      <div className="flex flex-wrap gap-1.5">
        {([['today','Hoje'],['yesterday','Ontem'],['lastweek','Sem. passada'],['lastmonth','Mês passado']] as const).map(([p, l]) => (
          <button key={p} onClick={() => applyQuickDate(p, l)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-muted bg-muted/30 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors font-medium">
            {l}
          </button>
        ))}
      </div>

      {/* Filters — responsive, no overflow */}
      <div className="bg-muted/30 p-3 rounded-lg border border-muted space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Início</Label>
            <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setFilterLabel(''); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Fim</Label>
            <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setFilterLabel(''); }} className="h-8 text-xs" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <Label className="text-[10px] uppercase text-muted-foreground">Atendente</Label>
            <Select value={selectedAttendant} onValueChange={setSelectedAttendant}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {attendants.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSearch} className="h-8 gap-1.5 px-3 shrink-0" disabled={isSearching}>
              {isSearching ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <SearchIcon className="h-3.5 w-3.5" />}
              Filtrar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-warning/10 p-3">
        <p className="text-xs text-muted-foreground">
          Total Taxa de Serviço (Mesa)
          {periodLabel && <span className="ml-1 text-primary font-medium">· {periodLabel}</span>}
        </p>
        <p className="text-xl font-bold text-warning-foreground dark:text-warning-foreground">{fmt(totalServiceFee)}</p>
      </div>

      {displayedAttendants.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground px-1">
            Vendas e comissões por atendente:
            {periodLabel && <span className="ml-2 text-xs text-primary font-normal">· {periodLabel}</span>}
          </p>
          <div className="border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="h-9 text-[11px] uppercase">Atendente</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase text-center">%</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase text-right">Vendido</TableHead>
                  <TableHead className="h-9 text-[11px] uppercase text-right">Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedAttendants.map(att => {
                  const vendido = attendantSales[att.id] || 0;
                  const comissao = att.commission > 0 ? (vendido * att.commission) / 100 : 0;
                  if (vendido === 0 && comissao === 0) return null;
                  return (
                    <TableRow key={att.id} className="h-10">
                      <TableCell className="py-2 text-xs font-medium">{att.name}</TableCell>
                      <TableCell className="py-2 text-xs text-center text-muted-foreground">{att.commission}%</TableCell>
                      <TableCell className="py-2 text-xs text-right font-medium">{fmt(vendido)}</TableCell>
                      <TableCell className="py-2 text-xs text-right font-bold text-primary">{fmt(comissao)}</TableCell>
                    </TableRow>
                  );
                })}
                {(filteredSales.length === 0 || !displayedAttendants.some(att => (attendantSales[att.id] || 0) > 0)) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-xs text-muted-foreground italic">
                      {filteredSales.length === 0 ? 'Aplique um filtro para ver os dados.' : 'Nenhuma venda neste período.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
