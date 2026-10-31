# Troca de mesa segura + Transferência de itens entre mesas

## 1. Troca de número de mesa (blindagem)
Hoje o banco já recusa mover para uma mesa com pedido aberto, mas o passo final "ocupa a mesa destino" sobrescreve o vínculo da mesa destino mesmo se ela estiver marcada como ocupada por outro pedido (ex.: pedido vazio ou registro antigo). Correções:
- Trocar só se a mesa destino estiver livre (sem pedido aberto **e** sem vínculo ativo de outro pedido); caso contrário, recusar com mensagem "Mesa X já está ocupada".
- Travar as duas mesas na mesma operação (evita dois aparelhos movendo para a mesma mesa ao mesmo tempo).
- Liberar a mesa de origem sempre que a troca for concluída.
- Na tela, a lista de destinos mostra só mesas livres e o erro aparece dentro da janela (sem notificações flutuantes).

## 2. Transferência de itens (nova janela)
Botão **Transferir** no card/pedido da mesa abre uma janela dividida:

```text
+---------------------+-----------+---------------------+
| Mesa 5 (origem)     |           | Destino: [Mesa __]  |
| [x] 2x Pastel Carne | [Tudo >>] | itens atuais da     |
| [ ] 1x Coca Lata    |           | mesa destino        |
| [x] 1x Suco         | [Sel. >]  | (somente leitura)   |
| Total R$ ...        |           | Total R$ ...        |
+---------------------+-----------+---------------------+
```
- Esquerda: itens da origem com caixas de seleção (e escolha de quantidade quando o item tem mais de 1 unidade).
- Direita: campo/seletor do número da mesa destino e prévia dos itens dela.
- Meio: **Transferir tudo** e **Transferir selecionados** (desabilitado sem seleção).
- Se a mesa destino não estiver aberta: pergunta inline "A mesa X não está aberta. Deseja abri-la?" com Abrir e transferir / Cancelar.
- **Total**: origem liberada e pedido de origem encerrado sem venda (vazio); se destino estava livre, equivale à troca de mesa.
- **Parcial**: ambas continuam abertas; totais recalculados.
- Itens mantêm autor, sabores/observações e estado "impresso" (não geram nova comanda na cozinha).
- Bloqueado se a origem ficar vazia por parcial (vira total) e se alguma mesa estiver fechada/paga.
- Tudo registrado no histórico: de qual mesa, para qual, quais itens e quem fez.

## Detalhes técnicos
- Migração: reescrever `move_order_table` com `FOR UPDATE` em `store_tables` origem/destino e recusar se destino `occupied` com `order_id` diferente (ou pedido aberto). Sem `ON CONFLICT DO UPDATE` cego.
- Nova RPC `transfer_order_items(_from_order uuid, _to_table int, _items jsonb /* [{id, qty}] */, _create_if_missing bool)` SECURITY DEFINER, tenant via `get_user_tenant_id()`, numa única transação: trava os dois pedidos, divide itens (split de quantidade gera novo id de item), usa `app.items_merge` para passar pelo `preserve_order_items`, recalcula `total`, cria pedido destino (herdando `opened_by`) se pedido de destino não existe e `_create_if_missing`, retorna erro `destination_missing` caso contrário; transferência total: esvazia e cancela origem usando `allowOrderDelete`/liberação via `release_table`. Auditoria `items_transferred`.
- Frontend: `StoreContext.transferOrderItems`, novo `TransferItemsModal.tsx` (grid 2 colunas + coluna central; empilhado no mobile), substitui o modal atual de transferência em `Mesas.tsx` e entrada em `ConsumerOrderModal.tsx`.
- Testes: destino ocupado é recusado; total libera origem; parcial mantém ambas com totais corretos; split de quantidade.
- AGENTS.md: regra de que transferências de itens só passam por `transfer_order_items`.
