## Plano: Reduzir cards de produtos e aumentar densidade do grid

### Objetivo
Diminuir o tamanho dos cards de produtos em aproximadamente 50%, manter o formato quadrado e reorganizar o grid da PDV para exibir 5–6 colunas no desktop e mais colunas no mobile/tablet, sem perder legibilidade de preço/nome.

### O que será alterado

1. **ProductCard.tsx**
   - Trocar a área de imagem de `aspect-[4/3]` para `aspect-square`.
   - Reduzir padding interno (`p-2.5` → `p-2` ou `p-1.5`).
   - Reduzir tamanhos de texto: nome (`text-[13px]` → `text-[11px]`), preço (`text-[14px]` → `text-[12px]`), botão (`text-[12px]` → `text-[10px]`).
   - Diminuir altura do botão (`py-1.5` → `py-1`).
   - Ajustar badge "Esgotando" para não invadir o card menor.
   - Manter imagem com `object-cover` e fallback com letra da categoria.

2. **PDV.tsx — grid desktop**
   - Alterar `grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-5` para algo como:
     - `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3`.
   - Reduzir gaps para `gap-3` ou `gap-2.5`.

3. **PDV.tsx — grid mobile**
   - Ajustar `grid grid-cols-2 gap-4` para `grid-cols-3 gap-3` (ou `grid-cols-2 gap-3` se a tela for muito estreita), aproveitando o card menor.

4. **Categoria mobile (grid de categorias)**
   - Aproveitar para aumentar de `grid-cols-2` para `grid-cols-3` ou `grid-cols-4`, já que os cards de produto ficarão menores e a densidade visual deve ser consistente.

5. **Testes visuais**
   - Verificar no preview desktop se 5–6 colunas cabem sem quebra de texto excessiva.
   - Verificar no mobile se 3 colunas de produtos permanecem legíveis.

### Fora do escopo
- Não alterar funcionalidade de adicionar ao carrinho, estoque, peso, complementos ou observações.
- Não alterar cores da paleta.
- Não alterar banco de dados.
