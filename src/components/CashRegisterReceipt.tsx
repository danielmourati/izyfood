import { CashRegister } from '@/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Printer, X } from 'lucide-react';
import { useRef } from 'react';

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

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=320,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Fechamento de Caixa</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 16px; width: 280px; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .double { border-top: 2px solid #000; margin: 6px 0; }
        .center { text-align: center; }
        .row { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        @media print { body { width: auto; } }
      </style></head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
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

        <div className="flex gap-2 p-4 border-t border-border">
          <Button onClick={handlePrint} className="flex-1 gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
