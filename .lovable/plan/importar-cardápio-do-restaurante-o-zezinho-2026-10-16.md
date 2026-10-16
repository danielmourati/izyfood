# Importar cardápio do Restaurante O Zezinho

A loja está vazia hoje: não tem categorias, produtos nem adicionais. O arquivo tem 91 itens em 8 categorias.

## Como os dados entram
1. **Categorias** (na ordem do arquivo): Refeições, Tira Gosto, Porções, Bebidas Geladas, Bebidas Quentes, Cerveja 600ml, Cerveja Long Neck e Drinkis (o nome fica como está no arquivo).
2. **Produtos**: nome, descrição e preço (por exemplo, "232,00" vira R$ 232,00). Venda por unidade, sem controle de estoque e sem foto.
3. **Impressão**: bebidas, cervejas e drinks saem no Caixa (recibo). Refeições, tira-gostos e porções saem na Cozinha.
4. **Conferência**: comparar as quantidades importadas com o arquivo.

Todas as colunas (Categoria, Item, Descrição, Preço) já têm lugar no sistema. O arquivo não traz adicionais.

## Detalhes técnicos
- Tenant `557f7d21-b55c-4c1f-bab7-960d75ef1677`. INSERT em `categories` e `products` gerados por script a partir do CSV (remover o BOM do arquivo, converter o preço de vírgula para ponto).
- As categorias de bebidas recebem o `print_sector` do recibo, igual ao Pastelão Junin. As demais ficam com null (cozinha).
