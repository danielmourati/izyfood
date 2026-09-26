# Máscara BRL nos campos de valor

## Objetivo
Padronizar todos os campos que representam dinheiro para exibir `R$` e aceitar valores no formato brasileiro, como `R$ 3,00`, sem alterar campos de quantidade, peso ou porcentagem.

## Implementação
- Criar um campo monetário reutilizável com máscara BRL durante a digitação, teclado numérico no celular e conversão segura entre texto e número.
- Aplicar o campo em preços de venda e custo, preço de complementos, fundo e movimentações de caixa, taxa de entrega, pagamentos, troco, descontos em valor fixo, pedido mínimo e limites monetários.
- Manter campos percentuais sem `R$` e preservar os valores numéricos enviados ao banco.
- Ao editar dados antigos, apresentar imediatamente o valor em BRL com duas casas decimais.

## Validação
- Conferir criação e edição de produto e complemento com valores como `R$ 3,00` e `R$ 1.234,56`.
- Conferir caixa, entrega e pagamento, inclusive cálculo de troco e descontos.
- Executar a verificação de tipos e revisar a tela em desktop e celular.
