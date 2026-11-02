# Bloquear lojas inativas ou excluídas

## O que encontrei
O botão Ativo/Inativo grava certo: hoje Zezinho e Quintal de Casa estão marcadas como inativas. O problema é que nada no app confere isso. A página de entrar e os aparelhos já logados continuam funcionando normalmente.

## O que vai mudar
- **Endereço da loja** (`degust.app/<loja>` ou `/<loja>/login`): se a loja estiver inativa ou não existir mais, aparece a tela **"Loja não encontrada"**, sem campos de login. A mesma tela aparece para link de loja excluída.
- **Quem já está logado:** ao desativar, os aparelhos da loja saem da sessão em até ~1 minuto (e ao reabrir/voltar à aba) e caem na tela "Loja não encontrada".
- **Login bloqueado:** mesmo pela tela geral `/login`, um usuário de loja inativa não entra; aparece "Loja não encontrada".
- **Proteção no servidor:** usuários de loja inativa deixam de ler e gravar dados da loja, mesmo com app antigo aberto. Super Admin continua vendo e reativando a loja normalmente.
- **Botão no Super Admin:** passa a mostrar o resultado na própria linha (sem avisos flutuantes) e confirma lendo do banco.
- Ao reativar, a loja volta a funcionar imediatamente.

## Detalhes técnicos
- Migração: `get_user_tenant_id()` passa a retornar o tenant só quando `tenants.active = true` (assim todas as políticas RLS por tenant bloqueiam lojas inativas automaticamente); nova RPC pública `tenant_status(_slug)` → `active | inactive | missing`. `get_tenant_branding` já filtra `active = true`.
- Superadmin: políticas próprias seguem por `has_role`, sem depender de `get_user_tenant_id`.
- `Login.tsx` e `TenantRoutes` (`App.tsx`): consultar `tenant_status`; se não for `active`, renderizar novo `StoreNotFound`.
- `AuthContext.tsx`: após login e a cada 60s/foco, checar status; se inativa, `signOut` e redirecionar para a tela.
- `SuperAdmin.tsx`: atualização otimista do switch com estado de erro inline.
- Teste: helper puro que mapeia status → mostrar loja / "Loja não encontrada".
