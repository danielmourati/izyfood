## Objetivo

1. Corrigir o reconhecimento de impressora Bluetooth configurada como padrão: hoje o toggle "impressora padrão" via Bluetooth só passa a valer como `hasPrinterAvailable = true` se o BT estiver conectado no momento **ou** se houver `getLastPairedDeviceName()` gravado no `localStorage` deste aparelho. Isso quebra em três cenários reais:
   - Usuário configurou a impressora BT como padrão em outro aparelho e abre o PDV em um novo dispositivo (nunca pareou aqui).
   - `localStorage` foi limpo (sessão privada, "esquecer impressora", nova instalação PWA).
   - Toggle `btPriorityDefault` ligado mas GATT ainda não reconectou → botão "Enviar pedido" mostra "sem impressão" e o alerta indevidamente.
2. Substituir o alerta inline atual (screenshot enviado) por um **modal de prévia do cupom** quando a impressão for pulada por falta de impressora configurada/selecionada — permitindo ao operador visualizar o pedido, imprimir manualmente pelo navegador ou apenas confirmar e seguir.

---

## Escopo

### 1. `src/hooks/use-printer.ts` — corrigir `hasPrinterAvailable`

Reescrever o cálculo para refletir a **intenção de configuração**, não só o estado momentâneo de conexão:

```ts
const hasBluetoothDefault =
  defaultPrinter?.connection_type === 'bluetooth' &&
  (btConnected || btPriorityDefault || !!getLastPairedDeviceName() || isBluetoothAvailable());

const hasPrinterAvailable = printers.length > 0 && (
  btConnected ||
  qzConnected ||
  defaultPrinter?.connection_type === 'system' ||
  defaultPrinter?.connection_type === 'network' ||
  hasBluetoothDefault
);
```

Racional: quando existe uma `printer_configs` marcada como padrão do tipo `bluetooth` e o navegador suporta Web Bluetooth, tratamos como "há impressora configurada" — o `sendToPrinter` já tem `ensureBluetoothConnected()` + fallback HTML, então não há risco de erro silencioso. `btPriorityDefault` (toggle deste aparelho) também deve contar como configuração válida.

Adicionar `isBluetoothAvailable` no import do topo (já é usado abaixo via `btAvailable`).

### 2. Novo componente `src/components/PrintPreviewModal.tsx`

Modal reutilizável que:
- Recebe `open`, `onOpenChange`, `order` (ou HTML pronto), `paperWidth`, `title`, `reason` (texto do motivo pelo qual caiu no modal).
- Renderiza o mesmo HTML do `buildOrderHtml` (extrair export do `use-printer.ts`) dentro de um container com CSS monoespaçado (largura conforme 58/80mm), simulando o cupom.
- Ações no rodapé:
  - **Imprimir agora** → chama `printViaHtmlFallback(html, title, paperWidth)` (janela nativa do navegador).
  - **Fechar** → apenas fecha o modal.
- Cabeçalho com `DialogTitle` "Prévia do cupom" e `DialogDescription` com o `reason` (evita warnings de acessibilidade já vistos no console).
- Segue paleta atual (sem verde hardcoded, sem toast).

### 3. `src/hooks/use-printer.ts` — expor `buildOrderHtml`

Mover `buildOrderHtml` para export nomeado (ou exportar via `src/lib/printer.ts` novo helper) para reuso no modal sem duplicar lógica de itens/observações/complementos.

### 4. `src/pages/PDV.tsx` — trocar alerta inline pelo modal

- Adicionar estado `previewOrder: Order | null` e `previewReason: string`.
- Em `handleSendAndHold` quando `!hasPrinterAvailable`: em vez de apenas setar `printWarning`, salvar o pedido normalmente (fluxo atual), abrir o modal com o pedido recém-enviado e a razão "Nenhuma impressora configurada ou conectada. Você pode imprimir manualmente pelo navegador ou seguir sem impressão."
- Em `handleReprintOrder` quando `!hasPrinterAvailable`: abrir o modal com o mesmo pedido.
- Remover o bloco de alerta amarelo inline no rodapé do carrinho (linhas ~951-956) — a informação passa a viver no modal. Manter apenas o badge "sem impressão" no botão como pista visual antecipada.
- Manter comportamento de sucesso quando `hasPrinterAvailable` é true (impressão automática segue igual).

### 5. Verificação

- `bunx tsgo --noEmit` e `bun run build`.
- Teste manual:
  1. Configurar impressora BT como padrão em outro navegador/limpar localStorage → abrir PDV → `hasPrinterAvailable` deve ser `true`, botão sem badge "sem impressão", tentativa de impressão cai no fallback HTML sem alerta.
  2. Sem nenhuma impressora em `printer_configs` → enviar pedido → modal de prévia abre com o cupom + botão "Imprimir agora" + "Fechar"; pedido é salvo normalmente.
  3. Reimprimir pedido antigo sem impressora → mesmo modal abre.

## Fora do escopo

- Lógica de conexão Bluetooth em si (`connectBluetooth`, `ensureBluetoothConnected`) permanece.
- Sem mudanças em `printBill`, `printCashClose`, RLS, banco, tipos ou StoreContext.
- Sem toasts novos (memória do projeto).
