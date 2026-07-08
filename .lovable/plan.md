## Objetivo

Aplicar a mesma verificação de impressora disponível (`hasPrinterAvailable`) e o mesmo modal de prévia usado em **Enviar pedido** também em:
- **Conta** (`handlePrintBill` / botão "Conta" no rodapé do carrinho e ações de mesa retida).
- **Reimprimir** (já verificado — manter, apenas normalizar mensagem e indicativo visual).
- **Botões de ação no rodapé do carrinho**: exibir o mesmo indicador "sem impressão" em **Reimprimir** e **Conta**, além do já existente no **Enviar**.

## Escopo

### 1. `src/hooks/use-printer.ts`
- Exportar também `buildBillHtml` como named export (hoje é função interna). Sem outras mudanças.

### 2. `src/components/PrintPreviewModal.tsx`
- Adicionar prop opcional `kind?: 'order' | 'bill'` (default `'order'`).
- Quando `kind === 'bill'`, usar `buildBillHtml` no `useMemo` em vez de `buildOrderHtml`. Título e reason continuam controlados pelo caller.

### 3. `src/pages/PDV.tsx`
- Trocar `printPreview` state para incluir `kind`: `{ open, order, reason, kind: 'order' | 'bill' }`.
- Em `handlePrintBill`: antes do `try/printBill`, checar `!hasPrinterAvailable` → abrir modal com `kind: 'bill'`, `order: billData`, mesma `reason` usada nos outros fluxos. Sem chamada a `printBill` nesse caso.
- Passar `hasPrinterAvailable` ao `CartContent` (já é passado). No `CartFooter`/rodapé compacto do carrinho:
  - **Botão Reimprimir** (linhas ~1155 e ~1173): adicionar o mesmo micro-texto "sem impressão" (variante warning) quando `!hasPrinterAvailable`, seguindo o mesmo padrão visual do botão Enviar.
  - **Botão Conta** (linha ~1161): idem.
- Passar `kind` para o `<PrintPreviewModal>` render (`kind={printPreview.kind}`).

### 4. Verificação
- `bunx tsgo --noEmit`.
- Manual: sem impressora configurada, clicar em **Conta** e **Reimprimir** → modal abre com a prévia correta (Conta usa layout de conta, Reimprimir usa layout de comanda) e botões "Ok, entendi!" + "Configurar impressora".
- Com BT conectado + toggle padrão ativo (mobile): nenhum botão mostra "sem impressão" e todas as impressões seguem normalmente.

## Fora do escopo
- Sem tocar em `printCashClose` (não é acionado por botão no PDV; permanece no fluxo próprio do Caixa, onde impressora já é opcional pelo design atual).
- Sem mudanças em ESC/POS, RLS, banco, ou lógica de conexão.
- Sem novos toasts.
