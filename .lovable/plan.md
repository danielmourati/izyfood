
# Painel Superadmin

## Escopo

Criar um painel exclusivo para usuários com role `superadmin`, acessível via rota `/:slug/admin`, com as seguintes funcionalidades:

### 1. Dashboard com Métricas Globais
- Total de tenants ativos
- Total de usuários cadastrados
- Total de vendas (todas as lojas)
- Receita total do período

### 2. Gestão de Tenants
- Lista de todos os tenants (nome, slug, status ativo/inativo, data de criação)
- Criar novo tenant (nome, slug, logo)
- Ativar/desativar tenant

### 3. Criar Novo Estabelecimento (fluxo completo)
- Formulário: nome do estabelecimento, slug, email e senha do admin
- Ao criar, a edge function cria: tenant + usuário admin + profile + tenant_members + user_roles + store_settings

### Páginas e Componentes
- `src/pages/SuperAdmin.tsx` — página principal com abas (Dashboard, Tenants, Criar Tenant)
- `supabase/functions/create-tenant/index.ts` — edge function para criação segura do tenant + admin
- Rota protegida: só acessível por `superadmin`

### Pré-requisitos
- Criar um usuário superadmin no sistema (ou promover um existente)

### Fora do escopo (futuro)
- Edição de dados de tenants existentes
- Gestão de usuários de cada tenant
- Relatórios financeiros detalhados por tenant
