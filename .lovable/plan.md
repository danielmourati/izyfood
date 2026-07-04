## Objetivo

Padronizar a impressão 58mm usando **largura segura de 30 colunas** (2 col de margem: ~1 char de cada lado) para evitar cortes laterais em impressoras térmicas POS comuns e via QZ Tray. Prévia visual no admin deve refletir exatamente o resultado impresso.

## Regras da nova largura 58mm

| Zona | Colunas |
|---|---|
| Largura total do papel | 32 col |
| Largura útil segura (todo o conteúdo) | **30 col** |
| Área máx. do texto do produto | 22 col |
| Área do preço (à direita) | 8 col |

Para 80mm nada muda (48 col totais/úteis).

Nenhuma linha do cupom pode exceder 30 caracteres úteis em 58mm: cabeçalho (nome loja, endereço, CNPJ, WhatsApp), separadores, dados do pedido (Tipo/Mesa/Cliente/Data), itens, complementos, notas, ajustes, total, pagamento e rodapé (PIX/Instagram/agradecimento).

## Alterações

### 1. `src/lib/escpos.ts` — largura segura única

- Substituir `colsForWidth()` e `detailColsForWidth()` por uma única fonte de verdade:

  ```ts
  function colsForWidth(paperWidth: number): number {
    return paperWidth <= 58 ? 30 : 48;
  }
  ```
- Remover `detailColsForWidth` (não usar mais margem extra: já embutida no 30). Ajustar chamadas remanescentes.
- Em `buildBillReceipt`, garantir que **todas** as chamadas (`row`, `rowWrap`, `lineOf`, `center`) usem esse `cols=30` para 58mm — inclui:
  - Nome da loja (`toUpperCase`) — se ultrapassar 30, aplicar quebra centrada linha-a-linha via um novo helper `centerWrap(s, cols)`.
  - Endereço, `CNPJ/CPF: ...`, `WhatsApp: ...` → também via `centerWrap` para não estourar 30.
  - Rodapé `PIX: ...`, `Instagram: ...`, `thankMessage` → idem.
  - Separadores `lineOf('-', cols)` → agora com 30 traços em 58mm.
- Enforce hard-cap: adicionar util `clampLine(s, cols)` usado em pontos onde não faz sentido quebrar (defensivo), garantindo `s.length <= cols`.

### 2. `rowWrap()` — reservar zona de preço 8 col em 58mm

Hoje `rowWrap` calcula gap sobre `cols`. Passa a receber uma partição fixa em 58mm:

- Novo helper interno `splitCols(paperWidth) => { total: 30, name: 22, price: 8 }` para 58mm e `{ total: 48, name: 36, price: 12 }` para 80mm.
- `rowWrap(label, value, cols)` continua com mesma assinatura; internamente, se `value.length <= price` e `label` couber em `name`, produz linha única `label + padding + value` com `label` limitado a `name` col (22) e `value` right-align nos `price` col (8), total = 30.
- Se `label` exceder `name`: quebra por palavras dentro de `name` col (22), última linha recebe `value` à direita completando 30 col. Se última linha ainda + gap + value estourar, joga `value` sozinho numa linha nova right-aligned em 30 col.
- Complementos (`  + ...`) e notas seguem a mesma lógica com `indent` preservado.
- Nenhuma palavra é cortada no meio; só quebra em espaço. Só faz `slice` forçado quando **uma palavra isolada** excede `name` col (fallback já existente `pushBreakWord`).

### 3. `center()` → adicionar `centerWrap()`

```ts
function centerWrap(s: string, cols: number): Uint8Array
```
- Quebra `s` em palavras respeitando `cols`, centra cada linha resultante. Usado no cabeçalho e rodapé para nunca estourar 30 col.

### 4. `src/lib/receipt-preview.ts` — espelhar exatamente

- Atualizar `colsForWidth` local para retornar 30 em 58mm.
- Portar `splitCols`, `rowWrap`, `centerWrap`, `clampLine` idênticos aos de `escpos.ts`.
- Reaplicar as mesmas mudanças no cabeçalho, dados, itens, ajustes, total, pagamento e rodapé.

### 5. `src/components/ReceiptPreview.tsx` — largura do papel na tela

- Ajustar largura do `<pre>` para acompanhar 30 col em 58mm:
  ```ts
  const cols = paperWidth === 58 ? 30 : 48;
  ```
- Legenda muda para "Prévia · 58mm (30 col úteis)".
- Sem padding extra, sem escala; `width: ${cols}ch` exato. Container mantém `overflow-x-auto` só para telas muito estreitas.

### 6. Testes — `src/test/escpos.test.ts`

Os testes atuais assumem 32 col em 58mm (ex.: `expect(row.length).toBe(32)`, `sep = '-'.repeat(32)`, regex `R\$32,50`). Atualizar para a nova largura segura:

- Trocar todas as verificações de comprimento de linha `.toBe(32)` → `.toBe(30)`.
- Trocar `'-'.repeat(32)` → `'-'.repeat(30)`.
- Regex e substrings de conteúdo (preços, nomes) permanecem.
- Adicionar novos testes:
  - Cabeçalho longo (nome de loja > 30) é centralizado em múltiplas linhas, cada uma `<=30`.
  - Nenhuma linha do cupom 58mm excede 30 col (varredura genérica: `split('\n').every(l => l.length <= 30)`).
  - Item com nome ~25 col + preço `R$100,00` (8) quebra corretamente respeitando zona nome=22/preço=8.
  - Complemento longo quebra alinhado ao "+" e nunca ultrapassa 30 col.

## Fora de escopo

- COMANDA (cozinha) e FECHAMENTO DE CAIXA — mantêm layout atual salvo pela mudança global de `colsForWidth` (que já os beneficia). Não adicionar novos testes para eles nesta iteração.
- Configuração por usuário das larguras 30/22/8 — valores fixos como padrão seguro.
- Alterações em `printer.ts`, `use-printer.ts`, banco ou RLS.

## Impacto visual

Cupom 58mm passa de 32 para 30 col úteis: separadores mais curtos, texto do produto limitado a 22 col antes de quebrar, preço sempre à direita em 8 col. Elimina cortes laterais em impressoras baratas e no QZ Tray.
