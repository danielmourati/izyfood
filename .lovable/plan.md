

# Fase 1: Tabelas `tenants` e `tenant_members`

Criar a base de dados para multi-tenancy sem alterar o frontend.

## Migration SQL

### 1. Tabela `tenants`
- `id UUID PK DEFAULT gen_random_uuid()`
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL UNIQUE` (identificador na URL, ex: "acainograu")
- `logo TEXT` (opcional)
- `active BOOLEAN DEFAULT true`
- `created_at TIMESTAMPTZ DEFAULT now()`

### 2. Adicionar `superadmin` ao enum `app_role`
- `ALTER TYPE app_role ADD VALUE 'superadmin'`

### 3. Tabela `tenant_members`
- `id UUID PK DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `role app_role NOT NULL DEFAULT 'atendente'`
- `created_at TIMESTAMPTZ DEFAULT now()`
- `UNIQUE(tenant_id, user_id)`

### 4. Função helper `get_user_tenant_id()`
Função `SECURITY DEFINER` que retorna o `tenant_id` do usuário autenticado. Será usada nas RLS policies futuras quando adicionarmos `tenant_id` às demais tabelas.

### 5. RLS policies
- **tenants**: superadmin pode tudo; membros podem ler seu próprio tenant
- **tenant_members**: superadmin pode tudo; membros podem ler registros do seu tenant

### 6. Tenant padrão + migração de dados
- Inserir um tenant padrão (slug: "loja-padrao") via INSERT na migration
- Vincular todos os usuários existentes em `user_roles` como membros desse tenant

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabelas, enum, função, RLS, dados iniciais |

Nenhuma alteração no frontend nesta fase.

