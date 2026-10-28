# E-mails independentes por loja

## Objetivo
O mesmo e-mail (ex.: atendente@gmail.com) pode ser cadastrado em lojas diferentes, cada um com sua própria senha, nome e permissões. Entrar pela página de uma loja só acessa a conta daquela loja.

## Como vai funcionar para o usuário
- Admin cadastra atendente normalmente com o e-mail real; o sistema só recusa se o e-mail já existir **na mesma loja**.
- Login continua em `/:slug/login` com e-mail e senha; a loja da página define qual conta é usada.
- Senhas são independentes: trocar a senha em uma loja não afeta a outra.
- Contas existentes continuam funcionando sem precisar recadastrar.
- Superadmin continua entrando com o e-mail global atual.

## Etapas
1. **Conta interna por loja**: cada novo usuário recebe um login interno único (ex.: `u-<id>@t-<slug>.degust.internal`), e o e-mail real fica guardado no perfil da loja. Não envia e-mails para esse endereço interno.
2. **Cadastro** (criação de loja e gestão de usuários): passa a criar sempre a conta interna e verificar duplicidade só dentro da loja. O cadastro de usuário pela tela passa a usar somente a função segura do servidor (hoje há um caminho alternativo pelo navegador).
3. **Login**: antes de entrar, a página da loja converte "slug + e-mail digitado" no login interno através de uma consulta segura que não revela se o e-mail existe. Se não houver conta por loja, tenta o e-mail direto (contas antigas e superadmin).
4. **Confirmação de senha de admin** (liberações, exclusões) e **redefinir senha de usuário**: passam a usar o login interno do usuário daquela loja.
5. **Telas**: Meu Perfil, lista de usuários e recibos exibem sempre o e-mail real, nunca o interno.
6. **Migração opcional das contas atuais**: manter como estão (funcionam pela regra de fallback); converter só se o mesmo e-mail precisar entrar em outra loja.

## Detalhes técnicos
- Nova coluna `login_email` (e e-mail real) em `tenant_members`, com índice único `(tenant_id, lower(email))`; RLS por tenant mantida.
- RPC `resolve_tenant_login(_slug, _email)` security definer, retorna o login interno ou o próprio e-mail; executável por anon.
- Edge functions afetadas: `create-tenant`, `manage-users`, `verify-admin-password`, `reset-user-password`, `seed-users`; `UserFormModal.tsx` deixa de usar `signUp` no cliente.
- `AuthContext.login` e `Caixa.tsx` (reautenticação) chamam o RPC antes de `signInWithPassword`; `fetchAppUser` escolhe o tenant pelo membership da conta.
- `profiles.email` passa a guardar o e-mail real exibido.
- Testes: mesmo e-mail em duas lojas, duplicidade na mesma loja bloqueada, login antigo via fallback.
