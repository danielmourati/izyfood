import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { type PreviewBill } from '@/lib/receipt-preview';
import { buildBillReceipt, getCachedPrintSettings, receiptColumnsForWidth } from '@/lib/escpos';
import { receiptHtml, RECEIPT_HTML_STYLES } from '@/lib/receipt-renderer';

const MOCK_BILL: PreviewBill = {
  id: 'preview-0001',
  orderType: 'mesa',
  tableNumber: 7,
  customerName: 'João da Silva',
  openedByName: 'Maria Atendente',
  createdAt: new Date().toISOString(),
  items: [
    { name: 'Coca 350ml', quantity: 2, price: 7.5, subtotal: 15 },
    {
      name: 'Açaí 500g com granola crocante e leite condensado',
      quantity: 1, price: 32.5, subtotal: 32.5,
      selectedComplements: [
        { name: 'Cobertura de chocolate belga premium', price: 5, quantity: 1 },
        { name: 'Morango', price: 3, quantity: 2 },
      ],
    },
    { name: 'X-Burger', quantity: 1, price: 22, subtotal: 22 },
  ],
  discount: 10,
  discountType: 'percentage',
  serviceFee: 3,
  paymentSplits: [
    { method: 'pix', amount: 40 },
    { method: 'dinheiro', amount: 24.75 },
  ],
};

interface Props {
  defaultPaperWidth?: 58 | 80;
}

export function ReceiptPreview({ defaultPaperWidth = 58 }: Props) {
  const [paperWidth, setPaperWidth] = useState<58 | 80>(defaultPaperWidth);
  const ps = getCachedPrintSettings();

  const text = useMemo(
    () => receiptHtml(buildBillReceipt({ ...MOCK_BILL, total: 0 }, paperWidth, ps, 'utf8'), receiptColumnsForWidth(paperWidth)),
    [paperWidth, ps],
  );

  const cols = receiptColumnsForWidth(paperWidth);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> Prévia do cupom
          </span>
          <div className="inline-flex rounded-md border overflow-hidden">
            <Button
              type="button"
              size="sm"
              variant={paperWidth === 58 ? 'default' : 'ghost'}
              className="rounded-none h-8 px-3 text-xs"
              onClick={() => setPaperWidth(58)}
            >
              55/58mm
            </Button>
            <Button
              type="button"
              size="sm"
              variant={paperWidth === 80 ? 'default' : 'ghost'}
              className="rounded-none h-8 px-3 text-xs"
              onClick={() => setPaperWidth(80)}
            >
              80mm
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Prévia · {paperWidth}mm ({cols} col úteis) — reflete exatamente as quebras e alinhamento da impressora.
        </p>
        <div className="w-full overflow-x-auto flex justify-center py-4 bg-muted/30 rounded-md">
          <style>{RECEIPT_HTML_STYLES}</style>
          <div
            aria-label={`Prévia do cupom em ${paperWidth}mm`}
            className="bg-background text-foreground shadow-md border-x border-dashed border-muted-foreground/30 py-4 px-3 shrink-0"
            dangerouslySetInnerHTML={{ __html: text }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
