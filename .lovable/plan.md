# Exibir observações e complementos junto aos itens

## Objetivo
Mostrar, logo abaixo de cada produto, todas as observações e todos os complementos escolhidos, tanto no carrinho/controle do pedido quanto no storefront e nos cupons impressos.

## Alterações
- Criar uma apresentação reutilizável para os detalhes do item, lendo os campos estruturados (`selectedNotes`, `otherNotes`, `selectedComplements`) e mantendo compatibilidade com pedidos antigos que possuem apenas `notes`.
- Exibir os detalhes no carrinho do PDV e nas listas mobile e desktop do pedido/storefront, sem alterar preço, quantidade ou regras de edição.
- Incluir os detalhes também na revisão mobile e na seleção de itens para reimpressão.
- Manter observações e complementos no cupom da cozinha e adicionar as observações que faltam no cupom da conta, tanto na impressão térmica quanto na prévia/impressão pelo navegador.
- Evitar observações duplicadas quando os campos estruturados e o campo antigo tiverem o mesmo conteúdo.

## Validação
- Personalizar um produto com múltiplas observações, texto livre e complementos com quantidades diferentes.
- Confirmar a exibição abaixo do item no carrinho do PDV, no storefront mobile e desktop e na revisão do pedido.
- Confirmar a mesma informação na prévia e na impressão dos cupons da cozinha e da conta, em 58 mm e 80 mm.
- Executar os testes de personalização e impressão e validar o projeto sem erros.
