# Lanchonete Fic&Tícia: cardápio mostrando itens de todas as lojas

## O que foi encontrado
- No banco, a Lanchonete Fic&Tícia tem apenas **2 categorias, 3 produtos e 3 adicionais**, sem repetições.
- Os números do print (74 categorias e 813 produtos) são exatamente a **soma de todas as 7 lojas** (Pastelão Junin 27/352, Pastelão Sousa 12/178, Los Hermanos 12/93, Zezinho 8/91, Quintal de Casa 8/51, Vila Boemia 5/45, Fic&Tícia 2/3).
- Ou seja, não há itens redundantes: a conta usada (provavelmente Super Admin) está vendo o cardápio das outras lojas dentro da Fic&Tícia.

## Importante
Apagar esses itens **apagaria o cardápio das outras lojas**. Nada será removido.

## Correção proposta
1. Confirmar com qual conta o print foi tirado e por que ela enxerga as outras lojas.
2. Fazer o carregamento de categorias, produtos, adicionais e observações filtrar sempre pela loja aberta, inclusive para o Super Admin.
3. Conferir que a Fic&Tícia passa a mostrar 2 categorias e 3 produtos, e que as outras lojas continuam com seus cardápios.
4. Se você ainda quiser limpar os itens de exemplo da Fic&Tícia (Pizzas, Bacon Extra), fazer isso só depois, com sua confirmação.

## Detalhes técnicos
- Adicionar `.eq('tenant_id', user.tenantId)` nas leituras de catálogo em `StoreContext.tsx` (as regras de acesso do Super Admin liberam todas as lojas).
- Revisar também as atualizações ao vivo de catálogo para ignorar eventos de outras lojas.
