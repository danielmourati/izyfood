# Limite de sabores por categoria (como no Menuzin)

## O que muda para o admin
Na janela **Editar Categoria** (Produtos), abaixo de "Setor de Impressão Padrão", entra um bloco novo:
- **Obrigatório** (chave): exige que o atendente escolha sabores.
- **Mínimo** e **Máximo**: quantos sabores podem ser escolhidos em cada item da categoria (ex.: Pastéis Doces (3 Sabores) → mínimo 3, máximo 3).
- Deixar vazio = sem limite (como hoje). Mínimo nunca maior que o máximo; aviso inline, sem toasts.

## O que muda para o atendente
Ao montar um item de uma categoria limitada:
- O título dos sabores mostra a regra: "Sabores — escolha 3" ou "escolha de 1 a 3".
- Contador "2 de 3" ao lado.
- Ao chegar no máximo, os demais sabores ficam desabilitados (dá para desmarcar e trocar).
- O botão de adicionar só libera quando o mínimo for atingido (se obrigatório), com aviso explicando o que falta.
- Adicionais não contam no limite. Opções "Ambos" contam só quando escolhidas como sabor.
- Itens já lançados não mudam se o limite for alterado depois.

## Detalhes técnicos
- Migração: colunas em `categories` — `flavor_required boolean default false`, `flavor_min int null`, `flavor_max int null`, com CHECK (min ≥ 0, max ≥ 1, min ≤ max). Sem mudança de RLS (tabela já isolada por tenant).
- `src/types/index.ts` e mapeamento em `StoreContext.tsx` (leitura/gravação da categoria).
- `Produtos.tsx`: campos no modal de categoria.
- `ConsumerItemCustomizeModal.tsx` e `ItemNotesModal.tsx`: aplicar a regra usando um helper puro `getFlavorLimitState(category, selected)` em `src/lib/` (retorna rótulo, se pode adicionar mais, se pode confirmar).
- Testes do helper: máximo 3 bloqueia o 4º; mínimo 3 obrigatório bloqueia confirmar com 2; sem limite libera tudo; "Ambos" como adicional não conta.
- Opcional depois: preencher Pastelão Junin com os limites do Menuzin (categorias "(2 Sabores)", "(3 Sabores)") — só se você pedir.
