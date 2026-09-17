# Corrigir impressão (cozinha/conta) e unificar configurações da impressora

## O problema

Existem duas telas de impressora hoje:

- **Configurações > Impressora** — tem a chave "Usar impressora neste dispositivo", pareamento, teste e a chave "Usar Bluetooth como padrão".
- **Menu do pedido (mobile)** — tem pareamento, reconectar, teste e "Usar Bluetooth como padrão", mas **não** tem a chave "Usar impressora neste dispositivo".

Toda impressão real (cupom da cozinha e conta) é bloqueada quando essa chave está desligada no aparelho: o sistema simplesmente ignora o envio, sem aviso. O botão **Teste** ignora esse bloqueio de propósito — por isso o teste imprime e o cupom real não.

Além disso, as duas telas guardam essas chaves só na memória de cada tela. Ao salvar numa, a outra continua mostrando o valor antigo até recarregar a página.

## O que muda

1. **Chave "Usar impressora neste dispositivo" também no menu do pedido**, no mesmo bloco Bluetooth, no topo da seção — mesma preferência das Configurações.
2. **Aviso claro quando a impressão está desligada**: se o atendente mandar imprimir cozinha/conta com a chave desligada e a impressora pareada, aparece uma mensagem na própria tela dizendo que a impressão está desativada neste aparelho, com atalho para ligar — em vez do silêncio atual.
3. **Configurações unificadas entre as duas telas**: ligar/desligar qualquer uma das chaves (impressão neste dispositivo, Bluetooth como padrão), parear, reconectar ou esquecer a impressora passa a refletir imediatamente na outra tela, sem recarregar, e também entre abas abertas do mesmo aparelho.
4. **Mesmas verificações em todos os botões de impressão** (enviar pedido, reimprimir, conta, teste): impressora habilitada + conexão ativa; sem isso, mensagem explicativa em vez de falha silenciosa.

## Detalhes técnicos

- `src/lib/printer.ts`: `setEnablePrinterDevice` e `setBluetoothPriorityDefault` passam a disparar um evento `printer_prefs_changed` (CustomEvent) após gravar no localStorage.
- `src/hooks/use-printer.ts`: novo efeito que escuta `printer_prefs_changed` e `storage` e re-lê `getEnablePrinterDevice()` / `getBluetoothPriorityDefault()` / `getLastPairedDeviceName()`, mantendo todas as instâncias do hook sincronizadas. `printOrder`/`printBill`/`printCashClose` passam a **retornar um resultado** (`{ ok, reason }`) em vez de sair silenciosamente quando `enablePrinterDevice` é falso, para a UI poder avisar.
- `src/components/BluetoothPrinterSection.tsx`: adiciona a linha da chave "Usar impressora neste dispositivo" (via `enablePrinterDevice`/`toggleEnablePrinterDevice`) acima do status, com aviso inline quando desligada.
- `src/components/consumer/ConsumerOrderModal.tsx`: os pontos que chamam `printOrder`/`printBill` tratam o resultado e mostram mensagem inline (sem toast) quando bloqueado, orientando a ligar a chave na própria seção do menu.
- `src/pages/PDV.tsx`: reaproveita o mesmo `reason` retornado para o aviso já existente de "sem impressora".
- `src/components/ImpressoraTab.tsx`: nenhuma mudança de layout; passa a refletir alterações feitas no menu do pedido pelo novo evento.
