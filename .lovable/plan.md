# Não bloquear pedido quando não há sabores para escolher

## Problema
No item "Desejo (Grande)", a janela mostra só **Adicionais**, sem nenhum sabor cadastrado para escolher, mas exibe "Escolha mais 2 sabores." e trava o botão **OK**. O atendente não consegue seguir.

## Regra nova
- O mínimo de sabores só vale quando **as duas condições** forem verdadeiras:
  1. O produto ou a categoria está marcado como **Obrigatório** (com mínimo definido), e
  2. Existem sabores ativos cadastrados e disponíveis para aquele produto.
- Sem exigência configurada → nunca bloqueia.
- Exigência configurada, mas nenhum sabor disponível → não bloqueia e não mostra a mensagem vermelha.
- O limite máximo continua valendo normalmente quando há sabores.

## Onde se aplica
- Janela de personalizar item (mobile e desktop) e janela de observações do item, ambas usam a mesma regra.

## Detalhes técnicos
- `getFlavorLimitState` recebe a quantidade de opções de sabor disponíveis (classificação `flavor` ou `both`, ativas, da categoria do produto); se for 0, `min = 0`, `canConfirm = true`, `missingMessage = ''`.
- `min > 0` apenas com `flavorRequired === true`; valores de `flavorMin` sem obrigatório não bloqueiam.
- Atualizar os chamadores em `ItemNotesModal.tsx` e no modal de personalização para passar essa contagem.
- Novos testes em `flavor-limits`: obrigatório sem sabores disponíveis libera; sem obrigatório libera; obrigatório com sabores ainda exige o mínimo.
