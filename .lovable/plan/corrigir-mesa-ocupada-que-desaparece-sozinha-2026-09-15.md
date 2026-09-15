# Corrigir mesa ocupada que desaparece sozinha

## Problema observado

Nos anexos, a mesa 10 estava ocupada com R$ 80,00 e, segundos depois, voltou para a lista de "Mesas/Comandas livres" — o pedido foi apagado sem o usuário finalizar nada.

## Causa

No modal de pedido da mesa há caminhos de "descarte" que apagam o pedido inteiro e liberam a mesa, mesmo quando ela já está ocupada e com valor:

- No aviso de "itens não enviados", a opção **Descartar Itens Não Enviados** apaga o pedido completo quando nenhum item havia sido impresso ainda — mesmo que o pedido tenha itens e valor.
- A tela de Mesas libera a mesa e apaga o pedido em qualquer chamada de descarte, sem checar se o pedido realmente está vazio.
- Esse descarte muda a mesa para livre apenas na tela; no banco existe uma proteção que impede desocupar a mesa, então a mesa e o pedido ficam inconsistentes após recarregar.

## Regra a implementar

Uma mesa ocupada só pode ser liberada em três situações explícitas do usuário:

1. Finalização do pagamento (checkout concluído).
2. Exclusão/cancelamento confirmado por quem tem permissão.
3. Transferência ou mesclagem para outra mesa.

Em qualquer outro caminho (fechar modal, voltar, descartar itens não enviados, sair do app, recarregar), a mesa permanece ocupada com seus itens.

## Mudanças

1. **Descartar itens não enviados** passa a remover somente os itens não enviados. O pedido continua existindo, a mesa continua ocupada, e o total é recalculado com o que já foi enviado. Se sobrar zero item, a mesa continua ocupada com pedido vazio (liberação só pela exclusão confirmada).
2. **Descarte de rascunho vazio** só age quando o pedido realmente não tem item algum e total zero, e apenas quando a mesa ainda não estava ocupada. Fora disso, nada é apagado.
3. **Tela de Mesas** ganha uma verificação de segurança antes de apagar/liberar: se o pedido tiver itens ou valor, o descarte é ignorado (com registro no console para diagnóstico).
4. **Liberação da mesa sempre pelo caminho oficial** (`freeTable`), para que tela e banco fiquem sincronizados, em vez de alterar apenas o estado local.
5. **Proteção contra remoção via sincronização em tempo real**: eventos de exclusão de mesa são ignorados quando a mesa está ocupada localmente.

## Detalhes técnicos

- `src/components/consumer/ConsumerOrderModal.tsx`: reescrever o handler do botão "Descartar Itens Não Enviados" para filtrar `printed === false` e salvar o pedido restante; ajustar `handleCloseAndSaveOrDiscard` e `handleFecharOrder` para nunca chamar descarte quando `items.length > 0 || totalAmount > 0`.
- `src/pages/Mesas.tsx`: em `handleDiscardEmptyOrder`, consultar o pedido em `orders` e abortar se tiver itens/total; usar `freeTable` do `StoreContext` no lugar de `setTables`. `handleDeleteConsumerOrder` (exclusão confirmada) mantém o comportamento atual de liberar.
- `src/contexts/StoreContext.tsx`: no canal realtime de `store_tables`, ignorar `DELETE` quando a mesa local estiver `occupied`.

## Validação

- Abrir mesa, lançar itens sem enviar, fechar o modal e escolher "Descartar Itens Não Enviados": mesa segue ocupada com os itens já enviados.
- Mesa com R$ 80,00: fechar modal / voltar / recarregar (F5) mantém a mesa ocupada com o valor.
- Excluir pedido com permissão: mesa volta para livre.
