# Itens lançados que somem da mesa (mesa 13)

## O que a Auditoria mostrou
- O Evandro lançou **2x Mineiro (Grande)** na mesa 13, e o item foi impresso.
- Às 21:33, o aparelho da **Ana Kelly** salvou a mesa sem esse item. O pedido caiu de R$ 82,00 para R$ 38,00.
- Às 21:38, o aparelho do **Gustavo** fez o mesmo.
- O item voltou a aparecer como "Novo" numa tela que ainda o tinha guardado. Por isso ficou parecendo que ele nunca foi impresso.
- **Causa:** cada aparelho grava a lista inteira de itens da mesa. Um aparelho com a tela desatualizada (por exemplo, com a janela da mesa aberta antes do item chegar) sobrescreve o que outro aparelho lançou. O app entende isso como "item removido".

## Correção (todas as lojas)
1. **Gravar item por item, nunca a lista inteira.** Lançar um item só acrescenta aquele item. Mudar a quantidade só altera aquele item. Remover só acontece quando alguém toca na lixeira, com as permissões que já existem. Um aparelho atrasado não consegue mais apagar o que não viu.
2. **"Impresso" nunca volta a "Novo".** A marcação de impresso é gravada no banco item por item. Um aparelho que não sabe que o item foi impresso não consegue desfazer essa marcação.
3. **Janela da mesa sempre atualizada.** Com a mesa aberta, itens lançados por outro aparelho aparecem na hora. Ao abrir a mesa, ela é lida direto do banco, nunca da cópia antiga do aparelho.
4. **Recuperar a mesa 13:** devolver o 2x Mineiro (Grande) ao pedido, marcado como impresso. Antes de aplicar, verificar se outras mesas abertas perderam itens do mesmo jeito (pela Auditoria) e restaurar esses itens também. Mostro a lista antes de restaurar.

## Validação
- Abrir a mesma mesa em dois aparelhos.
- Lançar e enviar um item em um aparelho. Depois, salvar no outro sem recarregar.
- O item continua lá, marcado como impresso, e nenhum "Itens removidos" aparece na Auditoria.
- Testes automáticos para acrescentar, alterar e remover itens.

## Detalhes técnicos
- Funções no banco (SECURITY DEFINER, sempre limitadas à loja do usuário):
  - `order_add_items(order_id, items jsonb)`
  - `order_update_item(order_id, item_id, patch jsonb)`
  - `order_remove_item(order_id, item_id)`, que exige a permissão `remove_order_items`/admin quando o item já foi impresso
  - `order_mark_printed(order_id, item_ids[])`
- Todas recalculam o `total` no próprio banco, com a linha do pedido travada (`FOR UPDATE`).
- `syncOrders` em StoreContext deixa de enviar `items` em updates de pedidos de mesa já existentes. Só envia os metadados. Os itens vão por diferença (lançados/alterados/removidos explicitamente), através das funções acima.
- O ConsumerOrderModal recebe, em tempo real, o pedido aberto pelo id e faz a junção com o rascunho local. O envio e a impressão usam `order_mark_printed`.
- A restauração usa o `details.itens` de `items_removed` em pedidos que ainda estão abertos.
