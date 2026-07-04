## Objetivo
Adicionar uma prévia visual do cupom [CONTA] em 58mm (32 colunas) na aba Impressora de Configurações, renderizando exatamente como o texto será quebrado e alinhado antes de enviar para a impressora térmica.

## Escopo
- Somente frontend/apresentação. Sem alterar `escpos.ts`, `printer.ts`, `use-printer.ts` ou banco.
- Prévia é apenas para o cupom **CONTA** (não comanda nem fechamento de caixa).
- Suporta 58mm e 80mm (32/48 colunas) — usuário escolhe via toggle na prévia; padrão = largura da impressora default.

## Arquivos

### Novo: `src/lib/receipt-preview.ts`
Gera uma **string monoespaçada** (linhas separadas por `\n`) representando o cupom que seria impresso, reutilizando a lógica de formatação.

- Exporta `buildBillPreviewText(bill: BillData, paperWidth: 58|80, ps: PrintSettings): string`.
- Reimplementa em texto puro as mesmas regras de `buildBillReceipt` do `escpos.ts`:
  - Mesmas funções auxiliares `row`, `rowWrap`, `center`, `lineOf`, `fmtBRL`, `fmtDate`, `colsForWidth`.
  - Cabeçalho dinâmico (storeName / address / document / whatsapp) respeitando toggles `ps.show*`.
  - Título "CONTA" centralizado.
  - Linhas de detalhe (Tipo, Mesa, Cliente, Data).
  - Itens com `rowWrap` + complementos com prefixo `  + `.
  - Bloco de ajustes (Desconto, Taxa de Serviço, Taxa de entrega).
  - TOTAL, bloco PAGAMENTO, rodapé (PIX/Instagram/Agradecimento).
- Não emite bytes ESC/POS — apenas texto. Marcações de negrito/duplo são ignoradas visualmente (opcional: envolver em `**...**` para negrito na renderização).

Motivação para arquivo separado: `escpos.ts` mantém strings intercaladas com bytes de comando. Extrair uma versão text-only evita acoplar o encoder ao preview e permite reuso em testes.

### Novo: `src/components/ReceiptPreview.tsx`
Componente de apresentação da prévia.

- Props: `paperWidth: 58 | 80`, `printSettings: PrintSettings`, `bill: BillData` (mock).
- Renderiza um `<pre>` monoespaçado dentro de um "papel" com:
  - Largura fixa em `ch` proporcional às colunas (32ch ou 48ch), com padding lateral simulando margem física.
  - `font-family: ui-monospace, Menlo, Consolas, monospace`, `font-size: 12px`, `line-height: 1.25`.
  - Fundo branco levemente amarelado (`bg-[hsl(48_50%_97%)]`), borda tracejada nas bordas laterais para sugerir bobina, sombra sutil.
  - Overflow-x se necessário; centralizado no container.
- Um cabeçalho pequeno: "Prévia · 58mm (32 col)" — muda conforme largura.

### Editar: `src/components/ImpressoraTab.tsx`
- Importar `ReceiptPreview` e `buildBillPreviewText`.
- Adicionar nova seção **"Prévia do cupom"** dentro da aba Impressora, abaixo do form de impressora e acima da lista, dentro de um `Card` com título e descrição curta.
- Controles no topo do card:
  - Toggle largura: botões `58mm` / `80mm` (grupo). Padrão = `paper_width` da impressora default (ou 58 se não houver).
  - Toggle "Usar itens de exemplo" (default on). Quando off, mostra dica: "Realize uma venda para testar cupom real" — v1 não pluga carrinho real, apenas mock.
- Body: `<ReceiptPreview />` com um `bill` mock realista para stress-test das quebras:
  - 1 item curto: `2x Coca 350ml` — R$ 15,00
  - 1 item longo: `1x Açaí 500g com granola crocante e leite condensado` — R$ 32,50
  - Item longo com 2 complementos: `+ 1x Cobertura de chocolate belga premium` e `+ 2x Morango`.
  - Desconto 10%, Taxa de Serviço R$ 3,00, sem taxa de entrega.
  - Pagamento split: PIX + Dinheiro.
- Sem toasts. Feedback puramente visual.
- `printSettings` já disponível via `getCachedPrintSettings()` (mesmo padrão usado pelo hook).

## Layout esperado

```text
+------------------------- Card: Prévia do cupom -------------------------+
| [ 58mm ] [ 80mm ]                          Usar itens de exemplo [on]  |
|                                                                        |
|              +------- papel 32ch -------+                              |
|              |        LOJA EXEMPLO      |                              |
|              | ------------------------ |                              |
|              |          CONTA           |                              |
|              | ------------------------ |                              |
|              | Tipo:               Mesa |                              |
|              | 1x Açaí 500g com granola |                              |
|              | crocante         R$32,50 |                              |
|              |   + 1x Cobertura de      |                              |
|              |     chocolate    R$ 5,00 |                              |
|              | ...                      |                              |
|              +--------------------------+                              |
+------------------------------------------------------------------------+
```

## Considerações técnicas
- Nenhuma dependência nova.
- `BillData` e `PrintSettings` continuam definidos em `escpos.ts`; exportar tipos se ainda não estiverem (verificar antes; se privados, tornar `export`).
- Zero mudança em business logic: mock 100% local no componente, sem hit em Supabase.
- Acessibilidade: `<pre aria-label="Prévia do cupom em 58mm">`.
- Mobile: card com `overflow-x-auto` para largura 80mm em telas estreitas.

## Fora de escopo
- Prévia de COMANDA e FECHAMENTO DE CAIXA.
- Prévia baseada em cupom real de uma venda concreta.
- Impressão direta a partir do preview (o botão "Imprimir teste" já existente cobre isso).
