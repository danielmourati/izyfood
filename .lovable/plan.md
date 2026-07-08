## Diagnóstico

O `ItemNotesModal` hoje serializa **selectedObs (checkboxes)** e **otherNotes (input)** em uma única string `item.notes` unida por ` | ` (ex.: `"Arroz Branco | Sem tempero | sem cebola"`). O gerador ESC/POS (`src/lib/escpos.ts`) e o HTML de prévia (`src/hooks/use-printer.ts`) dividem essa string por `|` e imprimem cada trecho.

Na teoria, ambos os tipos deveriam sair no cupom. Na prática, o usuário reporta que apenas o texto do input aparece. Causas plausíveis:
1. Reabrir o modal, o `useEffect` de parse-back tenta casar cada parte contra `noteOptions` filtrado por categoria; se um checkbox foi criado sem `categoryIds` do produto ou removido/renomeado, ele cai em `others`, é reinserido no input, e depois o operador limpa o input e reenvia — perdendo a obs de checkbox.
2. Concatenar tudo numa string é frágil: qualquer texto do input com `|` corta a impressão; qualquer trim/normalização acidental derruba trechos.

A correção robusta é separar os dois canais em campos estruturados no `OrderItem` e imprimir explicitamente cada um.

## Escopo

### 1. `src/types/index.ts`
- Adicionar em `OrderItem`:
  ```ts
  selectedNotes?: string[]; // observações marcadas em checkbox
  otherNotes?: string;      // texto livre do input "Outras observações"
  ```
- Manter `notes?: string` para compatibilidade com pedidos antigos e display atual do carrinho.

### 2. `src/components/ItemNotesModal.tsx`
- Alterar `onConfirm` signature para:
  ```ts
  onConfirm: (
    itemId: string,
    payload: { notes: string; selectedNotes: string[]; otherNotes: string },
    newComplements: {...}[]
  ) => void
  ```
- No `handleConfirm`: gerar `notes` (string única, mantida para display) **e** enviar `selectedNotes`, `otherNotes` separadamente.
- No `useEffect` de reload: preferir `item.selectedNotes`/`item.otherNotes` quando existirem; fallback à parseia atual apenas para pedidos legados.

### 3. `src/pages/PDV.tsx`
- Atualizar `handleConfirmNotes` para receber o payload e persistir `notes`, `selectedNotes`, `otherNotes` no item do carrinho. Manter o cálculo de subtotal atual.
- Nenhum outro consumidor precisa mudar (carrinho continua exibindo `item.notes`).

### 4. `src/lib/escpos.ts` — `buildOrderReceipt`
- Substituir o bloco atual `if (item.notes) { split('|') ... }` por:
  ```ts
  const noteLines = getNoteLines(item); // helper local
  for (const n of noteLines) parts.push(rowWrap(`  * ${n}`, '', cols));
  ```
- `getNoteLines(item)`:
  1. Se `item.selectedNotes?.length` ou `item.otherNotes`, concatenar `[...selectedNotes, otherNotes].filter(Boolean)`.
  2. Senão, fallback ao legado: `String(item.notes || '').split('|').map(trim).filter(Boolean)`.

### 5. `src/hooks/use-printer.ts` — `buildOrderHtml`
- Aplicar o mesmo helper para gerar `noteLines`, cada uma em um `<p>` separado (mesmo layout atual `* …`).

### 6. Testes — `src/test/escpos.test.ts`
- Adicionar 3 casos ao `buildOrderReceipt`:
  1. Item com `selectedNotes: ['Sem cebola', 'Bem passado']` e `otherNotes: 'Extra crocante'` → o receipt (decodificado) contém as três linhas com prefixo `*`.
  2. Item legado com apenas `notes: 'Sem sal | Sem açúcar'` → duas linhas `*` impressas (retrocompatibilidade).
  3. Item com apenas `selectedNotes` (sem `otherNotes` e sem `notes` legado) → todas as obs de checkbox aparecem.
- Se o arquivo de teste não existir/estiver vazio, criar cobertura mínima com decoder `TextDecoder('utf-8')` sobre o `Uint8Array` retornado.

### 7. Verificação
- `bunx tsgo --noEmit`.
- `bunx vitest run src/test/escpos.test.ts`.
- Manual: no PDV, adicionar item → abrir modal de observações → marcar 2 checkboxes → digitar texto no input → confirmar → enviar pedido → prévia HTML e cupom impresso mostram **as 3 linhas**.

## Fora do escopo
- Sem alterar a exibição do carrinho (continua usando `item.notes` amigável).
- Sem tocar em pagamento, RLS, banco ou lógica de impressora BT.
- Sem novos toasts.
