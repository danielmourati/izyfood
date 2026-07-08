## Objetivo

1. Ajustar os botões do modal de prévia do cupom em `src/components/PrintPreviewModal.tsx`:
   - "X Fechar" → **"Ok, entendi!"** (variante padrão, sem ícone X).
   - "Imprimir agora" → **"Configurar impressora"** (ícone `Settings`) que navega para a rota de configurações (aba Impressora) preservando o slug do tenant.
   - Remover a dependência de `printViaHtmlFallback` no modal (botão manual sai de cena).

2. Corrigir o falso-positivo de "sem impressão" em navegadores mobile quando a impressora Bluetooth está de fato conectada e com o toggle **Padrão neste aparelho** ativo.

   Causa raiz: em `src/hooks/use-printer.ts` (linha 236) `hasPrinterAvailable` exige `printers.length > 0` — ou seja, um registro em `printer_configs`. O toggle "Padrão neste aparelho" é local (localStorage `bt_priority_default`) e não cria linha no banco. Em um aparelho novo, o operador pareia via Bluetooth e ativa o toggle, mas como `printers.length === 0` (ou o `defaultPrinter` retornado não é do tipo `bluetooth`), o app cai no modal indevidamente.

   Correção em `use-printer.ts`:

   ```ts
   // BT ativo neste aparelho conta como impressora disponível
   // mesmo sem linha em printer_configs (toggle local + conexão real).
   const hasActiveLocalBluetooth = btPriorityDefault && btConnected;

   const hasBluetoothDefault =
     defaultPrinter?.connection_type === 'bluetooth' &&
     (btConnected || btPriorityDefault || !!getLastPairedDeviceName());

   const hasPrinterAvailable =
     hasActiveLocalBluetooth ||
     (printers.length > 0 && (
       btConnected ||
       qzConnected ||
       defaultPrinter?.connection_type === 'system' ||
       defaultPrinter?.connection_type === 'network' ||
       hasBluetoothDefault
     ));
   ```

   Racional:
   - `hasActiveLocalBluetooth` valida a intenção real do operador: toggle padrão + GATT conectado agora.
   - Remove-se `isBluetoothAvailable()` da fórmula de `hasBluetoothDefault` para não considerar "só ter Web Bluetooth no navegador" como configuração — evita falso-positivo no desktop e alinha com o que o usuário vê visualmente na aba Impressora.
   - Nada muda quando existe `printer_configs` normal (system/network/bluetooth pareado).

3. Ajuste em `src/pages/PDV.tsx` para o novo CTA do modal:
   - Importar `useTenantNavigate` (já usado no arquivo) e passar um handler `onConfigurePrinter` ao `PrintPreviewModal` que faz `navigate('/configuracoes?tab=impressora')` (rota já suportada pela `Configuracoes.tsx`, confirmar chave de aba).
   - Fechar o modal ao navegar.

## Fora do escopo

- Sem mudanças em `printer.ts`, `escpos.ts`, RLS, banco ou lógica de conexão Bluetooth.
- Sem toast novo (memória do projeto proíbe).
- Sem alteração no cupom em si.

## Verificação

- `bunx tsgo --noEmit`.
- Manual:
  1. Mobile com BT conectado (KA-1445) + toggle "Padrão neste aparelho" ligado e **sem** linha em `printer_configs`: botão "Enviar pedido" **não** mostra "sem impressão" e a impressão automática segue via BT sem abrir o modal.
  2. Sem BT e sem printer_configs: modal abre com botões "Ok, entendi!" e "Configurar impressora" (este último navega para `/<slug>/configuracoes` na aba Impressora).
  3. Configuração normal (printer_configs system/network): comportamento atual preservado.
