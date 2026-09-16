# Sincronização em tempo real entre dispositivos

## Objetivo

Qualquer alteração feita em um dispositivo (item lançado, mesa aberta/liberada, pedido, produto) deve aparecer em poucos segundos no celular e no PC, e o que foi apagado deve realmente desaparecer nos outros aparelhos.

## O que foi verificado

- No banco, todas as tabelas usadas pelo app já estão publicadas para tempo real e com identidade de réplica completa. O problema está no aplicativo, não na configuração do banco.
- Ao receber qualquer aviso de mudança em pedidos ou mesas, o app recarrega tudo (13 consultas de uma vez). Sem espaçamento entre chamadas, e somado a uma atualização automática a cada 5 segundos, isso gera enxurrada de consultas, respostas fora de ordem e telas que "voltam" ao estado antigo.
- Na junção dos dados, o app mantém no aparelho tudo o que existe localmente e não veio do banco. Consequência: itens/pedidos/clientes excluídos em outro dispositivo ressuscitam no aparelho antigo e nunca somem.
- A proteção de mesa ocupada (criada na correção anterior) mantém a mesa ocupada mesmo quando o banco já diz que ela foi liberada. Assim, liberar/finalizar uma mesa em um aparelho não reflete no outro.
- Não há tratamento de reconexão: se a conexão em tempo real cair (celular em segundo plano, troca de rede, sessão renovada), o app não reassina e passa a depender só da atualização de 5 segundos.

## Mudanças

1. **Banco como fonte da verdade.** A junção passa a refletir o banco. Só permanece no aparelho aquilo que acabou de ser criado localmente e ainda está sendo enviado (janela curta de alguns segundos, controlada por uma lista de pendências). Assim, exclusões feitas em qualquer dispositivo desaparecem em todos.
2. **Atualização por tabela e agrupada.** Cada aviso recarrega apenas a tabela afetada (pedidos, mesas, etc.), com agrupamento de ~300 ms para eventos em rajada, e descarte de respostas antigas que chegarem depois de uma mais nova.
3. **Mesas sincronizam nos dois sentidos.** A proteção contra liberação indevida passa a valer somente para alterações locais recentes (janela de graça). Se o banco informar que a mesa foi liberada, finalizada, transferida ou excluída por outro dispositivo, o aparelho aceita e atualiza a tela.
4. **Reconexão automática.** Ao detectar erro, tempo esgotado ou canal fechado, o app reassina com espera progressiva; ao reassinar e ao voltar do segundo plano/rede, faz uma recarga completa para fechar qualquer lacuna. A atualização periódica passa a ser rede de segurança leve (a cada 20 s, só quando a conexão em tempo real não está saudável).
5. **Diagnóstico visível.** A tela de diagnóstico de sincronização mostra o estado da conexão em tempo real, horário da última atualização recebida e contagem de eventos, para conferir o funcionamento no celular e no PC.

## Detalhes técnicos

- `src/contexts/StoreContext.tsx`
  - Substituir os blocos `localOnly` de `silentFetchAll` por reconciliação autoritativa com `pendingIdsRef` (ids com marca de tempo, expiram em ~8 s).
  - Quebrar `silentFetchAll` em buscas por entidade (`fetchOrders`, `fetchTables`, `fetchProducts`, ...) mais um `fetchAll`; adicionar coalescência por `setTimeout` (300 ms) e contador de sequência por entidade para descartar respostas obsoletas.
  - Ajustar os passos 3 e 4 da montagem de `tables`: preservar `occupied` local apenas se houver alteração local pendente na janela de graça; caso contrário aceitar o estado do banco.
  - Revisar a guarda de `DELETE` em `store_tables` no canal realtime com a mesma regra de janela de graça.
  - `.subscribe((status) => ...)` com tratamento de `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`: `removeChannel` + reassinatura com backoff (1s, 2s, 5s, 10s, máx. 30s); `SUBSCRIBED` dispara `fetchAll`.
  - Heartbeat de 5 s → 20 s e só executa quando o canal não está `SUBSCRIBED`.
- `src/pages/DiagnosticoSync.tsx`: expor status do canal, último evento recebido e total de eventos por tabela.

## Validação

- Duas sessões abertas (desktop e celular no mesmo tenant): lançar item na mesa em um e ver refletir no outro em poucos segundos.
- Finalizar/liberar mesa em um dispositivo: o outro sai de "Pedidos em andamento".
- Excluir produto/cliente em um dispositivo: não reaparece no outro, nem após recarregar.
- Deixar o celular em segundo plano por 1 minuto e voltar: dados sincronizam sozinhos.
- Confirmar que a mesa ocupada continua protegida ao fechar modal, voltar e recarregar (regra da correção anterior).
