# Finalizar conta: liberar a mesa e somar no caixa

## O problema (confirmado nos dados)

A venda de hoje (16:58, mesa 2, R$ 78,00 no Pix) foi gravada corretamente em vendas — o caixa tem o valor. Mas o pedido dessa mesa continua com situação "aberto", sem forma de pagamento e sem data de finalização, e a mesa 2 continua marcada como ocupada apontando para esse mesmo pedido.

Causa: ao receber o pagamento, o sistema registra a venda e libera a mesa, mas a cópia do pedido que está na tela continua marcada como aberta. Qualquer salvamento seguinte dessa cópia regrava o pedido como "aberto" no banco, apagando o pagamento e a finalização — e a mesa é reocupada automaticamente porque volta a existir um pedido aberto para ela.

## O que será corrigido

1. Ao confirmar o pagamento, o pedido passa a ser marcado como finalizado (com forma de pagamento, valor final, taxa/desconto e data) antes de a mesa ser liberada.
2. A mesa só é liberada depois que a finalização do pedido está confirmada — assim ela não volta a aparecer ocupada.
3. Um pedido já finalizado ou cancelado nunca mais pode ser reaberto por um salvamento automático de tela. Se a gravação da finalização falhar, aparece um aviso em vez de a mesa ficar num estado incoerente.
4. A comanda fecha e a mesa aparece livre em todos os aparelhos em poucos segundos, e continua livre após recarregar a página.
5. Valores recebidos continuam somando no caixa separados por forma de pagamento (dinheiro, Pix, cartão, fiado), inclusive quando o total é dividido em várias formas na mesma finalização. Se a gravação da venda falhar, o pagamento não é concluído e o usuário é avisado.
6. Fiado: a parte lançada no fiado vai para a dívida do cliente e a mesa é liberada normalmente.
7. Pagamento parcial continua não sendo permitido: só é possível finalizar quando o total está totalmente coberto (podendo estar dividido em várias formas).

## Limpeza dos dados travados

O pedido da mesa 2 de hoje (R$ 78,00, já pago) será marcado como finalizado com o pagamento em Pix e a mesa 2 será liberada, para o estado atual ficar coerente. Também serão liberadas mesas que estejam ocupadas apontando para pedidos já pagos.

## Detalhes técnicos

- `src/contexts/StoreContext.tsx` (`completeSale`): passa a (a) verificar o erro do `insert` em `sales` e abortar em caso de falha, (b) atualizar `orders` no banco com `status: 'finalizado'`, `completed_at`, `payment_method`, `payment_splits`, `total`, `discount`, `service_fee` e checar o erro, (c) somente então chamar `freeTable`, (d) atualizar o estado local do pedido para `status: 'finalizado'`, `isLocked: false`, `completedAt` (com `saveLS`), evitando que o `syncOrders` posterior regrave a versão antiga. `markPending` do pedido/mesa mantido até o fim da sequência; `lastSyncError` recebe mensagem em caso de falha.
- `syncOrders`: a derivação de status a partir de `isLocked` (`lockAware`) passa a valer só para pedidos cujo status atual é `aberto`/`segurado`; pedidos `finalizado`/`cancelado`/`concluido` nunca são regravados como abertos.
- Reconciliação de mesas (`fetchTablesAndOrders`): mantém a regra atual — pedidos finalizados não entram em `tableOrderMap`, portanto a mesa é liberada em todos os dispositivos.
- `src/components/CheckoutModal.tsx`: `handleFinalize` passa a aguardar `completeSale` e só fecha o modal / limpa o estado em caso de sucesso.
- Caixa (`src/pages/Caixa.tsx`): totais por forma de pagamento já derivam de `payment_splits`; sem mudança de cálculo.
- Migração de correção de dados para o pedido/mesa travados.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json` e teste com duas sessões (mobile + desktop) confirmando mesa livre nos dois e valor no caixa por forma de pagamento.
