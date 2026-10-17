# Bloquear exclusão de itens já impressos sem permissão

## Situação atual
- Na janela do pedido (celular e computador), a lixeira de cada item remove o item sem nenhuma verificação, mesmo que ele já esteja como **Impresso**.
- No celular, o botão de remover do produto selecionado apaga todas as unidades daquele produto, incluindo as já impressas.

## O que muda (todas as lojas)
- **Itens "Novo" (ainda não impressos):** qualquer usuário continua podendo remover livremente.
- **Itens "Impresso":**
  - Admin ou atendente com a permissão **"Remover itens do pedido"** liberada: remove normalmente.
  - Atendente sem essa permissão: ao tocar na lixeira, abre uma janela pedindo a **senha de um administrador**. Só remove se a senha for válida; senão mostra "Senha de administrador incorreta" na própria janela (sem notificações flutuantes).
- No celular, o botão de remover do produto selecionado passa a remover só as unidades **novas**; as impressas seguem a mesma regra acima.
- Cada remoção de item impresso fica registrada na auditoria (quem removeu, quem autorizou, item e mesa).

## Validação
- Atendente sem permissão: item Novo sai; item Impresso pede senha; senha errada bloqueia; senha do admin libera.
- Atendente com permissão e admin: removem direto.
- Teste automático da regra "pode remover item impresso?".

## Detalhes técnicos
- `ConsumerOrderModal.tsx`: helper `canRemovePrintedItem = effectiveAdmin || permissions.remove_order_items` (lógica pura em `src/lib/order-permissions.ts` + teste em `src/test/`).
- `handleRemoveItem(id)`: se item `printed` e sem permissão, guarda o id pendente e abre `Dialog` de senha; validação via edge function existente `verify-admin-password` (valida contra admins do tenant no servidor), substituindo o atalho inseguro de senha fixa (`123456`/`admin`) também no diálogo de exclusão do pedido.
- `handleRemoveDirect`: filtrar apenas `!i.printed` do produto.
- `logAudit('remove_printed_item', 'order', orderId, { item, quantity, authorizedBy })`.
- Salvamento: `mergePrintedFlags` já impede que o item volte como "Novo"; garantir que a remoção autorizada não seja reintroduzida pelo merge remoto.
