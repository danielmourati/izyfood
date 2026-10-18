# Busca de produtos na tela Produtos

## Problema
A caixa de busca fica espremida pelos botões de categoria e quase some (só aparece a lupa).

## O que muda
- A busca ganha linha própria com largura total (até ~28rem no desktop), sempre visível; categorias ficam na linha de baixo com rolagem horizontal.
- Busca dinâmica a cada letra digitada: procura por nome, código e descrição, ignorando acentos e maiúsculas, em todas as categorias quando houver texto (a categoria selecionada continua valendo se o usuário escolher uma).
- Botão "x" para limpar a busca; contador de produtos reflete o resultado.
- Mensagem "Nenhum produto encontrado para 'texto'" quando vazio.

## Detalhes técnicos
- `src/pages/Produtos.tsx`: trocar o container de filtros para `flex-col` (input `w-full sm:max-w-md shrink-0`), adicionar função `normalize` (NFD sem diacríticos) e `useMemo` para `filtered` incluindo `description`.
