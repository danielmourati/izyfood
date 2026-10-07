# Unificar Observações e Complementos como Adicionais

## Resultado esperado
- Toda a plataforma passa a usar o nome **Adicionais**; os termos “Complementos” e “Observações” deixam de aparecer no cadastro, seleção, carrinho, storefront, prévias e cupons.
- As opções hoje cadastradas como observações passam a ser adicionais, mantendo nome, categorias, situação ativa e preço atual.
- A opção **Todos os adicionais** será um item comum, ativo e gratuito. Quando selecionada, o cupom imprime literalmente “Todos os adicionais”; os demais adicionais escolhidos continuam listados individualmente.

## Tratamento dos dados
- Aplicar a conversão em todas as lojas existentes.
- A base atual possui observações em quatro lojas; a loja Quintal de Casa possui 22 nomes repetidos entre Observações e Complementos.
- Unificar opções repetidas por loja e nome, sem perder vínculos: manter o adicional já existente, reunir as categorias dos dois registros, preservar o preço do adicional pago e considerar ativo se qualquer registro estiver ativo.
- Converter observações sem duplicata em adicionais gratuitos.
- Criar “Todos os adicionais” uma única vez por loja, vinculado às categorias atuais, sem gerar duplicatas se a operação for repetida.
- Preservar os pedidos antigos e seus campos internos para que carrinho, histórico e reimpressões continuem funcionando.

## Telas e fluxo
- Simplificar o cadastro para uma única lista **Adicionais**, com ações de criar, editar e excluir.
- O formulário passa a mostrar “Novo adicional”, “Editar adicional” e “Preço adicional”, permitindo valor zero.
- Nas janelas de personalização, reunir todas as opções na seção **Adicionais**, com seleção e quantidade, inclusive “Todos os adicionais”.
- Exibir os adicionais selecionados junto ao produto no carrinho e no storefront, usando singular ou plural sem repetir o título.

## Impressão
- Atualizar comanda da cozinha, conta, prévia e impressão pelo navegador para usar apenas “Adicional” ou “Adicionais”.
- Imprimir cada opção selecionada em sua própria linha.
- Tratar “Todos os adicionais” como uma opção normal: ela aparece literalmente quando escolhida e não marca automaticamente as demais.

## Detalhes técnicos
- A alteração dos registros será feita como atualização de dados, sem mudar a estrutura da tabela.
- O tipo interno legado `note` continuará aceito somente para leitura de pedidos antigos; novos cadastros e opções atuais usarão `complement`.
- A unificação será isolada por `tenant_id` e comparará nomes sem diferenciar maiúsculas, minúsculas ou espaços nas extremidades.
- Os campos legados de pedidos (`selectedNotes`, `otherNotes`, `selectedComplements`) continuarão compatíveis, mas a apresentação será normalizada como Adicionais.

## Validação
- Conferir que não restam opções atuais do tipo observação nem nomes duplicados por loja.
- Criar e editar adicional gratuito e pago; selecionar um ou vários no pedido e reabrir a personalização.
- Selecionar “Todos os adicionais” junto com outras opções e confirmar a ordem linha a linha no carrinho, storefront, comanda e conta.
- Validar os cupons de 58 mm e 80 mm, os testes de personalização/impressão, a tipagem e o build.
