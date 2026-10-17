# Impressão no celular via Caixa e correção da oscilação das mesas

## 1. Tela de Impressoras no celular
- Remover as chaves **"Usar impressora neste dispositivo"** e **"Este aparelho imprime para os outros (Caixa)"** no celular (tela de Configurações e menu do pedido).
- No lugar, um cartão só de leitura **"Servidor de impressão (Caixa)"** mostrando:
  - **Ativo** (verde) com o nome do aparelho/atendente do Caixa conectado, ou
  - **Nenhum caixa ativo** (âmbar), com a orientação de ligar o computador do Caixa.
- O botão **Imprimir teste** continua; no celular ele manda o teste para o Caixa.
- No computador nada muda: a chave do Caixa continua lá.

## 2. Celulares sempre imprimem pelo Caixa
- No celular, toda comanda, conta e fechamento vão para a fila do Caixa (sem Bluetooth local nem janela do navegador).
- Se nenhum Caixa estiver ativo: o pedido é salvo normalmente, o cupom fica guardado na fila e sai quando o Caixa voltar, e aparece o aviso na própria janela: **"Pedido salvo. Nenhum servidor de impressão (Caixa) ativo — o cupom sai quando o Caixa for ligado."** (sem notificações flutuantes).

## 3. Mesas que aparecem e somem
Causa provável encontrada na leitura do código (confirmar na primeira etapa):
- Quando uma busca de pedidos ou mesas falha ou volta vazia por instabilidade de rede, o app trata como "nenhum pedido aberto" e libera todas as mesas na tela; na busca seguinte elas voltam.
- A lista de mesas é montada a partir de uma variável preenchida dentro da atualização de pedidos, que pode ainda não ter rodado — mesas ficam momentaneamente sem pedido.

Correções:
- Ignorar respostas com erro (manter o que está na tela e tentar de novo), em vez de apagar as mesas.
- Calcular a lista de pedidos primeiro e só então montar as mesas a partir dela.
- Validar com duas sessões (celular + PC) que as mesas abertas permanecem estáveis por vários minutos, e que liberar uma mesa em um aparelho reflete no outro.

## Detalhes técnicos
- `use-printer.ts`: em `isMobileDevice()`, `sendToPrinter`/`printOrder`/`printBill`/`printCashClose`/`printTest` sempre usam `enqueuePrintJob`; retorno `{ ok: true, queued: true, hostOnline }`. Ignora `enablePrinterDevice` e `printHostEnabled` no mobile (host forçado off).
- `ImpressoraTab.tsx` e `BluetoothPrinterSection.tsx`: esconder as duas chaves e o bloco Bluetooth quando `isMobileDevice()`; novo cartão de status lendo a presença `print-host:<tenant_id>` (nome do host enviado no `track`).
- `ConsumerOrderModal.tsx`, `Mesas.tsx`, `Balcao.tsx`, `CheckoutModal.tsx`: mensagem inline quando `queued && !hostOnline`.
- `StoreContext.tsx` `fetchTablesAndOrders`: abortar se `error` em qualquer das consultas; calcular `nextOrders` fora do updater (usando `ordersRef`) antes de `setTables`.
