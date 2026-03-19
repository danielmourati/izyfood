

## Produto elegível para pontuação de fidelidade

### Problema atual
A elegibilidade para pontos de fidelidade está hardcoded: só produtos da categoria "Açaí" com peso >= 300g pontuam. Não há como marcar outros produtos como elegíveis.

### Solução

Adicionar um campo `loyalty_eligible` (boolean) na tabela `products` e no tipo `Product`, com um toggle no formulário de cadastro/edição de produto. A lógica de pontuação será atualizada para usar esse campo em vez de filtrar por nome de categoria.

### Mudanças

**1. Migration SQL**
- Adicionar coluna `loyalty_eligible boolean not null default false` na tabela `products`
- Atualizar produtos existentes da categoria Açaí para `loyalty_eligible = true`

**2. `src/types/index.ts`**
- Adicionar `loyaltyEligible: boolean` na interface `Product`

**3. `src/contexts/StoreContext.tsx`**
- Atualizar `dbToProduct()` para mapear `loyalty_eligible` → `loyaltyEligible`
- Atualizar `syncProducts()` para incluir `loyalty_eligible` nos inserts/updates
- Substituir a lógica de `eligibleCount` (que filtra por categoria Açaí) para usar `product.loyaltyEligible` diretamente
- Manter a regra de peso >= 0.3kg para produtos do tipo weight

**4. `src/pages/Produtos.tsx`**
- Adicionar campo `loyaltyEligible` no formulário (Switch/Checkbox)
- Exibir badge de fidelidade nos cards dos produtos elegíveis
- Incluir no `emptyProductForm` e nas funções `openEdit`/`save`

**5. `src/pages/PDV.tsx`**
- Substituir `acaiCategoryIds` + filtro por categoria por `product.loyaltyEligible`
- `isItemEligible`: checar `product.loyaltyEligible && (product.type !== 'weight' || (item.weight && item.weight >= 0.3))`

**6. `src/components/CheckoutModal.tsx`**
- Mesma atualização: usar `product.loyaltyEligible` em vez de filtro por categoria Açaí

### Regra de negócio atualizada
- Produto por **peso**: pontua se `loyaltyEligible === true` E peso >= 300g
- Produto por **unidade**: pontua se `loyaltyEligible === true` (cada unidade = 1 ponto)

