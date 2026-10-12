# Importar cardápio do Pastelão Junin

A loja Pastelão Junin está vazia hoje: não tem categorias, produtos nem adicionais. O arquivo tem 348 linhas em 24 categorias.

## Como os dados entram
1. **Categorias**: as 24 do arquivo, com os mesmos nomes e na mesma ordem. A categoria "Adicionais" não vira categoria de produto.
2. **Produtos, um por tamanho**: o nome recebe o tamanho no fim, por exemplo "Calabresa (Pequeno)" a R$ 11,00 e "Calabresa (Grande)" a R$ 15,00. O mesmo vale para "Sem Borda" e "Com Borda" nos crepes. Quando o tamanho é "Único", o nome fica sem complemento.
   - A descrição/ingredientes vai para o campo de descrição.
   - Venda por unidade, sem controle de estoque e sem foto. A impressora segue o padrão da categoria: bebidas vão para o Caixa (recibo) e o resto para a Cozinha.
3. **Sabores do "Monte seu"**: os sabores de cada linha viram opções do tipo **Sabor** (grátis) nas categorias "Monte seu" correspondentes:
   - os sabores de Pastéis Simples aparecem em Pastéis Simples (Monte seu);
   - os de Premium em Premium (Monte seu);
   - os de Frutos do Mar em Frutos do Mar (Monte seu).
   - O atendente marca os sabores no pedido. Não existe limite automático de 2, 3 ou 4 sabores: quem confere a quantidade é o atendente.
4. **Adicionais**: os 12 grátis e a Azeitona (R$ 1,00) entram como Adicionais em todas as categorias de pastéis, especiais e crepes. Bebidas ficam de fora. A opção "Todos os adicionais" é criada no topo.
5. **Conferência**: comparar as quantidades importadas com o arquivo e listar os produtos de algumas categorias.

## Colunas do arquivo
Todas as colunas têm lugar no sistema: Categoria, Produto, Descrição, Tamanho (vai no nome) e Preço. Nenhuma coluna nova é necessária.

## Detalhes técnicos
- Tenant `6dbd514e-cb38-45df-bb84-49057ff27ec1`. Os dados entram por INSERT em `categories`, `products` e `product_note_options` (type `complement`, `classification` `flavor`/`additional`, `category_ids` jsonb), gerados por um script a partir do CSV. Os preços são convertidos de "11,00" para 11.00.
- As categorias de bebidas recebem `print_sector` do recibo e as demais ficam com null (cozinha).
- Antes de rodar, confirmar o formato de "Todos os adicionais" usado no Pastelão Sousa.
