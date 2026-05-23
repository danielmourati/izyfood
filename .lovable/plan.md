# Reconexão automática à última impressora Bluetooth pareada

## Objetivo
Garantir que, ao abrir o app (ou voltar a uma aba/visibilidade), o sistema tente reconectar automaticamente à última impressora Bluetooth que foi pareada neste dispositivo, sem exigir nova seleção manual pelo usuário.

## Comportamento esperado
- Ao carregar o app no dispositivo, se já existe uma impressora previamente pareada, conectar automaticamente em segundo plano.
- Se o navegador não devolver o dispositivo automaticamente (limitação do Web Bluetooth em alguns contextos), exibir um botão discreto "Reconectar impressora" na UI da Impressora e no PDV.
- Continuar tentando enquanto o app estiver aberto (com backoff) e ao voltar de background (`visibilitychange` → visible).
- Emitir os eventos `bt_connected` / `bt_status` existentes para que o hook `usePrinter` atualize o indicador.

## Mudanças

### 1. `src/lib/printer.ts`
- Persistir referência do último device pareado em `localStorage` (`bt_last_device_name`, `bt_last_device_id` quando disponível) dentro de `_connectToDevice`.
- Expandir `tryReconnectBluetooth()`:
  - Iterar `navigator.bluetooth.getDevices()` e priorizar o device cujo `name`/`id` bate com o salvo, em vez de pegar sempre o `[0]`.
  - Tentar `device.gatt.connect()` direto; se falhar, registrar `watchAdvertisements` + listener `advertisementreceived` para reconectar assim que a impressora voltar a anunciar.
  - Retornar status estruturado (`{ connected, name, needsUserGesture }`) para a UI saber se precisa de clique.
- Novo helper `startBluetoothAutoReconnect()`:
  - Chama `tryReconnectBluetooth()` no load.
  - Reagenda tentativas a cada 30s enquanto não estiver conectado e houver `lastDeviceName` salvo.
  - Listener `document.visibilitychange` → quando volta a `visible`, dispara nova tentativa imediata.
  - Listener `online` (window) → tentativa imediata.
- `connectBluetooth()` continua sendo o caminho de pareamento manual (gesto do usuário); ao conectar com sucesso, salva também os identificadores.
- `disconnectBluetooth()` mantém o `localStorage` (não remover, para permitir reconexão futura). Adicionar `forgetBluetoothDevice()` separado caso o usuário queira limpar.

### 2. `src/hooks/use-printer.ts`
- Chamar `startBluetoothAutoReconnect()` uma única vez no mount (guard por flag global do módulo).
- Continuar consumindo `bt_status` para refletir mudanças.
- Expor função `reconnectPrinter()` que chama `ensureBluetoothConnected()` (já existe) para o botão da UI usar.

### 3. `src/components/ImpressoraTab.tsx`
- Mostrar status "Última impressora: <nome salvo>" e botão "Reconectar agora" quando houver `lastDeviceName` mas `btConnected` for false.
- Adicionar botão "Esquecer impressora" que chama `forgetBluetoothDevice()`.

### 4. PDV (`src/pages/PDV.tsx`) — mínima
- Se já existe indicador de impressora, exibir botão "Reconectar" quando desconectado e houver última impressora salva (reaproveita `reconnectPrinter`).

## Notas técnicas
- Web Bluetooth exige gesto do usuário para `requestDevice()`, mas `getDevices()` + `gatt.connect()` podem rodar sem gesto desde que o device já tenha sido autorizado anteriormente nesse origin/perfil do navegador.
- `watchAdvertisements()` ainda é experimental em alguns navegadores; o código já tem `try/catch` — manter fallback silencioso.
- Não tocar em `escpos.ts`, schema do banco, nem RLS. Mudança puramente client-side.

## Validação
- Atualizar/adicionar teste leve em `src/test/` mockando `navigator.bluetooth.getDevices` para garantir que `tryReconnectBluetooth` seleciona o device com o nome salvo.
- Validar manualmente: parear → recarregar a página → impressora reconecta sozinha em poucos segundos; minimizar e voltar → reconecta.
