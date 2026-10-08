# Impacto de remover a página PDV

## O que o PDV faz hoje (confirmado no código)

O PDV **não é só uma tela de mesas** — ele é a única entrada para três tipos de pedido:

1. **Balcão** — pedidos rápidos de balcão (pagos ou cancelados na hora).
2. **Delivery** — a página Entregas cria o pedido e redireciona para `/pdv?pedido=...` para lançar os itens (6 pontos de redirecionamento em `Entregas.tsx`).
3. **Retirada** — mesma lógica via `/pdv?tipo=retirada`.

A página **Mesas só trabalha com pedidos do tipo "mesa"** (confirmado: todos os filtros em `Mesas.tsx` exigem `orderType === 'mesa'`). Ela não cria nem edita pedidos de balcão, delivery ou retirada.

## Impacto se remover o PDV sem substituir

- **Balcão, Delivery e Retirada deixam de funcionar.** Os cartões da Home ("Balcão", "Delivery", "Retirada") e toda a página Entregas ficariam sem destino.
- A tela de Entregas perde a função "abrir pedido para adicionar itens".
- Menu lateral, botão voltar e layout têm tratamentos especiais para `/pdv` que precisariam ser limpos.

## Cenários possíveis

### Cenário A — Manter o PDV (recomendado se ainda há vendas de balcão/delivery)
Nenhuma mudança. O PDV continua sendo a porta de entrada para balcão, delivery e retirada; Mesas cuida das mesas.

### Cenário B — Remover o PDV e migrar balcão/delivery/retirada para um fluxo novo
Trabalho maior:
1. Criar fluxo de pedido rápido (balcão/delivery/retirada) dentro de Mesas ou em nova página, reaproveitando carrinho, busca de produtos, checkout e impressão.
2. Redirecionar os cartões da Home e todos os `navigate('/pdv...')` de Entregas para o novo fluxo.
3. Remover a rota `/pdv`, o item do menu lateral e os tratamentos especiais em Layout/BackButton.
4. Remover `PDV.tsx` e ajustar textos em SuperAdmin que mencionam a URL `/pdv`.

### Cenário C — Remover o PDV e abandonar balcão/delivery/retirada
Só válido se a loja realmente não usa mais esses tipos. Mesmo assim, Entregas precisaria ser removida ou reescrita, pois depende do PDV.

## Recomendação

Antes de remover, confirmar: **a loja ainda faz vendas de balcão, delivery ou retirada?** Se sim, o Cenário B é o caminho — mas é uma refatoração relevante, não uma simples exclusão. Se a operação é 100% mesas, o Cenário C se aplica, com a remoção/adaptação da tela de Entregas incluída.

## Detalhes técnicos

- Arquivos afetados: `src/pages/PDV.tsx`, `src/App.tsx` (rota), `src/components/AppSidebar.tsx` (menu), `src/components/Layout.tsx` e `BackButton.tsx` (tratamentos especiais), `src/pages/Home.tsx` (3 cartões), `src/pages/Entregas.tsx` (6 redirecionamentos), `src/pages/SuperAdmin.tsx` (textos de URL).
- `CheckoutModal.tsx` e a lógica de impressão são compartilhados e **não** seriam removidos — Mesas também os usa.
