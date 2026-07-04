## Objetivo

No cupom **CONTA** impresso em 58mm (32 colunas), garantir que:

1. Cada item ocupe seu próprio bloco de linhas (nunca compartilhe linha com outro item).
2. Se o texto do item (quantidade + nome) não couber junto com o preço na largura útil, o nome quebre em múltiplas linhas.
3. O preço permaneça alinhado à direita na última linha do item, mantendo o mesmo alinhamento vertical dos demais preços.
4. Complementos (`+ Nx Nome`) sigam a mesma regra, com indentação preservada nas linhas quebradas.

Escopo restrito a apresentação/impressão. Sem mudanças de dados, RLS ou fluxo.

## Alterações

### `src/lib/escpos.ts`

**1. Endurecer `rowWrap()`** (função já existente, usada em `buildBillReceipt` para itens):

Situação atual: já quebra o rótulo em várias linhas e coloca o valor à direita na última linha. Problemas observados em 58mm:

- Quando a última palavra do rótulo cabe justo, o preço pode ser empurrado sem espaço mínimo (colando no texto).
- Complementos com prefixo `  + ` perdem a indentação nas linhas seguintes em alguns casos porque o `indent` é detectado apenas por espaços iniciais e o `+` conta como palavra.

Ajustes:

- Reservar sempre no mínimo **1 espaço** entre rótulo e valor; se não sobrar, empurrar o valor para uma nova linha alinhada à direita (sem rótulo).
- Detectar indentação de complemento (`  + `) como prefixo literal e reaplicá-lo em cada linha quebrada, para manter o alinhamento visual do "+".
- Se um único "token" (palavra) exceder as colunas disponíveis, quebrar por caractere (comportamento já existente, apenas confirmar que respeita a indentação de complementos).

**2. `buildBillReceipt()` — bloco de itens:**

Substituir o loop atual por uma chamada única a `rowWrap()` por item e por complemento (já é o caso), garantindo:

- Uma linha em branco NÃO é adicionada entre itens (mantém compacto, comportamento atual).
- Cada item começa em nova linha — garantir via `\n` explícito ao final do último fragmento de `rowWrap` (já é o caso, apenas validar).
- A largura passada é `cols = colsForWidth(paperWidth)` (32 para 58mm). Nenhuma margem extra: usar toda a área útil.

### `src/test/escpos.test.ts`

Adicionar 3 casos para 58mm (`paperWidth = 58`, `cols = 32`):

1. Item com nome curto e preço → uma única linha, valor à direita.
2. Item com nome longo que ultrapassa 32 col → nome quebra em N linhas, preço na última linha alinhado à direita, com ao menos 1 espaço antes.
3. Complemento com nome longo (`  + 1x Nome muito muito grande`) → linhas quebradas preservam a indentação `    ` (alinhada ao "+").

## Fora de escopo

- Cupom COMANDA (cozinha) e FECHAMENTO DE CAIXA — comportamento inalterado.
- 80mm — inalterado (mesma função `rowWrap`, mais espaço, sem regressão esperada; coberto por testes existentes).
- Ajustes de fonte/condensado.

## Detalhes técnicos

- `rowWrap(label, value, cols)` continua sendo a única função responsável pela quebra + alinhamento; toda a lógica nova fica encapsulada nela.
- Sem novas dependências. Sem mudanças em `src/lib/printer.ts` ou `src/hooks/use-printer.ts`.
- Validação: `bunx vitest run src/test/escpos.test.ts`.
