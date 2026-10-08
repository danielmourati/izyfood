# Comanda da cozinha: identificação por mesa e fonte dupla

## Alterações
- Nas comandas de mesa, substituir a linha `#ID` do cabeçalho por `MESA: 02`, usando dois dígitos.
- Nas comandas de balcão, retirada e delivery, remover completamente a linha com o código do pedido.
- Manter sempre em fonte dupla o cabeçalho, os produtos e seus adicionais, independentemente da configuração individual da impressora.
- Manter data, cliente, tipo, quantidade total e atendente em fonte normal para preservar espaço e legibilidade.
- Aplicar o mesmo conteúdo e hierarquia tanto na impressão térmica direta quanto na impressão alternativa pelo navegador.

## Validação
- Adicionar testes para comanda de mesa com `MESA: 02` e sem `#ID`.
- Adicionar testes garantindo que balcão, retirada e delivery não exibam o código do pedido.
- Verificar nos bytes ESC/POS que cabeçalho, itens e adicionais ativam fonte dupla e retornam ao tamanho normal antes dos dados auxiliares.
- Executar os testes de impressão, a verificação de tipos e conferir o estado final da aplicação.

## Detalhes técnicos
- A mudança será concentrada nos geradores compartilhados da comanda em `escpos.ts` e `use-printer.ts`.
- A regra passa a ser própria da comanda de produção; a opção antiga de fonte dupla da impressora não controlará mais produtos e adicionais desse cupom.
- Contas, recibos e fechamento de caixa não serão alterados.
