# Atendente obrigatório nas comandas e contas

## Objetivo
Garantir que o nome do atendente que abriu o pedido apareça sempre na comanda da cozinha e na conta, inclusive após trocar de aparelho, recarregar a página ou enviar a impressão para o caixa.

## Alterações
1. **Vincular o atendente ao abrir o pedido**
   - Registrar no pedido o identificador e o nome do usuário que abriu a mesa ou o balcão.
   - Manter esse atendente original durante toda a vida do pedido, sem substituí-lo por quem editar, cobrar ou imprimir depois.
   - Persistir essa informação no banco para sincronização entre dispositivos.

2. **Impressão obrigatória**
   - Incluir `Atendente: Nome` no cabeçalho da comanda da cozinha.
   - Incluir `Atendente: Nome` no cabeçalho da conta.
   - Aplicar a mesma regra na impressão térmica, na impressão pelo navegador, na prévia e nos trabalhos enviados ao caixa.

3. **Pedidos já existentes**
   - Para pedidos criados antes da mudança, aproveitar o nome de quem lançou o primeiro item quando essa informação existir.
   - Se um pedido antigo não possuir nenhuma autoria recuperável, identificar o atendente no próximo salvamento com o usuário que estiver operando o pedido, evitando cupons sem nome.

## Validação
- Testar que a comanda e a conta exibem o mesmo atendente que abriu o pedido.
- Testar que outro usuário pode editar ou imprimir sem alterar o atendente original.
- Testar impressão local, fila do caixa e prévias.
- Validar pedidos novos e pedidos antigos sem os novos campos.

## Detalhes técnicos
- Adicionar campos opcionais de autoria inicial em `orders`, de forma compatível com pedidos existentes e mantendo as regras atuais de isolamento por loja.
- Mapear os campos no tipo `Order` e nos conversores de leitura/gravação do estado compartilhado.
- Centralizar a resolução do nome do atendente antes dos geradores ESC/POS e HTML, evitando divergência entre comanda e conta.
