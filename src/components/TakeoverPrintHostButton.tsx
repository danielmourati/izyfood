import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { usePrinter } from '@/hooks/use-printer';

/** Admin: assume o Caixa neste aparelho quando outro está ativo (ex.: aba esquecida). */
export default function TakeoverPrintHostButton() {
  const { hostBlocked, hostBusy, canTakeoverPrintHost, takeoverPrintHost, hostLabel } = usePrinter();
  const [confirming, setConfirming] = useState(false);
  if (!hostBlocked || !canTakeoverPrintHost) return null;
  if (!confirming) {
    return (
      <Button size="sm" variant="outline" className="h-8 text-xs font-bold" disabled={hostBusy} onClick={() => setConfirming(true)}>
        Assumir Caixa neste aparelho
      </Button>
    );
  }
  return (
    <div role="alertdialog" className="rounded-lg border border-border p-2 space-y-2">
      <p className="text-xs text-foreground">
        {hostLabel || 'O outro aparelho'} vai parar de imprimir e este aparelho passa a ser o Caixa. Confirmar?
      </p>
      <div className="flex gap-2">
        <Button size="sm" className="h-8 text-xs" disabled={hostBusy} onClick={async () => { await takeoverPrintHost(); setConfirming(false); }}>
          Assumir
        </Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirming(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
