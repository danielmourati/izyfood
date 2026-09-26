# Refatorar cadastro de produtos, categorias, observações e complementos + impressão por setor

## O que muda para o usuário

1. **Nova tela de Produtos em abas** (no estilo das imagens de referência):
   - **Produtos**: uma tabela agrupada por categoria, com código, nome, preço de venda, estoque mínimo, estoque atual e situação do estoque (Regular / Baixo / Não controlado). Tem busca e a opção "Agrupar por categoria". Os botões ficam em cima: Novo produto, Editar, Estoque.
   - **Categorias**: lista com editar/excluir e a **impressora padrão** de cada categoria (ex.: Refeições e Porções → Cozinha; Bebidas e Refrigerantes → Bar).
   - **Observações e Complementos**: duas listas lado a lado. Observações só com descrição. Complementos com descrição e valor. Cada item tem editar, excluir e as categorias em que aparece.
2. **Novo formulário do produto**, dividido em três blocos:
   - *Dados principais*: código de busca, nome, categoria, preço de venda e preço de custo.
   - *Configurações*: venda por quilo, isento da taxa de serviço, participa da fidelidade e **"Imprimir em"** (Padrão da categoria / Cozinha / Bar / Balcão / Recibo / setores personalizados / Não imprimir).
   - *Estoque*: estoque controlado, estoque mínimo e estoque atual.
3. **Sem fotos**: o envio de foto sai do cadastro, da importação por planilha e dos cartões do PDV e do cardápio. Os cartões passam a mostrar só texto, ficam mais compactos e usam a inicial da categoria como marca. As fotos já salvas continuam guardadas, mas deixam de aparecer.
4. **Pedido dividido por impressora**: ao enviar um pedido, os itens são separados por setor. Sai uma comanda na Cozinha só com os pratos e outra no Bar só com as bebidas. Isso vale para a impressora local e para a fila do caixa. A conta do cliente continua saindo inteira na impressora de recibo.

## Ordem de execução
1. Criar os novos campos no banco.
2. Montar a nova tela de Produtos e os formulários.
3. Remover as fotos.
4. Dividir as comandas por setor.
5. Testar enviando um pedido misto (prato + bebida).

## Detalhes técnicos
- Migração (só adiciona campos):
  - `products`: `search_code text`, `cost_price numeric`, `min_stock numeric default 0`, `service_fee_exempt boolean default false` e `print_sector text null` (null = herda da categoria; `'none'` = não imprime).
  - `categories`: `print_sector text null` (null = `cozinha`).
  - `products.image` recebe o comentário DEPRECATED.
- Tipos `Product`/`ProductCategory` e o mapeamento em `StoreContext` ganham os novos campos.
- `Produtos.tsx` será dividido em `ProductsTab`, `CategoriesTab`, `NoteOptionsTab` e `ProductFormDialog`. O gerenciador de observações que hoje abre em janela vira uma aba.
- Taxa de serviço: `service_fee_exempt` tira o item da base de cálculo da taxa da mesa.
- Impressão: um helper `resolveItemSector(item, products, categories)` agrupa os itens. `printOrder` passa a emitir uma comanda por setor via `getPrinterForSector`. Se o setor não tiver impressora, os itens vão para a impressora de recibo, como já acontece hoje. Na fila, o host recebe um job por setor, com `payload.sector`.
- O CSV de importação perde `imagem_url` e ganha `codigo`, `custo`, `estoque_minimo` e `imprimir_em`. O modelo em `public/` será atualizado.
- `ProductCard` e os cartões do cardápio do consumidor deixam de renderizar imagens.
