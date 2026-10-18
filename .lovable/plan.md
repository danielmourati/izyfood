# Mesas que somem após lançar e imprimir + auditoria de exclusões

## O que os dados mostram (Pastelão Sousa, agora)
- A mesa 2 está gravada corretamente neste momento: aberta pela Maria Eduarda às 21:03, 4 itens impressos, R$ 56,00. Não ficou rastro do que aconteceu antes. Hoje o app não registra quando um pedido é apagado, então não dá para confirmar o que houve na mesa 2.
- Mas o mesmo problema está acontecendo agora na **mesa 20**, e lá dá para ver a causa: ela tem **dois pedidos abertos ao mesmo tempo**.
  - O do Gustavo (21:01): Baiano Grande + Água, os dois impressos.
  - O da Ana Kelly (21:10): Carne de sol Grande + Coca Lata, os dois impressos.
  - A mesa aponta só para o pedido da Ana. O pedido do Gustavo **sumiu da tela** para todo mundo, apesar de ter sido impresso.
- **Causa:** quando um aparelho ainda acha que a mesa está livre (tela alguns segundos atrasada), ele cria um pedido novo para ela. Ao salvar, esse pedido toma o lugar do anterior na mesa, e o primeiro fica escondido.
- Achei também mais três caminhos que podem apagar um pedido com itens sem ninguém pedir:
  - O salvamento da tela de Mesas apaga o pedido quando a cópia do aparelho chega vazia.
  - O "descartar vazio" confere só a cópia do aparelho, não o que está gravado.
  - A sincronização apaga do banco qualquer pedido que some da lista do aparelho.

## O que será corrigido (todas as lojas)
1. **Um pedido aberto por mesa.** Antes de criar um pedido para uma mesa, o app confere o que está gravado. Se já houver pedido aberto nela, abre esse pedido em vez de criar outro. Se dois aparelhos criarem ao mesmo tempo, os itens do segundo entram no pedido que já existe. Nada fica escondido.
2. **Proteção também no banco.** O banco passa a recusar um segundo pedido aberto na mesma mesa. O app trata essa recusa juntando os itens no pedido existente.
3. **Nenhum pedido com itens é apagado sem ordem explícita.** Apagar só acontece por "Excluir pedido" confirmado ou ao juntar mesas. Nos demais caminhos, o app confere o que está gravado, e se houver itens, não apaga.
4. **Tela de Mesas mostra o pedido certo.** O cartão da mesa usa o pedido para o qual a mesa aponta. Uma mesa ocupada não some só porque já teve pedidos pagos antes.
5. **Correção dos dados da mesa 20:** os 2 itens do Gustavo entram no pedido atual da mesa (vai para R$ 45,00). O pedido duplicado é encerrado, sem ser cobrado de novo. Antes de aplicar, confiro se outras lojas têm duplicados e corrijo do mesmo jeito.

## Auditoria de exclusões (inclusive as não intencionais)
O registro passa a ser feito pelo próprio banco. Assim, qualquer exclusão fica gravada, venha de qualquer aparelho ou de erro do app:
- **Pedido/mesa apagado:** quem apagou, mesa, valor e lista de itens no momento.
- **Itens removidos de um pedido:** quais itens saíram (nome, quantidade, se já estavam impressos), mesa e quem salvou.
- **Mesa liberada sem pagamento:** mesa, pedido que estava nela e quem liberou.
- **Tentativa bloqueada:** quando a proteção do item 3 impede uma exclusão, isso também é registrado. Assim dá para ver se o problema voltou a acontecer.
- Rascunhos vazios (R$ 0,00, sem itens) não são registrados, para não poluir a lista.
- Na aba de Auditoria, esses eventos aparecem com nomes claros ("Pedido apagado", "Itens removidos", "Mesa liberada", "Exclusão bloqueada") e com a lista de itens legível.

## Validação
- Abrir a mesma mesa livre em dois aparelhos quase juntos e lançar itens em cada um. Deve ficar um único pedido com todos os itens.
- Fechar e reabrir a janela, recarregar a página: a mesa continua com os itens.
- Excluir um pedido com permissão, ou remover um item: o evento aparece na Auditoria.
- Testes automáticos:
  - Escolha do pedido da mesa.
  - Junção de itens ao recusar o duplicado.
  - Bloqueio de exclusão de pedido com itens.

## Detalhes técnicos
- **Migração:**
  - Índice único parcial em `orders (tenant_id, table_number) WHERE order_type='mesa' AND status IN ('aberto','segurado') AND table_number IS NOT NULL`. A correção de dados dos duplicados roda antes, pelo run_sql.
  - Função `audit_order_changes()` SECURITY DEFINER com gatilhos AFTER DELETE e AFTER UPDATE em `orders`. Ela registra:
    - delete com conteúdo;
    - itens que estão em OLD e não em NEW (por `id`), quando o status não é terminal.
  - Gatilho AFTER UPDATE em `store_tables` (`occupied→available`), registrado só quando o pedido vinculado não está finalizado/cancelado.
  - `user_id = coalesce(auth.uid(), '00000000-…')`, `user_name = coalesce(profiles.name,'sistema')`, `tenant_id = OLD.tenant_id`.
- **`src/pages/Mesas.tsx`:**
  - `handleTableClick` consulta `orders` aberto da mesa no banco antes de criar UUID novo.
  - `activeMesaOrders` prioriza `table.orderId`.
  - Remove a heurística `finishedTableNumbers` quando o pedido vinculado é desconhecido.
  - `handleSaveConsumerOrder`/`handleDiscardEmptyOrder` conferem o servidor antes de apagar.
- **`src/contexts/StoreContext.tsx` `syncOrders`:**
  - No caminho `removed`, lê o servidor. Se houver itens e o id não estiver em um conjunto `explicitDeletes` (preenchido por excluir/mesclar), não apaga e chama `logAudit('blocked_delete', …)`.
  - No upsert, ao receber `23505`, busca o pedido aberto da mesa, junta os itens (`mergeOrderItems`) e grava nele. Depois atualiza o estado local, trocando o id.
- **`ConsumerOrderModal.tsx`:** a exclusão confirmada marca o id em `explicitDeletes` e passa o motivo para a auditoria.
- **`AuditLogsTab.tsx` e `superadmin/AuditoriaPage.tsx`:** rótulos para `order_deleted`, `items_removed`, `table_freed`, `blocked_delete` e formatação da lista de itens.
- **Testes** em `src/test/` para os helpers puros novos (`src/lib/order-merge.ts`).
