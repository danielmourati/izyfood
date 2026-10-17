# Reimpressão indevida na cozinha e mesas que somem

## O que a investigação encontrou (Zezinho, mesa 28)
- O item **1x Carne Trinchada** (o mesmo item, não um novo lançamento) foi mandado para a cozinha **3 vezes**: às 13:46, 13:47 e 14:02 (horário de Brasília). Todas pelo celular do usuário "Atendente".
- Nas três vezes ele chegou na fila marcado como **"Novo"**, apesar de já ter sido impresso antes. Ou seja, depois de impresso, a marca de "Impresso" voltou para "Novo" no celular.
- Hoje o pedido no banco mostra o item como impresso. A marca só se perdia na memória do celular entre um envio e outro: a janela era reaberta com uma cópia antiga do pedido, ou um salvamento atrasado sobrescrevia a marca.
- Os envios mais recentes da mesa 28 (14:22, 14:26 e 14:28) mandaram só itens novos, como esperado.

## Correções
1. **Uma vez impresso, sempre impresso.** Ao salvar um pedido, um item que já está como "Impresso" no banco nunca volta para "Novo", mesmo que o aparelho mande uma cópia antiga.
2. **Conferência antes de enviar.** Ao tocar Enviar, Fechar ou "Imprimir na Cozinha", o app lê o pedido atualizado no banco e manda apenas os itens que ainda não foram impressos.
3. **Trava na fila.** Se um item já saiu na cozinha por esse pedido, ele é retirado da comanda nova. Se não sobrar nenhum item, a comanda não é criada. Reimpressão continua só para admin, pelo botão de reimprimir.
4. **Marca gravada na hora.** Logo depois do envio, a marca "Impresso" é gravada direto no banco, sem esperar o salvamento automático.
5. **A janela usa o pedido mais recente.** Ao reabrir uma mesa, a janela carrega a versão atual do pedido em vez de uma cópia guardada.

## Mesas que somem (todos os usuários)
- Primeiro passo: conferir no banco do Zezinho, para o dia de hoje, se alguma mesa ocupada perdeu o pedido ou foi liberada sem pagamento ou exclusão. Também vou conferir as 3 mesas (1, 19 e 22) que constavam como finalizadas sem horário de fechamento.
- Se aparecer algum caso, corrijo a causa encontrada. Se não aparecer, explico o que encontrei e mantenho as proteções que já existem.

## Detalhes técnicos
- `StoreContext` (gravação de `orders`): antes do upsert, buscar `items` atuais do pedido e fazer merge por `item.id` com `printed = db.printed || local.printed`.
- `ConsumerOrderModal` (`handleEnviarOrder`, `handleFecharOrder`, "Imprimir na Cozinha"): buscar `orders.items` frescos, calcular os itens não impressos a partir do merge e depois gravar `printed: true` com um update direto em `orders`.
- `use-printer` / `print-queue` (intent `new`, tipo `order`): remover os `item.id` já presentes em `print_jobs` do mesmo `payload.id` com intent `new`; pular o insert se a lista ficar vazia. Intent `reprint` fica livre.
- No início da janela, sincronizar `items` a partir de `storeOrders` quando o pedido remoto tiver itens impressos que a cópia local não tem.
- Consultas: `orders` e `store_tables` do tenant zezinho de hoje (mesas `occupied` sem pedido aberto, pedidos `finalizado` sem `completed_at`).
- Teste: merge que mantém `printed: true` quando a cópia local diz `false`; item já presente na fila não volta numa comanda nova.
