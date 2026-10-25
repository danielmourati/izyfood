# Corrigir ativação do Caixa (servidor de impressão) no Zezinho

## O que foi encontrado
- No Zezinho existe agora um Caixa ativo: aparelho "Computador" (usuário Zezinho), com sinal de vida de poucos segundos atrás. Há também um registro antigo (de 19/10) já expirado.
- Enquanto esse Caixa estiver ativo, o banco recusa qualquer outro aparelho — por isso o botão não liga.
- O botão falha "em silêncio" por dois motivos no app:
  1. Quando o aparelho consegue o Caixa, a tela só reconhece isso no próximo ciclo de conferência, então o botão volta para desligado.
  2. Quando outro aparelho já é o Caixa, o aviso "Caixa ativo: ..." só aparece se a tela já tiver carregado essa informação; senão nada é mostrado.
- Causa ainda não confirmada: se o "Computador" ativo é outra aba/navegador do mesmo computador (ex.: navegador limpo gerou um novo identificador). A primeira etapa confirma isso.

## O que será feito
1. Confirmar, com o aparelho do usuário, se o identificador dele é o do Caixa ativo ou outro.
2. Ao ligar o botão: atualizar a tela na hora com a resposta do banco, para o botão ficar ligado de imediato.
3. Se outro aparelho for o Caixa: mostrar sempre a mensagem com nome do aparelho/usuário e há quanto tempo ele deu sinal.
4. Novo botão "Assumir Caixa neste aparelho" (somente admin, com confirmação): transfere o Caixa para este aparelho e o anterior para de imprimir automaticamente — resolve abas esquecidas ou navegador trocado.
5. Vale para todas as lojas.

## Detalhes técnicos
- `use-printer.ts` `togglePrintHost`: após `acquire()` bem-sucedido, chamar refresh do `printHostPresence` (setar `dbHost` local com o próprio device) antes de liberar `hostBusy`; quando `acquire` retornar false, buscar o host atual e preencher `hostMessage` com rótulo e idade.
- Nova RPC `takeover_print_host(_device_id,_label,_user_name)` SECURITY DEFINER, restrita a `is_tenant_admin(auth.uid())`: sob o mesmo advisory lock, apaga/expira os demais `print_hosts` do tenant e grava o novo, contornando `guard_single_print_host` via flag de sessão. Auditada com `log_audit_event('print_host_takeover', ...)`.
- O aparelho antigo detecta no próximo `beat()` que perdeu o lease (`acquire` false) e desliga `hostOwned`, parando de processar a fila.
- Testes: lease assumido por admin, não-admin recusado, botão reflete estado logo após `acquire`.
