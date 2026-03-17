

## Plano de Implementação: 3 Features

### Análise e Recomendação de Ordem

As 3 features são interdependentes. A ordem ideal é:

1. **Feature 2 primeiro** — Vincular cliente ao pedido no PDV (pré-requisito para as outras duas)
2. **Feature 3 em seguida** — Sistema de pontos (depende do cliente vinculado ao pedido)
3. **Feature 1 por último** — Relatório de compras por cliente (depende das vendas já terem cliente vinculado)

---

### Feature 2: Vincular Cliente ao Pedido no PDV

**O que muda:**
- No PDV (tela de venda), adicionar um campo/seletor de cliente no carrinho lateral, visível em todos os tipos de pedido (balcão, mesa, delivery, retirada)
- Botão "Novo Cliente" ao lado do seletor, que abre um mini-formulário (dialog) para cadastro rápido
- O cliente selecionado é salvo no `Order` (campos `customerId` e `customerName` já existem no tipo)
- No checkout, o cliente já virá pré-selecionado

**Arquivos afetados:**
- `src/pages/PDV.tsx` — adicionar seletor de cliente + botão novo cadastro no painel do carrinho
- `src/components/CheckoutModal.tsx` — receber o `customerId` pré-selecionado do PDV

---

### Feature 3: Sistema de Pontuação (Fidelidade Açaí)

**Regras de negócio:**
- Cada compra de açaí com peso ≥ 300g (0.3 kg) acumula 1 ponto por item elegível
- Ao atingir 10 pontos, alerta visual no carrinho informando direito a 1 açaí 300g grátis
- Pontos são intransferíveis e cumulativos (cliente pode optar por não resgatar)
- Pontos acumulam além de 10 (múltiplos de 10 = múltiplos resgates disponíveis)

**O que muda:**
- `src/types/index.ts` — adicionar `loyaltyPoints: number` ao tipo `Customer`
- `src/contexts/StoreContext.tsx` — na função `completeSale`, calcular pontos elegíveis (itens da categoria "Açaí" com peso ≥ 0.3) e incrementar no cliente
- `src/pages/PDV.tsx` — no carrinho, quando houver itens de açaí ≥ 300g E um cliente selecionado com pontos ≥ 10, exibir badge/alerta visual destacado (ex: banner verde com ícone de estrela)
- `src/components/CheckoutModal.tsx` — exibir pontos atuais do cliente e opção de resgatar (aplicar desconto do valor de 1 açaí 300g)

**Arquivos afetados:**
- `src/types/index.ts`
- `src/data/seed.ts` — adicionar `loyaltyPoints: 0` aos clientes seed
- `src/contexts/StoreContext.tsx`
- `src/pages/PDV.tsx`
- `src/components/CheckoutModal.tsx`

---

### Feature 1: Relatório de Compras por Cliente

**O que muda:**
- Nova aba/seção na página de Relatórios com tabela mostrando: nome do cliente, total de compras, total gasto, e lista de produtos comprados (com quantidades)
- Ao clicar no cliente, expandir detalhes com histórico de itens
- Filtro de data já existente será reaproveitado

**Arquivos afetados:**
- `src/pages/Relatorios.tsx` — adicionar aba "Por Cliente" com tabela e detalhamento

---

### Resumo de Impacto

| Arquivo | F1 | F2 | F3 |
|---|---|---|---|
| `types/index.ts` | | | ✓ |
| `data/seed.ts` | | | ✓ |
| `StoreContext.tsx` | | | ✓ |
| `PDV.tsx` | | ✓ | ✓ |
| `CheckoutModal.tsx` | | ✓ | ✓ |
| `Relatorios.tsx` | ✓ | | |

Total: 6 arquivos modificados, nenhum arquivo novo necessário.

