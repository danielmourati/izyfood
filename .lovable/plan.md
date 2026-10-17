# Cupons de 80 mm com 42 colunas

## O que muda
- Todos os cupons de 80 mm (comanda da cozinha, conta, fechamento de caixa e prévias) passam de 40 para **42 colunas** em fonte normal e **21** em fonte dupla.
- Cupons de 55/58 mm continuam com 32/16.
- Vale para todas as lojas com impressora de 80 mm (hoje Zezinho e Quintal de Casa).

## Detalhes técnicos
- `src/lib/escpos.ts`: `receiptColumnsForWidth` retorna 42 para papel > 58 mm; `kitchenItemColumns` herda 21 na fonte dupla; revisar `priceLineCols` para o novo limite.
- Atualizar os testes de largura (`escpos.test.ts`, `receipt-layout.test.ts`, etc.) para 42/21 e rodar a suíte.
- Atualizar a memória de larguras de cupom (55/58 mm: 32/16; 80 mm: 42/21).
- Validar a prévia: nenhuma linha passa de 42 colunas.
