# Balcão no mesmo fluxo das Mesas

## Objetivo
Remover o PDV antigo e lançar pedidos de Balcão com a mesma janela usada nas Mesas. O pedido de balcão é aberto, recebe itens, é pago e finalizado na mesma sessão — o Balcão fica livre logo em seguida, sem ocupar nada com pedidos rápidos.

## O que muda para o usuário
- Na Home fica apenas o cartão **Balcão** (Delivery e Retirada saem da Home).
- Ao tocar em Balcão, abre a mesma janela de pedido das Mesas (busca de produtos, adicionais, carrinho, impressão da comanda).
- O rodapé mostra **Cobrar / Finalizar** em vez de Bloquear: abre o pagamento (múltiplas formas), e ao concluir o pedido é finalizado, registrado no caixa e a janela fecha, deixando o Balcão livre.
- Fechar a janela sem pagar: se não houver itens, o pedido é apagado; se houver itens, pergunta "Descartar pedido?" (cancelar exige permissão, como hoje). Balcão nunca fica "segurado".
- Caixa fechado: botão mostra "CAIXA FECHADO" e não permite finalizar (regra já existente).
- Menu lateral: item "PDV" removido; a rota antiga `/pdv` passa a redirecionar para a Home.

## Fora do escopo / assumido
- Delivery e Retirada deixam de ser criados (conforme "manter somente caixa/balcão"). A página Entregas continua acessível só para consultar pedidos antigos, com os botões que levavam ao PDV removidos. Se preferir apagar Entregas também, avise.
- Mesas, contas, impressão e fechamento de caixa não mudam.

## Detalhes técnicos
- `ConsumerOrderModal`: aceitar modo `orderType: 'balcao'` (sem número de mesa; título "Balcão"); no modo balcão trocar bloquear/reabrir por botão Cobrar que abre `CheckoutModal`; `onComplete` → `completeSale` + fechar modal.
- Novo hook/handler em `Home.tsx` (ou componente `BalcaoLauncher`) que cria o pedido `balcao` via StoreContext e abre o modal; ao cancelar/fechar vazio, hard-delete (regra R$ 0,00).
- Comanda da cozinha de balcão segue sem #ID e sem linha de mesa (já implementado).
- Remover `src/pages/PDV.tsx`, rota em `App.tsx` (substituir por `<Navigate>` preservando slug), item em `AppSidebar.tsx`, tratamentos `/pdv` em `Layout.tsx` e `BackButton.tsx`, textos de URL em `SuperAdmin.tsx`; remover os 6 `navigate('/pdv...')` de `Entregas.tsx`.
- Antes de apagar `PDV.tsx`, conferir se exporta algo usado em outro lugar; mover o que for compartilhado.
- Atualizar `AGENTS.md` (regra: Balcão usa o modal de pedido das Mesas, finalizado na mesma sessão) e `roadmap.md`.
- Validar com tsgo, testes existentes e Playwright (abrir Balcão, lançar item, pagar, confirmar que o pedido some e o caixa soma).
