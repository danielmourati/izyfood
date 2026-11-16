# ESC fecha uma janela por vez, da mais recente para a mais antiga

## O que muda para o usuário
- Cada toque em ESC fecha apenas a janela que está na frente (a última aberta).
- Ex.: Pedido do balcão > Montar Pizzas: 1º ESC fecha "Montar Pizzas"; 2º ESC volta a fechar o pedido (com o aviso de itens não impressos, se houver).
- Vale para todas as janelas: pedido da mesa/balcão, personalizar item, montar pizzas, busca de produtos, cliente, pagamento (e suas sub-telas de desconto/taxa/forma de pagamento), Mais Opções, trocar/transferir mesa, reimpressão, confirmações e janelas das configurações.
- ESC com um campo de texto aberto em lista (ex.: seleção) fecha só a lista, não a janela.

## Problema atual
Várias janelas escutam ESC ao mesmo tempo (as janelas padrão do app e escutas próprias no pedido, pagamento, personalizar item e busca). Um único ESC pode fechar duas camadas ou fechar a de trás primeiro, dependendo da ordem em que as escutas foram registradas.

## Detalhes técnicos
1. Criar `src/lib/escape-stack.ts`: pilha global de camadas com um único listener `keydown` em captura no `window`. `useEscapeLayer(open, onEscape)` empilha ao abrir e desempilha ao fechar; ESC chama só o topo, com `preventDefault`/`stopImmediatePropagation`.
2. `src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `drawer.tsx`: registrar cada conteúdo aberto na pilha e bloquear o ESC nativo do Radix (`onEscapeKeyDown` -> `preventDefault`), deixando a pilha decidir; o topo dispara o `onOpenChange(false)` do próprio diálogo.
3. Remover as escutas manuais de ESC em `ConsumerOrderModal.tsx` (a cadeia de `if`), `CheckoutModal.tsx` (as duas), `ConsumerItemCustomizeModal.tsx` e `ConsumerProductFinderModal.tsx`, trocando por `useEscapeLayer` com a ação de fechar de cada um (o pedido mantém `handleCloseAndSaveOrDiscard`; sub-telas do pagamento viram camadas próprias).
4. Popovers/selects abertos (Radix) continuam consumindo ESC antes, por estarem na frente.
5. Testes `src/test/escape-stack.test.tsx`: três camadas abertas -> três ESC fecham na ordem inversa, um por vez; camada fechada sai da pilha; ESC sem camadas não faz nada.
6. Registrar a regra em `AGENTS.md`.
