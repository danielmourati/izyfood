# Atendentes cadastrados e autoria da mesa

## Objetivo
Substituir os nomes fixos pela equipe cadastrada na loja, mostrar corretamente quem abriu a mesa/pedido e permitir que somente administradores alterem essa responsabilidade.

## Alterações
1. **Lista real da equipe**
   - Carregar os usuários vinculados à loja atual.
   - Exibir apenas usuários com função **Administrador** ou **Atendente**.
   - Mostrar os nomes cadastrados nos perfis, sem opções fixas como Daniel, Edvaldo, Atendente 1 ou Caixa.

2. **Criado por**
   - Exibir em `Criado por:` o nome salvo como responsável pela abertura do pedido.
   - Manter esse nome ao fechar, reabrir, imprimir ou acessar o pedido por outro dispositivo.
   - Em pedidos antigos sem responsável salvo, usar primeiro a autoria do item mais antigo e, se ela não existir, identificar o usuário atual no próximo salvamento.

3. **Alteração pelo administrador**
   - Para administradores, manter um seletor com os administradores e atendentes cadastrados.
   - Ao selecionar outra pessoa, atualizar no pedido o identificador e o nome do novo responsável e salvar imediatamente.
   - Para atendentes, exibir o responsável sem permitir alteração.
   - A comanda da cozinha e a conta passam a usar automaticamente o responsável atualizado.

4. **Estados e falhas**
   - Exibir carregamento enquanto a equipe é consultada.
   - Se o responsável atual não estiver mais ativo na lista, preservar seu nome no pedido sem permitir que a referência desapareça.
   - Mostrar uma mensagem na própria janela se a alteração não puder ser salva.

## Validação
- Conferir a lista com contas reais de Administrador e Atendente da mesma loja, sem Motoboy ou Superadmin.
- Validar que `Criado por:` permanece igual ao usuário que abriu a mesa após recarregar e em outro dispositivo.
- Validar que administrador consegue trocar o responsável e atendente não consegue.
- Confirmar o novo responsável na comanda da cozinha, na conta, nas prévias e na fila do caixa.
- Executar os testes de impressão e a verificação final da aplicação.

## Detalhes técnicos
- Reutilizar `orders.opened_by` e `orders.opened_by_name`, já existentes, sem nova alteração no banco.
- Cruzar `tenant_members` com `profiles` dentro das regras atuais de isolamento da loja e filtrar pelas funções `admin` e `atendente`.
- Persistir a mudança pelo fluxo compartilhado de pedidos para manter a sincronização em tempo real entre aparelhos.
