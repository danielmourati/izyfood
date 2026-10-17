# Todos os aparelhos reconhecem o Caixa (servidor de impressão) quando ativo

## O problema
Os celulares mostram "Inativo" mesmo com o Caixa ligado. Cada parte do app que usa a impressora (tela de Impressoras, menu do pedido, o próprio Caixa) abre seu próprio aviso "estou online" com o mesmo nome — e cada nova abertura **derruba a anterior**. Assim o Caixa some da lista para os outros aparelhos sempre que uma tela é aberta ou fechada nele. Também não há reconexão quando a internet oscila ou o celular volta do bloqueio de tela.

## O que muda
1. **Um único sinal "Caixa online" por aparelho**, compartilhado por todas as telas — abrir ou fechar telas não derruba mais o Caixa.
2. **Reconexão automática**: ao perder a conexão, voltar a internet ou desbloquear o celular, o aparelho reconecta e anuncia/verifica o Caixa de novo.
3. **Confirmação pelo banco (garantia extra)**: o Caixa grava um "sinal de vida" a cada 15 segundos. Os celulares consideram o Caixa ativo se o sinal tiver menos de 45 segundos, mesmo que o aviso em tempo real falhe.
4. O card "Servidor de impressão (Caixa)" passa a mostrar nome do Caixa e "visto há X s"; os cupons enviados sempre vão para a fila (como hoje), e o aviso "nenhum servidor ativo" só aparece quando os dois sinais confirmam que ele está desligado.

Vale para todas as lojas.

## Detalhes técnicos
- Nova tabela `print_hosts` (`tenant_id`, `device_id`, `label`, `user_name`, `last_seen_at`), única por (tenant_id, device_id), RLS por `get_user_tenant_id()`, GRANTs para authenticated; realtime habilitado.
- Novo módulo singleton `src/lib/print-host-presence.ts`: um canal de presença por tenant com contagem de referências (inscrição/cancelamento sem `removeChannel` de outras instâncias), `track` host/watcher conforme `printHostEnabled`, reinscrição em `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`, `online`/`visibilitychange`; expõe estado via subscribe.
- Host (`use-print-host.ts`): upsert de heartbeat a cada 15s e ao voltar a ficar visível; apaga a linha ao desligar a chave.
- `use-printer.ts`: remove o canal por instância; `hostOnline = presença || heartbeat < 45s` (consulta a cada 15s + realtime em `print_hosts`); `hostLabel` e `lastSeenAt` expostos.
- `ImpressoraTab.tsx`/`BluetoothPrinterSection.tsx`: exibir "visto há X s".
- Teste: regra `isHostAlive(lastSeen, now)` com limite de 45s.
