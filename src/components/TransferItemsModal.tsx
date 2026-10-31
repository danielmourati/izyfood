import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronsRight, ChevronRight, Minus, Plus } from 'lucide-react';
import { useStore } from '@/contexts/StoreContext';
import { fmt } from '@/lib/utils';
import { Order } from '@/types';
import { buildTransferSelection } from '@/lib/transfer-items';

interface Props {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onDone?: (result: { sourceClosed: boolean; toTable: number }) => void;
}

export const TransferItemsModal: React.FC<Props> = ({ open, order, onClose, onDone }) => {
  const { orders, tables, transferOrderItems } = useStore();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [toTable, setToTable] = useState('');
  const [askOpen, setAskOpen] = useState<null | 'all' | 'selected'>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setSelected({}); setToTable(''); setAskOpen(null); setError(null); }
  }, [open, order?.id]);

  const items = order?.items || [];
  const toNum = Number(toTable);
  const destOrder = useMemo(() => toNum > 0
    ? orders.find(o => o.orderType === 'mesa' && Number(o.tableNumber) === toNum && o.status !== 'finalizado' && o.status !== 'cancelado' && o.id !== order?.id)
    : undefined, [orders, toNum, order?.id]);
  const selCount = Object.values(selected).filter(q => q > 0).length;

  const run = async (mode: 'all' | 'selected', create: boolean) => {
    if (!order) return;
    setError(null);
    if (!(toNum > 0)) { setError('Informe a mesa de destino.'); return; }
    if (toNum === Number(order.tableNumber)) { setError('Escolha uma mesa diferente da atual.'); return; }
    if (!destOrder && !create) { setAskOpen(mode); return; }
    setBusy(true);
    try {
      const res = await transferOrderItems(order.id, toNum, mode === 'all' ? null : buildTransferSelection(selected), create);
      onDone?.({ sourceClosed: res.sourceClosed, toTable: toNum });
      onClose();
    } catch (e: any) {
      const msg = String(e?.message || 'erro');
      if (msg.includes('destination_missing')) setAskOpen(mode);
      else setError('Não foi possível transferir: ' + msg);
    } finally { setBusy(false); }
  };

  const tableList = useMemo(() => [...tables].sort((a, b) => a.number - b.number).filter(t => t.number !== Number(order?.tableNumber)), [tables, order?.tableNumber]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Transferir itens da Mesa {order?.tableNumber}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4">
          <div className="border rounded-lg p-3 flex flex-col">
            <p className="font-semibold mb-2">Mesa {order?.tableNumber} (origem)</p>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[50vh]">
              {items.map(it => {
                const q = selected[it.id] || 0;
                const max = it.weight ? 1 : it.quantity;
                return (
                  <div key={it.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={q > 0} onCheckedChange={c => setSelected(s => ({ ...s, [it.id]: c ? max : 0 }))} />
                    <span className="flex-1">{it.quantity}x {it.name}</span>
                    {q > 0 && max > 1 && (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setSelected(s => ({ ...s, [it.id]: Math.max(1, q - 1) }))}><Minus className="h-3 w-3" /></Button>
                        <span className="w-5 text-center">{q}</span>
                        <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setSelected(s => ({ ...s, [it.id]: Math.min(max, q + 1) }))}><Plus className="h-3 w-3" /></Button>
                      </div>
                    )}
                    <span className="text-muted-foreground">{fmt(it.subtotal)}</span>
                  </div>
                );
              })}
              {items.length === 0 && <p className="text-sm text-muted-foreground">Sem itens.</p>}
            </div>
            <p className="font-semibold mt-2 text-right">Total {fmt(order?.total || 0)}</p>
          </div>

          <div className="flex md:flex-col justify-center gap-2">
            <Button disabled={busy || items.length === 0} onClick={() => run('all', false)}>
              <ChevronsRight className="h-4 w-4 mr-1" /> Transferir tudo
            </Button>
            <Button variant="outline" disabled={busy || selCount === 0} onClick={() => run('selected', false)}>
              <ChevronRight className="h-4 w-4 mr-1" /> Transferir selecionados
            </Button>
          </div>

          <div className="border rounded-lg p-3 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">Destino: Mesa</span>
              <Input type="number" inputMode="numeric" className="w-24 h-8" value={toTable}
                onChange={e => { setToTable(e.target.value); setAskOpen(null); setError(null); }} list="transfer-tables" />
              <datalist id="transfer-tables">{tableList.map(t => <option key={t.number} value={t.number} />)}</datalist>
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto max-h-[50vh] text-sm">
              {!(toNum > 0) ? <p className="text-muted-foreground">Informe o número da mesa.</p>
                : destOrder ? destOrder.items.map(it => (
                  <div key={it.id} className="flex justify-between"><span>{it.quantity}x {it.name}</span><span className="text-muted-foreground">{fmt(it.subtotal)}</span></div>
                )) : <p className="text-muted-foreground">Mesa {toNum} está livre.</p>}
            </div>
            {destOrder && <p className="font-semibold mt-2 text-right">Total {fmt(destOrder.total)}</p>}
          </div>
        </div>

        {askOpen && (
          <div className="border rounded-lg p-3 bg-muted/40 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1 text-sm">A Mesa {toNum} não está aberta. Deseja abri-la?</span>
            <Button size="sm" disabled={busy} onClick={() => run(askOpen, true)}>Abrir e transferir</Button>
            <Button size="sm" variant="outline" onClick={() => setAskOpen(null)}>Cancelar</Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
};
