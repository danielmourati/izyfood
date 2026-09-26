# Seleção de observações e complementos no rodapé mobile

## Objetivo
Substituir o botão `+` do painel verde do produto selecionado por um botão com ícone de seleção/check, que abre a janela de personalização daquele item.

## Comportamento
- Manter os controles `+ 1`, `- 1` e excluir como estão.
- Trocar o quarto botão por um ícone de check com identificação acessível de “Selecionar opções”.
- Ao tocar nele, abrir a janela existente de personalização com o item já lançado selecionado para edição, evitando criar uma linha duplicada no pedido.
- Exibir nessa janela somente observações e complementos ativos vinculados à categoria do produto selecionado.
- Preservar quantidade, observações e complementos já escolhidos quando a janela for reaberta.
- Ao confirmar, atualizar o subtotal e o total do pedido com os complementos pagos.

## Detalhes técnicos
- Reutilizar `ConsumerItemCustomizeModal`, que já separa observações e complementos e filtra as opções por `categoryId`.
- No rodapé mobile, localizar o item não enviado correspondente ao produto selecionado e passá-lo como item em edição antes de abrir a janela.
- Alinhar o filtro da janela para não apresentar opções de outras categorias quando houver uma categoria válida.

## Validação
- Selecionar um produto e confirmar que o quarto botão mostra check em vez de `+`.
- Abrir a janela e conferir que aparecem apenas as observações e complementos da categoria do produto.
- Selecionar opções, confirmar, reabrir e verificar que as escolhas permanecem.
- Confirmar que o item é atualizado sem duplicação e que os complementos pagos alteram o total corretamente.
- Verificar o fluxo em tela mobile e executar os testes de regressão relevantes.
