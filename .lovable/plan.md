# Recuperar o pedido apagado na mesa 2 (Zezinho)

## O que o histórico mostra
- 19:32:00 — o pedido da mesa 14 (R$ 576) foi passado para a mesa 2.
- 19:32:13 — voltou da mesa 2 para a mesa 14.
- 19:33:29 — o pedido foi apagado (27 itens, R$ 596), sem senha de admin. As mesas 2 e 14 ficaram livres.
- Hoje as duas mesas estão livres e o pedido não existe mais.

## O que vou fazer
1. Recriar o pedido com o mesmo número original, aberto na **mesa 2**, com os 27 itens do histórico (mesmas quantidades, quem lançou cada item e todos marcados como já impressos, para não sair comanda de novo na cozinha).
2. Pegar o preço de cada item do cardápio atual e conferir se a soma bate com R$ 596. Se não bater, paro e aviso antes de gravar.
3. Marcar a mesa 2 como ocupada com esse pedido e registrar no histórico: "pedido restaurado na mesa 2".
4. Conferir no banco que a mesa 2 aparece aberta com 27 itens e R$ 596.

## Limitações
- O histórico guarda nome, quantidade, autor e se já foi impresso, mas não guarda os sabores/observações de cada item. Esses detalhes não podem ser recuperados.
- Dados de cliente e desconto do pedido, se havia, também não estão no histórico.

## Depois (opcional, pedir confirmação)
- O pedido foi apagado sem senha de admin, mesmo tendo itens. Posso investigar qual tela permitiu isso e bloquear.
