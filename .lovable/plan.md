# Forçar impressão dos cupons "Na fila"

## O que foi verificado
- No Zezinho, há 20 comandas da cozinha "Na fila" (12:42 até agora), todas com 0 tentativas: o Caixa nunca chegou a pegá-las.
- O computador Caixa do Zezinho está online (último sinal há segundos). Ou seja, ele está ligado, mas não está recebendo/pegando os cupons novos.
- O Caixa só pega cupons em dois momentos: quando abre e quando chega um aviso em tempo real. Se esse aviso se perde (rede, aba em segundo plano), o cupom fica parado para sempre.

## O que vai mudar (todas as lojas)
1. **Caixa confere a fila sozinho a cada 10 segundos** e imprime qualquer cupom "Na fila" que ainda não pegou, sem depender só do aviso em tempo real.
2. **Destrava cupons presos:** se um cupom ficar em "Imprimindo" por mais de 1 minuto sem terminar, ele volta para a fila e é tentado de novo.
3. **Botão "Forçar impressão"** na Fila de impressão:
   - Em cada cupom "Na fila" (ou travado em "Imprimindo"), e um botão geral "Forçar todos" no topo.
   - No aparelho Caixa: imprime na hora.
   - Em outro aparelho: reenvia o cupom ao Caixa; se não houver Caixa ativo, mostra o aviso na própria tela (sem notificação flutuante).
4. **Cupons antigos de mesas já fechadas** não são impressos à força: são retirados da fila, para a cozinha não receber pedidos velhos.
5. Os 20 cupons parados do Zezinho serão impressos assim que o Caixa recarregar com a correção (apenas os de mesas ainda abertas).

## Detalhes técnicos
- `use-print-host.ts`: intervalo de 10s chamando `fetchOpenPrintJobs()` e `enqueue`; limpar `seenRef` para ids ainda `pending`; proteger `drain` contra travamento (timeout também no `claimPrintJob`).
- `print-queue.ts`: `forcePrintJob(id)` / `forceAllPending()` que voltam `printing` vencido (>60s) ou `pending` para `pending` com `updated_at` novo (dispara UPDATE realtime no host); ajustar `claim_print_job` via migração para aceitar `printing` vencido.
- `PrintQueuePanel.tsx`: botões "Forçar impressão" e "Forçar todos"; no host chama o enqueue direto.
- Reaproveitar `purge_stale_failed_print_jobs` estendido a `pending` de pedidos finalizados/cancelados.
- Teste: regra "printing há mais de 60s volta à fila; pedido finalizado não é forçado".
