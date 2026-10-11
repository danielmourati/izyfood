# Fila de impressão: validar falhas, limpar e corrigir a causa

## O que a verificação encontrou (Pastelão Sousa)

- 12 cupons na fila, todos com **Falhou**. Nenhum aparece como impresso: ninguém retentou com sucesso depois.
- 10 são de pedidos que **já foram pagos e finalizados** (Mesas 1, 2, 5, 6 e 8). São 6 contas e 4 comandas. Imprimir esses cupons agora não serve para nada.
- 2 são comandas de **mesas ainda abertas**:
  - Mesa 9, das 18:31
  - Mesa 1, das 18:44, que falhou agora há pouco
- O sistema não guarda prova de que o papel saiu de fato. Quando o pedido vai para a fila, os itens já ficam marcados como "enviados", mas o cupom não foi confirmado como impresso.

## Causa do erro "sendData is not a function"

O erro vem da conexão do computador do Caixa com o **QZ Tray**, e não da sincronização entre aparelhos. A correção anterior mexeu na parte errada.

O que acontece:
1. O sistema considera o QZ Tray "pronto" assim que a conexão **começa** a abrir.
2. Logo em seguida, ele já tenta mandar o cupom.
3. Nesse momento a conexão ainda não terminou de abrir. O envio falha e o cupom vai para "Falhou".

Isso acontece principalmente quando dois cupons chegam juntos ou logo depois de a conexão cair e voltar.

## O que será feito

1. **Limpeza agora:** apagar os 10 cupons que falharam e são de pedidos já finalizados.
2. **As 2 mesas abertas (9 e 1):** depois da correção, mandar esses cupons de novo para a fila automaticamente. Assim a cozinha recebe e eles somem quando forem impressos.
3. **Corrigir a conexão com o QZ Tray:** só enviar um cupom quando a conexão estiver de fato aberta. Se ela ainda estiver abrindo, o sistema espera em vez de falhar. Também passa a existir uma única tentativa de conexão por vez, mesmo com vários cupons chegando juntos.
4. **Limpeza automática daqui para frente:** cupons com "Falhou" de pedidos já finalizados ou cancelados saem da fila sozinhos, na mesma rotina que já apaga os impressos depois de 1 hora.

## Detalhes técnicos

- `src/lib/printer.ts`:
  - Criar o helper `qzReady()` = `connection?.established && readyState === OPEN`. Ele substitui `qz.websocket.isActive()` em `initQzTray` e em `isQzConnected`, porque `isActive()` também retorna true no estado CONNECTING, antes de `sendData` existir.
  - Guardar uma única promise de conexão em andamento em `initQzTray`, reaproveitada por chamadas que acontecem ao mesmo tempo.
  - Se o estado for CONNECTING, esperar até ficar pronto, com tempo limite, em vez de chamar `connect`.
  - Registrar `qz.websocket.setClosedCallbacks` para zerar `_qzConnected`.
- Limpeza pontual por dados: `DELETE FROM print_jobs WHERE status='error' AND payload->>'id' IN (pedidos com status finalizado/cancelado)`. Para as 2 mesas abertas: `UPDATE ... SET status='pending', attempts=0, error=null, claimed_by=null, claimed_at=null`.
- `purgeOldPrintJobs` em `src/lib/print-queue.ts`: também apagar jobs com `status='error'` cujo pedido esteja finalizado/cancelado ou não exista mais. Isso exige uma função de banco `purge_stale_failed_print_jobs()` (SECURITY DEFINER, filtrada pelo tenant do usuário).
- Teste unitário para `resolveSystemPrinter`/readiness não é necessário. Fazer a validação pelo log da fila depois de um pedido real.
