# Cancelar cupons da fila e acabar com mesas/itens que somem

## Parte 1 — Botão "Cancelar" na Fila de impressão
- Cada cupom "Na fila", "Falhou" ou travado em "Imprimindo" ganha o botão **Cancelar** ao lado de "Forçar impressão".
- No topo, botão **Cancelar todos** (só aparece se houver cupons canceláveis).
- Antes de cancelar, aparece uma confirmação na própria tela ("Cancelar 5 cupons? Eles não serão impressos."), sem notificação flutuante.
- Cupom cancelado sai da fila e o Caixa não imprime mais. Fica registrado no histórico de auditoria (quem cancelou, quantos, de qual mesa).
- Cupons já "Impressos" não mostram o botão (continuam saindo com "Limpar impressos").

## Parte 2 — O que o histórico mostrou (últimos 3 dias)
- **Mesas liberadas com pedido ainda aberto**: Pastelão Sousa mesa 2 (aberta por Ana Kelly às 21:00:50, liberada pelo aparelho do Gustavo 10 segundos depois), mesa 80 (liberada 2 vezes com o pedido em andamento) e Zezinho mesa 14. Nos três casos o pedido continuou existindo, mas a mesa deixou de apontar para ele — por isso "some" da tela de outros aparelhos.
- **Causa 1 (confirmada no código):** a liberação da mesa é feita só pelo número. Quando um aparelho fecha uma comanda vazia, paga um pedido ou exclui um pedido daquela mesa, ele libera a mesa **mesmo que ela já pertença a outro pedido** aberto por outro atendente.
- **Causa 2 (brecha no código):** ao salvar, o app primeiro consulta o pedido no banco. Se essa consulta falha (sinal fraco), ele grava a lista de itens que o aparelho tem por cima da do banco, apagando itens lançados por outros aparelhos.
- **Causa 3:** aparelhos com versão antiga do app ainda aberta continuam usando o caminho antigo; só regras no banco protegem contra eles.
- As 35 remoções de itens não impressos no Pastelão Sousa não dizem se foi a lixeira ou o sistema — hoje o histórico não separa as duas coisas.

## Parte 3 — Solução (todas as lojas)
1. **A mesa só é liberada pelo pedido dono dela.** Pagar, excluir, descartar comanda vazia ou mudar de mesa passam a dizer "libere a mesa X que pertence ao pedido Y". Se a mesa já pertence a outro pedido aberto, nada acontece.
2. **Proteção no banco contra qualquer aparelho (inclusive versões antigas):** uma mesa nunca é liberada enquanto o pedido dela estiver aberto, com itens e ainda naquela mesa. A tentativa é bloqueada e registrada como "liberação bloqueada" na auditoria.
3. **Mudar de mesa em um passo só:** trocar o número do pedido, liberar a mesa antiga e ocupar a nova acontecem juntos, sem janela para outro aparelho atrapalhar.
4. **Itens só saem pela lixeira.** O banco passa a recolocar automaticamente qualquer item que "sumiu" numa gravação, a menos que ele tenha sido removido explicitamente pela lixeira. Vale também para aparelhos com versão antiga.
5. **Falha de conexão ao salvar** não grava mais por cima: o app tenta de novo em vez de sobrescrever.
6. **Auditoria mais clara:** cada item removido mostra a origem — "lixeira (usuário)" ou "sistema" — e mesas liberadas/bloqueadas mostram qual pedido pediu a liberação.
7. Depois de aplicado, conferir no banco se alguma mesa está livre com pedido aberto e religá-la.

## Detalhes técnicos
- `print-queue.ts`: `cancelPrintJobs(ids?)` via RPC `cancel_print_jobs(_ids uuid[])` (security definer, tenant-scoped, apaga `pending`/`error`/`printing` vencido, grava `audit_logs` action `print_canceled`); `canCancelPrintJob` = mesma regra de `canForcePrintJob`. `PrintQueuePanel.tsx`: botões + confirmação inline.
- Migração:
  - RPC `release_table(_number int, _order_id uuid)`: `UPDATE store_tables SET status='available', order_id=NULL WHERE tenant_id=get_user_tenant_id() AND number=_number AND (order_id=_order_id OR order_id IS NULL)`.
  - RPC `move_order_table(_order_id, _to int)`: atualiza `orders.table_number`, libera a origem condicionalmente e ocupa o destino, numa transação.
  - Trigger BEFORE UPDATE em `store_tables`: se `OLD.order_id` é pedido não terminal, com itens/valor e `table_number = OLD.number`, mantém `occupied`/`order_id` e grava `table_free_blocked`.
  - Trigger BEFORE UPDATE em `orders`: quando `items` muda fora de `save_order_items` (flag `set_config('app.items_merge','on',true)`), reanexa itens do OLD ausentes no NEW, preserva `printed=true` e recalcula `total`. `save_order_items` passa `_removed_ids` em `app.removed_ids` para `audit_order_changes` registrar `origem`.
- `StoreContext.tsx`: `freeTable(number, orderId?)` usa `release_table`; `completeSale` passa `order.id`; em `syncOrders`, erro no select prévio → retry/throw, nunca upsert sobre pedido existente; pedido novo usa insert e cai no RPC se já existir.
- `Mesas.tsx`, `Balcao.tsx`, `ConsumerOrderModal.tsx`: excluir pedido primeiro e liberar depois com o `orderId`; mover mesa via `move_order_table`.
- Testes: liberação só pelo pedido dono; item sumido numa gravação comum volta; item removido pela lixeira não volta; cancelar só cupons não impressos.
