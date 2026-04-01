

## Contabilização correta de pagamentos divididos no Caixa

### Problema

Quando uma venda é paga com duas formas (ex: R$15 Dinheiro + R$12 PIX), o sistema grava apenas **uma** linha na tabela `sales` com o método de pagamento principal (`paymentMethod`). O caixa então atribui o total inteiro da venda a esse único método, ignorando a divisão real.

### Solução

Gravar o campo `payment_splits` na tabela `sales` e usar esses dados no cálculo do caixa.

### Mudanças

**1. Migration SQL — adicionar coluna `payment_splits` à tabela `sales`**
- `ALTER TABLE sales ADD COLUMN payment_splits jsonb DEFAULT NULL`
- Quando `payment_splits` é `NULL`, o comportamento legado (usar `payment_method` + `total`) é mantido

**2. `src/types/index.ts` — atualizar tipo `Sale`**
- Adicionar campo opcional `paymentSplits?: PaymentSplit[]`

**3. `src/contexts/StoreContext.tsx` — gravar splits na venda**
- Na função `completeSale`, incluir `payment_splits: order.paymentSplits` no insert do `sales`
- Atualizar o mapper `dbToSale` para ler `payment_splits`

**4. `src/pages/Caixa.tsx` — calcular totais usando splits**
- Tanto em `liveTotals` quanto em `handleClose`, ao iterar as vendas:
  - Se a venda tem `paymentSplits` com itens, distribuir cada split no método correto
  - Se não tem splits (vendas legadas), usar `paymentMethod` + `total` como fallback

### Exemplo do cálculo corrigido

```text
Venda: R$ 27,00 (splits: [{dinheiro, 15}, {pix, 12}])

Antes: totalCash += 27  (errado)
Depois: totalCash += 15, totalPix += 12  (correto)
```

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar coluna `payment_splits` em `sales` |
| `src/types/index.ts` | Adicionar `paymentSplits` ao tipo `Sale` |
| `src/contexts/StoreContext.tsx` | Gravar splits no insert + atualizar mapper |
| `src/pages/Caixa.tsx` | Usar splits no cálculo de totais |

