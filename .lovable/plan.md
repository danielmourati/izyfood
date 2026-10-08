# Destacar tipo do pedido e adicionar fonte dupla e segunda via

## Objetivo

Tornar a comanda de produção mais fácil de identificar e ler, sem alterar a conta do cliente ou outros documentos.

- O título principal passa a representar o tipo do pedido:
  - **Mesa → CONSUMO**
  - **Retirada → RETIRADA**
  - **Delivery → DELIVERY**
  - **Balcão → COZINHA**
- O número do pedido ganha mais destaque logo abaixo do título.
- Cada impressora poderá ativar, em **Opções avançadas**, fonte dupla e segunda via para pedidos novos.
- As duas opções ficam **desativadas por padrão**.

## Alterações

1. **Novo cabeçalho da comanda**
   - Substituir o título fixo “COZINHA” pelo título correspondente ao tipo do pedido.
   - Exibir o número do pedido em linha própria, centralizado e maior.
   - Manter mesa, cliente, data e atendente como informações de apoio, sem competir com o título.
   - Padronizar o mesmo número e a mesma identificação nas impressões térmica e pelo navegador.

2. **Opção “Fonte dupla”**
   - Adicionar uma chave em **Impressora > Opções avançadas**.
   - Quando ativada, ampliar título, número do pedido, produtos e adicionais.
   - Recalcular as quebras de linha conforme 58mm ou 80mm para evitar texto cortado ou desalinhado.
   - Informações secundárias continuam no tamanho normal para preservar espaço.

3. **Opção “Imprimir pedidos novos em duas vias”**
   - Adicionar uma segunda chave em **Opções avançadas**.
   - Quando ativada, pedidos recém-enviados imprimem duas vias consecutivas na impressora configurada para o setor.
   - Reimpressões manuais, conta, teste e fechamento de caixa continuam com uma via.
   - Aplicar a mesma regra tanto na impressão direta quanto nos pedidos enviados ao aparelho Caixa.

4. **Persistência por impressora**
   - Salvar as duas preferências na configuração de cada impressora/setor, com valor inicial desligado.
   - Carregar os valores ao alternar entre Cozinha, Bar, Balcão, Recibo ou setores personalizados.
   - Manter o isolamento entre estabelecimentos existente.

5. **Identificação de impressão nova e reimpressão**
   - Marcar explicitamente os envios originados por pedido novo.
   - Marcar reimpressões separadamente, impedindo que a opção de duas vias seja aplicada por engano.
   - Preservar essa identificação quando a impressão passar pela fila do Caixa.

## Detalhes técnicos

- Adicionar colunas booleanas com padrão `false` em `printer_configs` para fonte dupla e duplicação de pedidos novos.
- Estender `PrinterConfig` e o formulário de `ImpressoraTab` para ler e salvar essas preferências.
- Centralizar o título por tipo e o número do pedido para que `buildOrderReceipt` e `buildOrderHtml` não divirjam.
- No ESC/POS, aplicar modo ampliado somente aos blocos definidos e ajustar a largura útil durante a quebra de texto.
- Na impressão pelo navegador, aplicar tamanhos equivalentes no HTML.
- Fazer `printOrder` receber a intenção `new` ou `reprint`; o host da fila preserva essa intenção e respeita a configuração da impressora de destino.
- Executar duas vezes o envio físico somente quando a intenção for `new` e a opção da impressora estiver ligada.

## Verificação

- Testar Mesa, Balcão, Retirada e Delivery em 58mm e 80mm.
- Confirmar título correto, número destacado e ausência de cortes com nomes e adicionais longos.
- Confirmar fonte normal com a chave desligada e fonte ampliada com a chave ligada.
- Confirmar duas vias somente em pedidos novos, tanto localmente quanto pelo Caixa.
- Confirmar uma via em reimpressão, conta, teste e fechamento.
- Executar os testes de impressão existentes e acrescentar cobertura para títulos, fonte dupla e quantidade de vias.
