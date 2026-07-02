
## Objetivo

Separar completamente o Super Admin da área operacional dos tenants e preparar o terreno para o controle de planos (Trial / PRO) via Mercado Pago.

A entrega será feita em **duas execuções**:

- **Execução 1 (agora):** área exclusiva do Super Admin com gestão total de tenants, usuários e licenças (sem cobrança real ainda).
- **Execução 2 (próxima):** integração Mercado Pago, checkout PIX (QR / copia-e-cola), webhook de confirmação, ativação automática do plano PRO e avisos de vencimento.

---

## Execução 1 — Área exclusiva do Super Admin

### 1. Remover Super Admin de `Configuracoes`

- `src/pages/Configuracoes.tsx`: remover a aba "Super Admin" e o import de `SuperAdminContent`. A tela de configurações passa a ser somente do tenant.
- `src/pages/SuperAdmin.tsx`: continua sendo o único ponto de entrada do painel.

### 2. Rota dedicada e isolada (`/superadmin`)

- `src/App.tsx`: registrar `/superadmin/*` **fora** do layout de tenant (`/:slug/...`), sem `AppSidebar` do tenant.
- Guard de rota: só permite acesso se `has_role(auth.uid(), 'superadmin')`. Qualquer outro usuário é redirecionado para `/`.
- Criar `src/components/SuperAdminLayout.tsx` com sidebar/topbar próprios (mesma paleta food), separando visualmente do PDV.
- Manter compatibilidade: `/:slug/admin` deixa de existir (ou redireciona para `/superadmin`).

### 3. Estrutura de páginas do Super Admin

Sidebar do Super Admin com as seções:

- **Dashboard** — métricas globais (tenants ativos, usuários, vendas, receita) — já existe em `SuperAdminContent`.
- **Tenants** — listar, criar, editar (nome, slug, logo), ativar/desativar, excluir (soft delete via `active=false`), acessar como (impersonar via link `/{slug}/pdv`).
- **Usuários** — listar todos os usuários de todos os tenants, filtrar por tenant/role, criar, resetar senha (edge function existente `reset-user-password`), remover, alterar role.
- **Planos & Licenças** — visão geral: qual tenant está em Trial / PRO, data de expiração, ação manual de alterar plano (para uso administrativo antes da integração MP).
- **Auditoria** — reaproveitar `AuditLogsTab` em escopo global (Super Admin vê logs de todos os tenants).
- **Configurações do sistema** — chaves globais (placeholder para credenciais MP na Execução 2).

Componentes a criar/refatorar:
- `src/pages/superadmin/Dashboard.tsx`
- `src/pages/superadmin/Tenants.tsx` (reaproveita `TenantsTab` + `CreateTab` já existentes)
- `src/pages/superadmin/Usuarios.tsx` (reaproveita `SuperAdminUsersTab`)
- `src/pages/superadmin/Planos.tsx` (novo)
- `src/pages/superadmin/Auditoria.tsx` (novo, reaproveita `AuditLogsTab` sem filtro por tenant)
- `src/pages/superadmin/Sistema.tsx` (novo, placeholder)

### 4. Schema — base para planos

Migração (aprovação necessária):

- Novo enum `plan_type` = `'trial' | 'pro_monthly' | 'pro_yearly'`.
- Novo enum `plan_status` = `'active' | 'expired' | 'canceled' | 'pending_payment'`.
- Nova tabela `public.tenant_plans`:
  - `tenant_id` (FK único), `plan` (`plan_type`), `status` (`plan_status`), `trial_ends_at`, `current_period_end`, `last_payment_at`, `mp_customer_id` (nullable, para Execução 2), `created_at`, `updated_at`.
- GRANTs: `authenticated` (SELECT do próprio tenant via RLS), `service_role` ALL.
- RLS: admin do tenant lê apenas o próprio; superadmin (via `has_role`) lê/edita todos.
- Trigger: ao criar tenant novo (`create-tenant`), inserir `tenant_plans` com `plan='trial'`, `trial_ends_at = now() + 14 days`, `status='active'`.
- Função `public.is_tenant_pro(_tenant_id uuid) returns boolean` (SECURITY DEFINER) para uso em RLS/checks futuros.

### 5. Sinalização de plano no app do tenant (leve, sem cobrança)

- `StoreContext`: expor `plan` e `trialDaysLeft`.
- Banner discreto no topo do layout do tenant quando `plan='trial'`: "Você está no Trial — X dias restantes. Ver detalhes". CTA leva a `/{slug}/configuracoes?tab=plano` (nova aba "Plano" só visível ao admin).
- Página do plano no tenant (Execução 1): mostra plano atual, data de expiração, comparativo Trial x PRO (R$ 157/mês, R$ 1.570/ano), botão **"Quero assinar"** desabilitado com tooltip "Disponível em breve" (será ativado na Execução 2).

### 6. Verificação

- Build TS.
- Login como superadmin → só vê `/superadmin`; não vê sidebar de tenant.
- Login como admin de tenant → não consegue acessar `/superadmin` (redirect).
- Configurações do tenant não mostra mais aba Super Admin.
- Novo tenant criado nasce em Trial de 14 dias.

---

## Execução 2 — Mercado Pago (próxima iteração, apenas planejado)

Escopo previsto (não será implementado agora):

1. **Credenciais** — `add_secret` para `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`. Cadastro feito pelo Super Admin em "Sistema".
2. **Edge functions**:
   - `mp-create-payment`: recebe `{ tenant_id, plan: 'pro_monthly'|'pro_yearly' }`, cria pagamento PIX na API MP (`POST /v1/payments`), retorna `qr_code_base64`, `qr_code` (copia-e-cola), `payment_id`. Grava em nova tabela `payment_intents`.
   - `mp-webhook`: endpoint público (verify_jwt=false) que valida assinatura, consulta `GET /v1/payments/{id}`, e se `status='approved'` atualiza `tenant_plans` para `pro_monthly`/`pro_yearly` com `current_period_end = now() + 30d/365d`.
3. **UI tenant** — botão "Quero assinar" abre modal com QR Code + copia-e-cola + polling do status a cada 3s até `active`. Ao aprovar, tenant vira PRO na hora.
4. **Avisos de vencimento** — cron (`pg_cron` + `pg_net`) roda diariamente: para planos `pro_monthly` com `current_period_end` entre `now()+4d` e `now()+5d`, envia notificação in-app (e email opcional) ao admin. Ao vencer sem renovação, `status='expired'` e volta a exibir CTA de reassinatura.
5. **Painel Super Admin** — página "Planos" ganha filtros por status, exportação, e ação de estender manualmente vencimento.

Toda a estrutura de schema (`tenant_plans`, enums, função `is_tenant_pro`) já fica pronta na Execução 1 para que a Execução 2 seja focada apenas em pagamento + webhook + UI.

---

## Fora de escopo (ambas as execuções)

- Cobrança recorrente automática (assinatura recorrente MP) — usaremos PIX one-shot com renovação manual/lembrete.
- Faturamento com nota fiscal.
- Múltiplos planos além de Trial / PRO mensal / PRO anual.
- Alterações no PDV, Caixa, Pedidos, Mesas ou impressão térmica.
