## Objetivo

Corrigir a divergência entre a **prévia do cupom** (que mostra as 3 observações — Arroz Branco, Sem farofa, Teste) e a **impressão física** (que sai apenas com 2 — sem Arroz Branco), garantindo que o cupom impresso na cozinha contenha exatamente o mesmo conjunto de observações exibido em tela.

## Diagnóstico

- `buildOrderReceipt` (ESC/POS) e `buildOrderHtml` (prévia HTML) já usam o mesmo helper `getItemNoteLines`, que prioriza `selectedNotes` + `otherNotes` sobre o legado `notes`.
- Mesmo assim, o cupom físico do anexo 2 saiu sem "Arroz Branco". Como usuário confirmou que marcou tudo antes de mandar (uma tacada só), o problema mais provável é **inconsistência entre o snapshot enviado ao driver da impressora e o snapshot que gerou a prévia**:
  - `handleSendAndHold` calcula `unprintedItems = cart.filter(i => !i.printed)` uma vez e passa para `printOrder`. Se a atualização do `cart` disparada por `handleConfirmNotes` (via setState) ainda estava em batch pendente quando o botão Enviar foi clicado, `unprintedItems` pode conter o item sem o último `selectedNotes` gravado.
  - Além disso, se por alguma razão `selectedNotes` for um array vazio `[]` mas `notes` (legado) já tiver todas as observações, `getItemNoteLines` prefere o array vazio e cai em "0 linhas", em vez de fazer fallback para `notes`.
  - A lógica de dedup / trim atual não protege contra strings duplicadas com espaço/caixa diferente entre `selectedNotes` e `otherNotes`.

## Escopo da correção

Somente frontend/apresentação (hooks de impressão, PDV, escpos util e testes). Sem alterações de schema, RLS, backend ou UI de cadastro.

### 1. `src/lib/escpos.ts` — endurecer `getItemNoteLines`

- Considerar `structured` verdadeiro apenas quando produzir **pelo menos uma linha**; se `selectedNotes` vier `[]` e `otherNotes` vazio, cair no fallback de `notes`.
- Fazer trim + dedupe (case-insensitive) do conjunto final para evitar linhas repetidas ou perdidas por espaço.

### 2. `src/hooks/use-printer.ts` — logging + snapshot único

- Em `printOrder`, logar `order.items.map(i => ({ name: i.name, selectedNotes: i.selectedNotes, otherNotes: i.otherNotes, notes: i.notes }))` para inspeção rápida em campo.
- Garantir que o mesmo `order` seja usado para `buildOrderReceipt` **e** `buildOrderHtml` (já é o caso — apenas reforçar comentário).

### 3. `src/pages/PDV.tsx` — flush síncrono das observações antes de enviar

- Em `handleSendAndHold`, antes de calcular `unprintedItems`, aplicar `flushSync` (ou releitura via ref) para garantir que a última alteração de `handleConfirmNotes` já está refletida no `cart` avaliado.
- Alternativa mais simples e sem `flushSync`: manter um `cartRef` (useRef atualizado no useEffect com `cart`) e usar `cartRef.current` como fonte de `unprintedItems` no momento do envio.
- Garantir também que, se o usuário editar observações de um item já `printed`, o item seja re-marcado como não-impresso (ou seja re-enviado como "ALTERAÇÃO"). Comportamento configurável já existente será preservado; nesta correção, apenas incluir novamente no batch enviado.

### 4. Testes — `src/test/escpos.test.ts`

- Adicionar caso: `selectedNotes: []` + `otherNotes: ''` + `notes: 'A | B | C'` → retorna `['A','B','C']` (fallback).
- Adicionar caso: `selectedNotes: ['Arroz Branco','Sem farofa']` + `otherNotes: 'Teste'` → `buildOrderReceipt` contém as 3 linhas na ordem.
- Adicionar caso: `selectedNotes: ['Arroz Branco',' arroz branco ']` → dedupe para 1 linha.

## Validação

- Rodar `bunx vitest run src/test/escpos.test.ts` — todos os testes verdes.
- Verificação manual sugerida ao usuário (após deploy): abrir PDV, adicionar item, marcar 2 checkboxes + digitar texto extra, tocar Enviar; conferir console (`[printOrder] items:`) e cupom físico — devem mostrar exatamente as 3 linhas com `*`.

## Fora de escopo

- Alterações em RLS, tabelas ou edge functions.
- Redesenho do modal de observações ou do fluxo de complementos.
- Impressão da Conta (`printBill`) — não é o alvo desta correção; permanece igual.
