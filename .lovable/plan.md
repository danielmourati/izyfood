## Objetivo
Cada tenant deve ter um slug próprio, único, validado e editável — sem cair no fallback genérico `loja-padrao`.

## 1. Validação forte na criação (`create-tenant` edge function + UI)

Regra do slug (client e server):
- Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`
- Tamanho: 3–40 caracteres
- Reservados bloqueados: `login`, `superadmin`, `admin`, `api`, `auth`, `loja-padrao`, `pdv`, `home`

Onde aplicar:
- **UI (`src/pages/SuperAdmin.tsx` → CreateTab)**: validar formato ao digitar, mostrar erro inline, desabilitar botão se inválido. Checar disponibilidade em tempo real via `select id from tenants where slug = ?` (debounce 400ms).
- **Edge function `supabase/functions/create-tenant/index.ts`**: repetir validação de formato, reservados e unicidade antes do `INSERT`, retornando 409/400 com mensagem clara.

## 2. Auto-geração de slug único

Nova função utilitária no client (`slugify` já existe) + no edge:
- Gerar base a partir do nome.
- Se colidir, tentar `base-2`, `base-3`, … até 50 tentativas.
- Campo Slug no formulário permanece editável (auto-preenche mas usuário pode sobrescrever).

## 3. Edição de slug do tenant existente (Super Admin)

- Na `TenantsTab` (`src/pages/SuperAdmin.tsx`), adicionar botão "Editar slug" por linha → modal com input + validação + botão Salvar.
- Ao salvar: mesma validação (formato, reservados, unicidade excluindo o próprio id) e `UPDATE tenants SET slug = ? WHERE id = ?`.
- Registrar em `audit_logs` (ação `tenant.slug_updated`, detalhes com slug antigo/novo).
- Modal exibe aviso: "URLs antigas com o slug anterior deixarão de funcionar".

RLS: a política atual de `tenants` para superadmin já cobre UPDATE — apenas confirmar que existe policy `FOR UPDATE` para superadmin; se faltar, adicionar via migration.

## 4. Remover fallback silencioso `loja-padrao`

Hoje, quando o usuário logado não tem tenant vinculado, ele é jogado em `/loja-padrao/...`. Isso mistura dados entre tenants.

Mudanças:
- **`src/contexts/AuthContext.tsx`**: se `memberData` não existir e `role !== 'superadmin'`, não montar `AppUser` — em vez disso, forçar `signOut()` e exibir estado de erro ("Sua conta não está vinculada a nenhum estabelecimento. Contate o suporte.") no `Login`.
- **`src/hooks/use-tenant-navigate.ts`**: remover default `'loja-padrao'`; se slug estiver vazio, lançar warning e navegar para `/login`.
- **`supabase/functions/create-tenant/index.ts`**: já cria o vínculo em `tenant_members` via trigger `handle_new_user` (usa `tenant_id` do `user_metadata`) — nenhum ajuste necessário, apenas confirmar via teste.
- **Trigger `handle_new_user`**: hoje usa fallback `00000000-...-000001` quando `tenant_id` não vem no metadata. Alterar via migration para: se metadata não trouxer tenant_id **e** o email não for de superadmin, ainda criar profile mas **não** criar `tenant_members` — evita vínculo cruzado silencioso. Superadmins continuam sem vínculo a tenant, como já é.

## 5. Detalhes técnicos

Arquivos alterados:
- `src/pages/SuperAdmin.tsx` — validação inline, checagem de disponibilidade, modal "Editar slug".
- `src/contexts/AuthContext.tsx` — remoção de fallback, signOut para usuário sem tenant.
- `src/hooks/use-tenant-navigate.ts` — remoção de default.
- `supabase/functions/create-tenant/index.ts` — validação + auto-sufixo + resposta 409 em colisão.
- Nova migration: ajustar `handle_new_user` para não usar tenant default; garantir policy UPDATE para superadmin em `tenants` (se não existir).

Sem alteração de esquema em `tenants` (coluna slug já é `UNIQUE NOT NULL`).

## Fora do escopo
- Redirect automático de slug antigo → novo (URLs antigas simplesmente quebram, conforme aviso no modal).
