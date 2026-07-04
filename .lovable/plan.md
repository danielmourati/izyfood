## Escopo

7 mudanças agrupadas por área. Cada uma independente.

---

### 1. Criar admin `fabiano@gmail.com` para tenant `xofome`
- Consultar `tenants` pelo slug `xofome` (via SQL de leitura antes da migração).
- Chamar edge function existente `manage-users` OU criar via `supabase.auth.admin.createUser` numa migração dedicada usando `insert` no `auth.users` não é permitido — usaremos uma nova invocação: adicionar rota `create-user` reutilizando a edge function `manage-users` (ou seed pontual via `seed-users` estendida).
- Vincular em `tenant_members` (tenant xofome, role `admin`) e `user_roles` (`admin`).
- Senha: `xofome@123`.

### 2. CRUD completo de usuários pelo Superadmin
- Estender edge function `manage-users` (service_role) para suportar: `create`, `update`, `delete`, além do reset já existente.
- Payload: `{ action, user_id?, email?, password?, name?, phone?, role?, tenant_id? }`.
- Validar caller como `superadmin` via `has_role`.
- Refatorar `SuperAdminUsersTab.tsx`:
  - Botão "Novo usuário" → modal (nome, email, senha, telefone, role, tenant).
  - Botão "Editar" por linha → modal de edição (permite trocar tenant/role).
  - Botão "Excluir" → confirm dialog.
  - Manter "Redefinir senha".
- Separar tela: em `/configuracoes` do admin do tenant fica **Meu Perfil** e **preferências gerais** (impressoras, loja). Gestão de usuários de outros tenants **só no /superadmin/usuarios**. (Já é o caso; apenas garantir que a aba "Usuários" atual do admin do tenant só liste usuários do próprio tenant e não exponha superadmin actions.)

### 3. `/superadmin/planos` — bloqueio + cortesia + status MP
- Ampliar `PlanosPage.tsx` para listar todos os tenants com:
  - Status do plano (`tenant_plans`): trial / pro_monthly / pro_yearly / suspended.
  - Ações: **Suspender** (`status='suspended'`), **Reativar** (`status='active'`), **Estender cortesia** (input dias → soma em `trial_ends_at`).
  - Coluna "Últimos pagamentos MP" lendo `payment_intents` filtrado por tenant, mostrando status/valor/data.
- Loading enforcement: `AuthContext` já valida tenant; adicionar guarda em `fetchAppUser` — se `is_tenant_pro=false` E `trial_ends_at<now` E `status='suspended'`, ainda permite login mas mostra banner "Conta suspensa — contate o suporte" via `TrialBanner`/novo componente e bloqueia rotas de escrita (opção mínima: apenas mostrar aviso, sem redirect — pediu "apenas suspender plano").

### 4. Impressoras adicionais — duplicar configuração existente
- Em `ImpressoraTab.tsx`: adicionar botão "Duplicar impressora" ao lado de cada `printer_config`.
- Ao clicar: abre modal pré-preenchido com nome/IP/porta da origem, exigindo apenas escolher novo **papel** (dropdown: `balcao`, `cozinha`, `bar`, `caixa`, `delivery`).
- Salva nova linha em `printer_configs` com `role=<novo papel>` e demais campos copiados.
- Migração: adicionar coluna `role text not null default 'balcao'` em `printer_configs` (se não existir).

### 5. Impressão de teste com pedido genérico
- Corrigir handler `Imprimir Teste` em `ImpressoraTab.tsx` para gerar um pedido fake completo (mesa 3, 2 itens com observações, subtotal, total, forma de pagamento) e enviar via `printer.printOrder(mockOrder)` usando o layout comanda real.
- Reutilizar `src/lib/escpos.ts` — sem novo formato.

### 6. Sidebar do storefront do admin sempre retraído por padrão
- Em `src/App.tsx` (ou wrapper onde `SidebarProvider` é montado para rotas `/:slug/*`): setar `defaultOpen={false}`.
- Não afeta `/superadmin` (mantém preferência atual).

### 7. Tooltips no hover + data/hora no header
- **Tooltips**: envolver todos os `Button`/`DropdownMenuTrigger`/ícones-ação sem label visível com `Tooltip` do shadcn. Foco em: header (theme toggle, logout, sidebar trigger), botões de ação de tabelas (editar/excluir/reset), FABs. Criar helper `<IconButton tooltip="...">` reutilizável para reduzir boilerplate.
- **Data/hora no header**: adicionar componente `HeaderClock` (mostra `dd/MM/yyyy HH:mm:ss`, atualiza a cada segundo, formato pt-BR) no `Layout.tsx` do storefront e no `SuperAdminLayout.tsx`.

---

## Arquivos

**Novos:**
- `src/components/HeaderClock.tsx`
- `src/components/UserFormModal.tsx` (create/edit user)
- `src/components/DuplicatePrinterModal.tsx`

**Migração:**
- `printer_configs.role` (novo enum de texto)
- Talvez função `has_role_any_tenant` — não necessária, `has_role(uid, 'superadmin')` já cobre.

**Edge functions:**
- Estender `supabase/functions/manage-users/index.ts` com actions `create|update|delete`.
- Novo seed pontual: chamar `manage-users` do próprio painel do superadmin para criar o admin do xofome, OU um script one-off (via `insert` tool no auth não é possível; usaremos edge function chamada manualmente após deploy).

**Editados:**
- `src/pages/superadmin/PlanosPage.tsx` (suspender/estender/MP)
- `src/components/SuperAdminUsersTab.tsx` (CRUD)
- `src/components/ImpressoraTab.tsx` (duplicar + teste real)
- `src/App.tsx` (sidebar defaultOpen=false para storefront)
- `src/components/Layout.tsx` (HeaderClock + tooltips)
- `src/pages/superadmin/SuperAdminLayout.tsx` (HeaderClock)
- Vários botões espalhados: adicionar `Tooltip` — feito de forma incremental no header primeiro, depois nas tabelas de ações.

## Ordem de execução
1. Migração (`printer_configs.role`).
2. Estender `manage-users` + deploy.
3. Criar usuário `fabiano@gmail.com` via `manage-users` recém-deployada.
4. CRUD UI no `SuperAdminUsersTab`.
5. `PlanosPage` — suspender/cortesia/MP.
6. Impressoras adicionais + teste real.
7. Sidebar default retraído.
8. Tooltips + HeaderClock.

## Verificação
- Login com fabiano@gmail.com / xofome@123 → deve entrar como admin do xofome.
- Superadmin cria/edita/exclui usuário de qualquer tenant.
- Suspender um tenant em /planos → admin do tenant vê aviso "Suspenso".
- Duplicar impressora balcão para cozinha → nova linha aparece.
- Botão "Imprimir Teste" → cupom com pedido fake sai na impressora.
- Storefront do admin abre com sidebar retraída.
- Hover em qualquer ícone do header mostra tooltip; relógio atualiza no header.
