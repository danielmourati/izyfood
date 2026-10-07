# Pagamentos divididos no fechamento da conta

## Objetivo
Permitir que o atendente quite uma única conta com várias formas de pagamento, por exemplo R$ 30,00 em Dinheiro e o restante em PIX, tanto no celular quanto no computador.

## Situação confirmada
- O fechamento já mantém uma lista de pagamentos, calcula **Total pago** e **Falta pagar**, e só conclui quando a conta está totalmente quitada.
- Vendas e pedidos já possuem `payment_splits`; o fechamento do caixa já soma cada parcela separadamente em Dinheiro, PIX, Cartão e Fiado.
- No computador já existem telas para informar valores parciais. No celular, os atalhos adicionam automaticamente todo o saldo restante, impedindo a divisão prática da conta.
- PIX também usa automaticamente todo o saldo restante; será ajustado para aceitar um valor parcial informado pelo atendente.

## Implementação
1. **Unificar a inclusão de pagamentos**
   - Cada forma abrirá uma etapa para informar o valor, preenchida inicialmente com o saldo restante.
   - Permitir múltiplos lançamentos da mesma forma ou de formas diferentes.
   - Manter detalhes de cartão, cliente obrigatório no Fiado e cálculo de troco no Dinheiro.

2. **Corrigir o fluxo mobile**
   - Os botões Dinheiro, PIX, Débito, Crédito, Vale Alimentação e Vale Refeição abrirão a respectiva etapa de valor, em vez de lançar o restante imediatamente.
   - Exibir cada parcela já recebida com forma, subtipo quando aplicável, valor e ação para remover.
   - O botão inferior concluirá a venda somente quando não houver saldo pendente; antes disso, permanecerá claramente como pagamento incompleto.

3. **Validações financeiras**
   - Aceitar apenas valores positivos e limitar cada nova parcela ao saldo restante, evitando pagamento excedente e diferenças de arredondamento.
   - Recalcular imediatamente total pago e saldo ao adicionar ou remover uma parcela.
   - Exigir cliente quando qualquer parte for Fiado.
   - Impedir duplo clique durante a finalização.

4. **Registro, caixa e comprovantes**
   - Preservar todas as parcelas no pedido e na venda.
   - Confirmar que o fechamento do caixa distribui cada valor na forma correta.
   - Confirmar que conta, prévia e impressão listam as formas e valores individualmente.

## Validação
- Testar combinações Dinheiro + PIX, PIX + Crédito e Dinheiro + Fiado.
- Testar remoção e nova inclusão de parcela, valor acima do saldo e tentativa de finalizar com saldo pendente.
- Validar em celular e computador.
- Executar testes automatizados, verificação de tipos e confirmar o build sem erros.

## Detalhes técnicos
A estrutura atual `PaymentSplit[]` e os campos JSON já existentes serão reutilizados; não será necessária alteração na estrutura do banco de dados. Os subtipos de cartão continuarão registrados nos detalhes da parcela, enquanto a consolidação do caixa permanecerá em Cartão.
