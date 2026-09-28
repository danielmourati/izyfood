# Corrigir login após criar loja

## O que foi encontrado
- A loja "Pastelão Sousa" (criada ontem) existe, mas **não tem nenhum usuário**: o e-mail araujioana@gmail.com não foi criado no sistema. Por isso o login responde "E-mail ou senha incorretos".
- Na criação da loja, a loja é gravada primeiro e o usuário administrador depois. Se a criação do usuário falha (ex.: senha recusada por ser fraca/vazada, como "pastel@123"), a loja fica salva sem dono e a falha não fica clara na tela.

## O que será feito
1. **Criação segura**: se o usuário administrador não puder ser criado, a loja é desfeita automaticamente — nada fica pela metade.
2. **Validar antes**: checar se o e-mail já existe e se a senha é aceita antes de gravar a loja.
3. **Mensagem clara** na tela do Super Admin, em português, dizendo o motivo real (senha fraca, e-mail já usado, etc.).
4. **Confirmar vínculo**: após criar, conferir que o usuário está ligado à loja como admin; se não, completar o vínculo.
5. **Recuperar a loja Pastelão Sousa**: adicionar na lista da loja no Super Admin a opção "Criar administrador" para lojas sem usuário, permitindo cadastrar araujioana@gmail.com com uma senha nova.
6. Remover o "login demo" que aceita e-mails contendo "admin"/"demo" sem senha válida (entra numa loja falsa e confunde).

## Detalhes técnicos
- `supabase/functions/create-tenant`: pré-checagem de e-mail via admin API; em erro do `auth.admin.createUser`, `delete` do tenant (e store_tables/tenant_plans semeados); upsert em `tenant_members`/`user_roles`; retornar `{error}` com status 400 traduzido; redeploy.
- `SuperAdmin.tsx`: ler `error.context` do invoke e mostrar inline; ação "Criar administrador" usando `manage-users` action `create`.
- `AuthContext.tsx`: remover fallback demo.
- Verificar: criar loja de teste com senha fraca (deve falhar sem sobrar loja) e com senha forte (login funciona).
