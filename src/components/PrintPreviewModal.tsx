import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, AlertTriangle } from 'lucide-react';
import { buildOrderHtml } from '@/hooks/use-printer';
import { printViaHtmlFallback } from '@/lib/printer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any | null;
  paperWidth?: number;
  reason?: string;
  title?: string;
  printSettings?: any;
}

/**
 * Modal que exibe uma prévia do cupom da cozinha quando a impressão automática
 * é pulada por falta de impressora configurada/selecionada. Permite ao operador
 * imprimir manualmente pelo navegador ou apenas confirmar e seguir.
 */
export function PrintPreviewModal({
  open,
  onOpenChange,
  order,
  paperWidth = 58,
  reason,
  title = 'Comanda',
  printSettings,
}: Props) {
  const html = useMemo(() => (order ? buildOrderHtml(order, printSettings || {}) : ''), [order, printSettings]);
  const previewWidth = paperWidth === 58 ? 240 : 320;

  const handleManualPrint = () => {
    if (!html) return;
    printViaHtmlFallback(html, title, paperWidth);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Prévia do cupom
          </DialogTitle>
          {reason && (
            <DialogDescription className="text-xs leading-relaxed">
              {reason}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-3 flex justify-center bg-muted/40 rounded-md">
          <div
            className="bg-background shadow-sm p-3 text-[11px] leading-snug"
            style={{
              width: previewWidth,
              fontFamily: "'Courier New', ui-monospace, monospace",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
          <Button onClick={handleManualPrint} className="flex-1 sm:flex-none">
            <Printer className="h-4 w-4 mr-1" /> Imprimir agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
