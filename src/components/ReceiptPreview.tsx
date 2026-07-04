import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt } from 'lucide-react';
import { buildBillPreviewText, type PreviewBill } from '@/lib/receipt-preview';
import { getCachedPrintSettings } from '@/lib/escpos';

const MOCK_BILL: PreviewBill = {
  id: 'preview-0001',
  orderType: 'mesa',
  tableNumber: 7,
  customerName: 'João da Silva',
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
    () => buildBillPreviewText(MOCK_BILL, paperWidth, ps),
    [paperWidth, ps],
  );

  const cols = paperWidth === 58 ? 30 : 48;

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
              58mm
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
          Prévia · {paperWidth}mm ({cols} colunas) — usa itens de exemplo para validar quebras e alinhamento.
        </p>
        <div className="w-full overflow-x-auto flex justify-center py-4 bg-muted/30 rounded-md">
          <pre
            aria-label={`Prévia do cupom em ${paperWidth}mm`}
            className="bg-[hsl(48_50%_97%)] text-black shadow-md border-x border-dashed border-muted-foreground/30 py-4 px-3 whitespace-pre"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '12px',
              lineHeight: 1.35,
              width: `${cols}ch`,
              minWidth: `${cols}ch`,
            }}
          >
            {text}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
