## Objetivo

1. Garantir que **todas as observações** (as marcadas via checkbox e o texto livre de "Outras observações") apareçam no cupom da cozinha, tanto na impressão ESC/POS quanto no fallback HTML.
2. Verificar se existe impressora configurada/conectada antes de disparar impressão automática no botão "Enviar pedido"; quando não houver, emitir alerta claro e pular a impressão para evitar erros no storefront do usuário.

---

## Escopo

### 1. `src/hooks/use-printer.ts` — Fallback HTML por linha

- Em `buildOrderHtml`, quando `i.notes` existir, dividir por `|` e renderizar **um `<p>` por observação** (mesma lógica já aplicada no ESC/POS via `buildOrderReceipt` em `src/lib/escpos.ts`).
- Assim, "Outras observações" (texto livre) e cada observação de checkbox ficam em linhas separadas também no fallback nativo Android/Windows.

### 2. `src/hooks/use-printer.ts` — Expor helper de disponibilidade

- Adicionar um helper derivado no retorno do hook, ex.: `hasPrinterAvailable: boolean`, calculado como:
  - `printers.length > 0` **e**
  - alguma via de saída disponível: `btConnected` OU `qzConnected` OU `defaultPrinter?.connection_type === 'system'` (fallback HTML nativo do navegador é sempre possível quando há uma impressora `system`/BROWSER configurada).
- Manter `printOrder` como está internamente; o gate fica no chamador (PDV) para permitir mensagem específica de UI.

### 3. `src/pages/PDV.tsx` — Alerta e bypass da impressão no envio

Em `handleSendAndHold` (e por simetria em `handleReprintOrder`):

- Antes de chamar `printOrder`, verificar `hasPrinterAvailable`.
- Se **não houver impressora**:
  - Não chamar `printOrder` (evita `printViaHtmlFallback` abrindo janela vazia / erros).
  - Exibir alerta persistente inline no rodapé do carrinho (estado `printWarning` já existe) com texto tipo: _"Nenhuma impressora configurada. O pedido foi enviado à produção sem impressão. Configure uma impressora em Configurações > Impressora."_
  - Prosseguir normalmente com o restante do fluxo (salvar pedido, marcar itens como `printed`, navegar).
- Se **houver impressora**: comportamento atual (tentar imprimir, capturar erro).

Adicionalmente, no botão "Enviar pedido" (dentro do `CartFooter` renderizado no PDV):
- Quando `!hasPrinterAvailable`, alterar o rótulo/subtítulo do botão para deixar explícito que a impressão automática está desabilitada (ex.: manter ação "Enviar", mas exibir um pequeno badge/aviso: _"Sem impressora — envio sem impressão"_). Não desabilitar o botão em si (o envio precisa continuar funcionando); apenas desativar a etapa de impressão.

## Fora do escopo

- Não alterar lógica de `printBill` / `printCashClose`.
- Não alterar `ItemNotesModal` (já persiste checkbox + texto livre corretamente).
- Não mexer em RLS, banco, tipos ou StoreContext.
- Não introduzir `toast` novo — reutilizar `printWarning` inline (memória do projeto proíbe toasts).

## Verificação

- `bunx tsgo --noEmit` e `bun run build`.
- Estender `src/test/escpos.test.ts` (se necessário) para confirmar múltiplas linhas de observações no HTML fallback — opcional, o teste ESC/POS já cobre a divisão.
- Verificação manual:
  1. Abrir modal de observações, marcar 2 checkboxes + digitar em "Outras observações" → confirmar → enviar pedido → conferir que cada linha aparece separada no cupom da cozinha (ESC/POS e fallback HTML).
  2. Remover/desconfigurar todas as impressoras → clicar "Enviar pedido" → alerta inline aparece, pedido é salvo, nenhuma janela de impressão nativa abre.
  3. Reconectar impressora Bluetooth → botão volta ao comportamento normal com impressão automática.
