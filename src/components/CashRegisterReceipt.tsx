import { CashRegister } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useRef, useState } from 'react';
import { usePrinter } from '@/hooks/use-printer';

interface Props {
  register: CashRegister;
  operatorName: string;
  open: boolean;
  onClose: () => void;
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CashRegisterReceipt({ register, operatorName, open, onClose }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { printCashClose } = usePrinter();
  const [printing, setPrinting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    setFeedback(null);
    try {
      const result = await printCashClose({
        openedAt: register.openedAt,
        closedAt: register.closedAt,
        operatorName,
        initialAmount: register.initialAmount,
        totalCash: register.totalCash,
        totalPix: register.totalPix,
        totalCard: register.totalCard,
        totalFiado: register.totalFiado,
        totalSales: register.totalSales,
      });
      if (result.ok) {
        setFeedback({
          kind: 'ok',
          text: result.queued
            ? (result.reason || 'Cupom enviado para a impressora do caixa.')
            : result.channel === 'html'
              ? 'Nenhuma impressora configurada encontrada; o cupom foi aberto para impressão pelo navegador.'
              : 'Cupom enviado para a impressora do caixa.',
        });
      } else {
        setFeedback({ kind: 'error', text: result.reason || 'Não foi possível imprimir o cupom.' });
      }
    } catch (err: any) {
      setFeedback({ kind: 'error', text: err?.message || 'Falha inesperada ao imprimir o cupom.' });
    } finally {
      setPrinting(false);
    }
  };

  const saldoCaixa = register.initialAmount + register.totalCash;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div ref={receiptRef} className="font-mono text-xs p-6 bg-background text-foreground space-y-1">
          <div className="double" />
          <p className="center text-center font-bold text-sm">FECHAMENTO DE CAIXA</p>
          <div className="double" />

          <div className="flex justify-between"><span>Abertura:</span><span>{fmtDate(register.openedAt)}</span></div>
          {register.closedAt && <div className="flex justify-between"><span>Fechamento:</span><span>{fmtDate(register.closedAt)}</span></div>}
          <div className="flex justify-between"><span>Operador:</span><span>{operatorName}</span></div>

          <div className="line border-t border-dashed border-foreground/30 my-2" />

          <div className="flex justify-between font-bold"><span>Fundo de Troco:</span><span>{fmt(register.initialAmount)}</span></div>

          <div className="line border-t border-dashed border-foreground/30 my-2" />

          <p className="font-bold">VENDAS POR FORMA PGTO:</p>
          <div className="flex justify-between"><span>Dinheiro:</span><span>{fmt(register.totalCash)}</span></div>
          <div className="flex justify-between"><span>PIX:</span><span>{fmt(register.totalPix)}</span></div>
          <div className="flex justify-between"><span>Cartão:</span><span>{fmt(register.totalCard)}</span></div>
          <div className="flex justify-between"><span>Fiado:</span><span>{fmt(register.totalFiado)}</span></div>

          <div className="line border-t border-dashed border-foreground/30 my-2" />

          <div className="flex justify-between font-bold text-sm"><span>TOTAL VENDAS:</span><span>{fmt(register.totalSales)}</span></div>

          <div className="line border-t border-dashed border-foreground/30 my-2" />

          <div className="flex justify-between font-bold text-sm"><span>SALDO CAIXA:</span><span>{fmt(saldoCaixa)}</span></div>
          <p className="text-[10px] text-muted-foreground">(Fundo + Dinheiro)</p>

          <div className="double" />
        </div>

        {feedback && (
          <div
            className={`mx-4 mb-1 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              feedback.kind === 'ok'
                ? 'border-primary/30 bg-primary/10 text-foreground'
                : 'border-destructive/40 bg-destructive/10 text-foreground'
            }`}
          >
            {feedback.kind === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="flex gap-2 p-4 border-t border-border">
          <Button onClick={handlePrint} disabled={printing} className="flex-1 gap-2">
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {printing ? 'Imprimindo…' : 'Imprimir'}
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
