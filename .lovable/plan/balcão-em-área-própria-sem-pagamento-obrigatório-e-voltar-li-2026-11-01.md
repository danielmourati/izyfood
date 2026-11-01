# Balcão em área própria, sem pagamento obrigatório, e Voltar liberado

## 1. Pedidos do balcão em área separada (tela Mesas)
- Na tela **Mesas e Comandas**, nova seção **"PEDIDOS DO BALCÃO (n)"** acima de "Pedidos em andamento", com cards em **lilás/azul-violeta**, separados dos cards verdes das mesas.
- Cada card mostra: "Balcão #0b00" (código curto), atendente, tempo aberto, cliente/observação (desktop) e valor.
- Clicar no card abre o mesmo pedido do balcão para continuar, imprimir ou pagar.
- A seção só aparece quando há pedidos de balcão em aberto. Vale para desktop e celular.

## 2. Pagamento do balcão deixa de ser obrigatório
- Ao fechar (X, Esc ou Voltar) um pedido de balcão com itens, ele **fica salvo em aberto** em vez de perguntar "Descartar este pedido do balcão?".
- Mesmo comportamento das mesas: se houver itens não impressos, aparece o aviso "Imprimir todos / Ignorar impressão / Permanecer".
- Descartar continua possível pelo "Mais Opções > Excluir Pedido" (com permissão). Pedido sem itens continua sendo apagado.
- A tela Balcão passa a abrir sempre um pedido novo; pedidos anteriores são retomados pela seção do item 1.

## 3. Voltar da tela de categorias não fica mais bloqueado
- No celular, após Revisar → Voltar → categorias, o botão **VOLTAR** passa a levar direto para a tela de Mesas (ou de onde o pedido foi aberto), salvando os itens do pedido.
- Itens novos não impressos: o aviso de impressão continua aparecendo, mas "Ignorar impressão" sempre permite sair; nada trava o botão.

## Detalhes técnicos
- `Mesas.tsx`: filtrar `orders` com `orderType === 'balcao'` e status aberto/segurado; novos tokens de cor (`--balcao`, `--balcao-foreground`) em `index.css`; abrir `ConsumerOrderModal` com o pedido existente.
- `ConsumerOrderModal.tsx` `handleCloseAndSaveOrDiscard`: remover o ramo `isBalcao` com `window.confirm`; balcão segue o caminho de salvar e usar o alerta de não impressos. Revisar as condições que deixam o VOLTAR das categorias sem efeito (alerta/estado `mobileStep`) para garantir saída após "Ignorar".
- `Balcao.tsx`: `handleSave` mantém o pedido em aberto; `onClose` volta para Mesas.
- Permitir status `segurado`/aberto para balcão (remover bloqueio "Balcão não pode ser segurado" onde existir).
- Atualizar memória e AGENTS.md: a regra "balcão pago ou descartado na mesma sessão" deixa de valer.
- Teste: pedido de balcão com itens ao fechar fica salvo (não apagado).
