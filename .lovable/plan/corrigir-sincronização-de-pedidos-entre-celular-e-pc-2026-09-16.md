# Corrigir sincronização de pedidos entre celular e PC

## Diagnóstico confirmado

A falha principal acontece antes do WebSocket:

- A mesa é gravada corretamente com a identificação da loja, por isso permanece ocupada nos dois aparelhos.
- O pedido segue por dois caminhos de gravação, e ambos falham:
  - o sincronizador geral usa uma referência da loja que só existe dentro do componente, mas a função de gravação está fora dele; isso gera erro antes do envio;
  - o envio explícito do modal não inclui a identificação da loja e ignora o erro retornado pelo banco.
- Como o pedido não é efetivamente inserido/atualizado, não existe alteração para o canal em tempo real transmitir. A consulta automática de 2 segundos também não resolve, pois continua buscando um pedido que nunca chegou ao banco.
- As tabelas `orders` e `store_tables` estão habilitadas para tempo real e protegidas por loja. A identidade de réplica está no modo padrão, não `FULL`, contrariando a hipótese anterior; isso afeta principalmente a confiabilidade de exclusões e será ajustado.
- A implementação atual também pode abrir canais duplicados durante reconexões, usa o mesmo estado global para dois canais e mantém a consulta de 2 segundos mesmo quando o WebSocket está saudável.

## Correção

1. **Unificar e tornar confiável a gravação do pedido**
   - Passar explicitamente a identificação da loja para as funções de sincronização, sem referências fora de escopo.
   - Centralizar o `upsert` do pedido em uma única função assíncrona que sempre inclua `tenant_id`.
   - Conferir o resultado de toda gravação; erro de banco não poderá mais ser tratado como sucesso.
   - Somente ocupar/vincular a mesa depois que o pedido estiver confirmado, evitando mesa ocupada apontando para pedido inexistente.

2. **Eliminar concorrência e gravações duplicadas**
   - Fazer ações como adicionar item, enviar, fechar e editar observações usarem a mesma fila de persistência por pedido.
   - Ordenar atualizações do mesmo pedido para impedir que uma resposta antiga sobrescreva itens mais recentes.
   - Remover a segunda gravação manual do modal depois que o fluxo central estiver aguardando a confirmação.

3. **Corrigir o canal em tempo real**
   - Manter uma única assinatura ativa para pedidos e mesas por sessão/loja.
   - Filtrar eventos pela loja atual e, ao receber evento de `orders`, buscar somente pedidos e mesas.
   - Reassinar de forma controlada após queda, troca de rede ou retorno do aplicativo, removendo canais antigos antes de criar novos.
   - Separar o estado dos canais de broadcast e alterações do banco para não mostrar “conectado” quando apenas um deles estiver ativo.

4. **Banco como fonte da verdade**
   - Manter alterações locais apenas enquanto a gravação estiver realmente pendente.
   - Remover a pendência quando o banco confirmar a gravação ou quando houver erro.
   - Não preservar indefinidamente pedidos locais com itens que não existem no banco.
   - Ajustar `REPLICA IDENTITY FULL` para pedidos e mesas, preservando políticas e isolamento entre lojas.

5. **Substituir a consulta agressiva por contingência**
   - Remover a consulta fixa de 2 segundos quando o WebSocket estiver conectado.
   - Usar uma verificação mais espaçada somente quando o canal estiver desconectado.
   - Fazer recarga de segurança ao reconectar, voltar do segundo plano ou recuperar a internet.

6. **Diagnóstico sem falso positivo**
   - Mostrar separadamente: pedido salvo no banco, canal de pedidos conectado, último evento recebido e última sincronização concluída.
   - Registrar falhas de gravação com pedido, mesa e etapa, sem dados sensíveis.
   - Exibir uma mensagem persistente no próprio fluxo quando o pedido não puder ser salvo, sem usar notificações temporárias.

## Validação

- Abrir duas sessões autenticadas na mesma loja, uma em viewport móvel e outra desktop.
- No celular, abrir uma mesa, adicionar itens e enviar; confirmar no banco que o pedido contém todos os itens e o `tenant_id` correto.
- Confirmar que o PC recebe o evento e atualiza mesa, itens e total em poucos segundos, sem recarregar a página.
- Alterar quantidade, observações e itens rapidamente; confirmar que a versão mais recente vence nos dois aparelhos.
- Finalizar/liberar no PC e confirmar a atualização no celular.
- Simular segundo plano, perda de rede e reconexão; confirmar uma única assinatura e recuperação automática.
- Confirmar que lojas diferentes nunca recebem nem consultam os pedidos umas das outras.
- Executar verificação de tipos, build e teste visual/funcional nas duas sessões antes de concluir.
