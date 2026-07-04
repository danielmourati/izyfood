
## Objetivo

Permitir que em navegadores mobile (Chrome/Edge Android) o usuário defina a impressora Bluetooth pareada como **prioritária/padrão**, sobrepondo qualquer impressora configurada no banco (QZ Tray/Rede). Hoje o roteamento de impressão só usa Bluetooth se a impressora `default` em `printer_configs` também for do tipo `bluetooth` — o que não faz sentido em celular, onde tipicamente não há registro de impressora no banco e o pareamento vive só no dispositivo.

## Escopo

Somente frontend (`ImpressoraTab.tsx` e `use-printer.ts`) + persistência local. Sem mudanças em banco, RLS ou Edge Functions.

## Comportamento

1. **Nova flag local `bt_priority_default`** (localStorage) por dispositivo. Persistente, sem ligação com `tenant_id` porque o pareamento Bluetooth também é local.
2. **Toggle na aba Impressora → seção "Conexão Bluetooth"**:
   - Rótulo: **"Usar esta impressora como padrão neste aparelho"**
   - Descrição curta: "Envia todas as impressões para esta impressora Bluetooth, ignorando outras impressoras configuradas."
   - Só habilitado quando há dispositivo pareado (`lastPairedName` presente) e Web Bluetooth disponível.
   - Ao ligar: salva `bt_priority_default = "1"`.
   - Ao desligar / ao clicar em "Esquecer": remove a flag.
3. **Badge visual** "Padrão neste aparelho" ao lado do nome do dispositivo quando a flag está ativa.
4. **Roteamento de impressão (`sendToPrinter` em `use-printer.ts`)**:
   - Se `bt_priority_default` estiver ligada e houver dispositivo BT pareado:
     - Garante conexão via `ensureBluetoothConnected()`.
     - Se conectar, imprime via Bluetooth e retorna, **independente** do `defaultPrinter` no banco.
     - Se falhar (BT indisponível/fora de alcance), cai no fluxo atual (QZ → HTML fallback) sem alterar a flag.
   - Caso contrário mantém o comportamento atual.
5. Aplica-se aos três documentos: comanda (`printOrder`), conta (`printBill`) e fechamento (`printCashClose`) — todos passam por `sendToPrinter`, então nenhuma mudança adicional é necessária.

## Alterações técnicas

**`src/lib/printer.ts`**
- Novo helper: `getBluetoothPriorityDefault()` / `setBluetoothPriorityDefault(v: boolean)` usando `localStorage` (`bt_priority_default`). Constante `LS_BT_PRIORITY = 'bt_priority_default'`.
- `forgetBluetoothDevice()` também limpa a flag.

**`src/hooks/use-printer.ts`**
- Novo estado `btPriorityDefault` inicializado de `getBluetoothPriorityDefault()`.
- Nova função `toggleBluetoothPriorityDefault(v: boolean)` que persiste via helper e atualiza o estado.
- `sendToPrinter`: nova primeira etapa — se `btPriorityDefault && (isBluetoothConnected() || lastPairedName)`, tenta `ensureBluetoothConnected()` + `printViaBluetooth(data)`. Em erro, `console.warn` e segue o pipeline atual.
- Exporta `btPriorityDefault` e `toggleBluetoothPriorityDefault` no retorno do hook.

**`src/components/ImpressoraTab.tsx`**
- Consome `btPriorityDefault` e `toggleBluetoothPriorityDefault`.
- Dentro do `AccordionContent` da seção Bluetooth (após a linha dos botões Parear/Reconectar/Esquecer), adiciona bloco:

```text
[ Switch ] Usar esta impressora como padrão neste aparelho
           Envia todas as impressões para esta impressora Bluetooth,
           ignorando outras impressoras configuradas.
```

  - `disabled` quando não há `lastPairedName`.
  - Adiciona `<Badge variant="outline">Padrão neste aparelho</Badge>` ao lado do `btDeviceName` quando ativa.

## Fora de escopo

- Não cria registro em `printer_configs` para dispositivos BT (mantém pareamento estritamente local).
- Não altera desktop: o toggle simplesmente fica desabilitado se não houver pareamento; o aviso existente que recomenda QZ Tray no desktop permanece.
- Sem mudanças em `escpos.ts`, roteamento de auto-reconexão nem no fluxo QZ.
