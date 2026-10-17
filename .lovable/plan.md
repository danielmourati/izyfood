# Mesas: itens que somem e mesas pagas que continuam abertas no Caixa

## O que os dados mostram (Pastelão Sousa, últimas 12h)
- As mesas recebidas pelos atendentes estão gravadas corretamente: pedido "finalizado", com forma de pagamento, venda no caixa e mesa liberada (ex.: mesas 2, 9, 10, 11, 12, 13, 23, 80).
- Ou seja, o problema da Ana Kelly é de **tela desatualizada** no aparelho do Caixa: ele não recebe (ou ignora) a atualização de "finalizado" vinda de outro aparelho e continua mostrando a mesa aberta com a cópia antiga.
- Essa cópia antiga é perigosa: quando o Caixa salva qualquer coisa dessa mesa (ou a salva sozinho), regrava a lista de itens antiga por cima da que o atendente acabou de enviar. Essa é a causa provável dos itens que "não ficam gravados" — a impressão sai porque acontece antes, mas outro aparelho sobrescreve a lista depois. A primeira etapa confirma isso no código antes de corrigir.

## O que será corrigido (todas as lojas)
1. **Mesa paga some em todos os aparelhos**: quando um pedido vira finalizado/cancelado em qualquer aparelho, todos os outros removem a mesa das abertas em poucos segundos, sem recarregar. Uma cópia local nunca vence o banco quando o banco diz "finalizado".
2. **Nenhum aparelho reabre mesa paga**: um pedido finalizado no banco não pode voltar a "aberto" por salvamento de uma tela antiga.
3. **Itens não se perdem**: ao salvar, o aparelho junta os itens com o que já está no banco em vez de substituir a lista inteira; um item só sai da mesa quando alguém o remove de fato. Itens enviados por outro atendente aparecem nos demais aparelhos.
4. **Atualização de segurança**: além do tempo real, cada aparelho reconfere as mesas abertas periodicamente e ao voltar para a aba, para corrigir qualquer atualização perdida.
5. Mesas hoje marcadas como ocupadas mas apontando para pedido já pago (mesas 1 e 20 no Pastelão Sousa) serão liberadas.

## Detalhes técnicos
- `StoreContext.tsx`: no handler realtime de `orders`, aplicar status terminal do servidor sempre (sobrepondo estado local e `saveLS`); descartar pendências locais desse pedido.
- `syncOrders`: antes do upsert, ler `status, items` atuais; se servidor terminal, abortar; se aberto, mesclar itens por `id` (união, preservando `printed` e respeitando remoções locais explícitas registradas por id), recalcular total.
- Rastrear remoções explícitas (conjunto de ids removidos) para a mescla não ressuscitar itens apagados.
- Refetch de pedidos abertos em `visibilitychange` e a cada ~20s; reconciliar `store_tables`.
- Correção de dados: liberar `store_tables` ocupadas cujo `order_id` é pedido finalizado/cancelado.
- Testes: mescla de itens (item novo de outro aparelho preservado; item removido não volta) e status terminal não regravado.
