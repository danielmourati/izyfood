# Manter salvos os valores já recebidos na conta

## Causa confirmada
- No banco, nenhum pedido aberto da loja tem pagamentos parciais gravados: a gravação é desfeita logo depois.
- A tela de pagamento grava as parcelas no pedido da loja, mas a comanda (Mesas/celular) guarda uma cópia própria do pedido, sem essas parcelas.
- Ao sair do pagamento e fechar/salvar a comanda (ou em qualquer gravação automática dela), essa cópia antiga substitui o pedido inteiro e apaga as parcelas no banco.
- Ao reabrir o pagamento, a tela lê as parcelas dessa mesma cópia antiga, então elas aparecem vazias. No PDV acontece o mesmo: o pedido entregue ao pagamento é montado do zero, sem parcelas.

## Correção
1. **Pagamento lê do pedido salvo:** ao abrir, a tela de pagamento busca as parcelas no pedido da loja (e, se preciso, direto no banco), não na cópia da comanda.
2. **Gravação direta e conferida:** cada parcela adicionada/removida é gravada imediatamente no pedido no banco, com conferência de erro e aviso visível na tela se falhar.
3. **Comanda não apaga parcelas:** ao salvar a comanda (Mesas, celular e PDV), as parcelas já existentes no pedido são preservadas em vez de sobrescritas; a cópia local da comanda também passa a receber as parcelas atualizadas.
4. **Tempo real:** parcelas recebidas em outro aparelho aparecem ao abrir o pagamento.

## Validação
- Lançar R$ 10,00 em Dinheiro numa mesa, sair do pagamento, fechar a comanda, reabrir: parcela presente e gravada no banco.
- Mesmo teste no PDV e em outro aparelho; remover parcela e confirmar remoção.
- Finalizar a venda e conferir caixa por forma de pagamento.
- Tipagem, testes e build.

## Detalhes técnicos
- `CheckoutModal.tsx`: no `open`, inicializar `splits` a partir de `storeOrders.find(id)?.paymentSplits` com fallback `select payment_splits` em `orders`; persistir via `update({ payment_splits }).eq('id')` com tratamento de erro, além do `setOrders`.
- `Mesas.tsx` `handleSaveConsumerOrder` e salvamentos do `PDV.tsx`: merge `paymentSplits: updated.paymentSplits ?? existing.paymentSplits`.
- `ConsumerOrderModal.tsx`: sincronizar `currentOrder.paymentSplits` com o pedido da loja.
