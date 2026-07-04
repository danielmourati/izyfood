## Objetivo

Ampliar o sistema de permissões de atendentes com novas capacidades, agrupar visualmente por área e permitir copiar permissões para múltiplos usuários de uma vez. (Anexo 2 já atendido — superadmin já vê/edita/reseta senhas.)

## Novas permissões (colunas em `attendant_permissions`)

Adicionar 10 flags booleanas, todas default `false`:

**Caixa**
- `open_cash_register` — abrir turno
- `close_cash_register` — fechar turno
- `view_cash_register` — ver caixa (sem movimentar)

**Relatórios & Pedidos**
- `view_reports` — acesso a Relatórios
- `view_orders_history` — acesso à página Pedidos

**Operação de salão**
- `manage_deliveries` — página Entregas
- `manage_tables` — abrir/fechar/juntar mesas

**Cadastros auxiliares**
- `manage_coupons` — cupons/promoções
- `manage_suppliers` — fornecedores
- `manage_printers` — configuração de impressoras

## Mudanças

### 1. Migration
`ALTER TABLE public.attendant_permissions ADD COLUMN ... DEFAULT false NOT NULL` para as 10 colunas acima. RLS e grants já existem — nada a alterar.

### 2. `src/hooks/use-attendant-permissions.ts`
Adicionar as 10 chaves em `AttendantPermissions`, `allTrue`, `defaultPermissions` e `mapRow`. Todo consumidor continua funcionando; novos gates lêem `permissions.<chave>` normalmente.

### 3. `src/pages/Configuracoes.tsx` → `PermissoesTab`
Reestruturar UI:

- Substituir `permissionLabels` plano por `permissionGroups`:
  ```ts
  const permissionGroups = [
    { key: 'caixa', label: 'Caixa', icon: Wallet, items: [...] },
    { key: 'pedidos', label: 'Pedidos & Vendas', icon: Receipt, items: [
      'remove_order_items','cancel_orders','apply_discounts','view_orders_history'
    ]},
    { key: 'catalogo', label: 'Catálogo & Estoque', icon: Package, items: [
      'manage_categories','manage_products','edit_prices','manage_stock','manage_suppliers'
    ]},
    { key: 'salao', label: 'Salão & Entregas', icon: Truck, items: ['manage_tables','manage_deliveries'] },
    { key: 'clientes', label: 'Clientes & Promoções', icon: Users, items: ['manage_customers','manage_coupons'] },
    { key: 'relatorios', label: 'Relatórios', icon: BarChart3, items: ['view_reports'] },
    { key: 'sistema', label: 'Sistema', icon: Settings, items: ['manage_printers'] },
  ];
  ```
- Cada grupo renderizado como sub-card com título + ícone + grid 2 col dos switches.
- Botões "Marcar todos"/"Desmarcar" mantidos no header do usuário.

**Cópia multi-seleção**: remover UI atual (select + botão "Copiar") e adicionar botão "Copiar para outros..." por usuário que abre `<Dialog>` com:
- Lista de checkboxes com todos os outros atendentes do tenant.
- Checkbox "Selecionar todos".
- Botão "Copiar permissões" → itera destinos, faz upsert das mesmas 19 flags.
- Feedback via `sonner` (respeitando regra do projeto: sonner allowed, toast UI padrão não).

### 4. Aplicar gates onde ainda não existem
Adicionar checks `permissions.X || isAdmin` em:
- `src/components/AppSidebar.tsx` — esconder itens Relatórios (`view_reports`), Entregas (`manage_deliveries`), Mesas (`manage_tables`), Pedidos (`view_orders_history`), Caixa (`view_cash_register || open_cash_register || close_cash_register || manage_cash`).
- `src/pages/Caixa.tsx` — botões "Abrir caixa" (`open_cash_register`), "Fechar caixa" (`close_cash_register`), demais ações mantêm `manage_cash`.
- `src/pages/Entregas.tsx`, `src/pages/Mesas.tsx`, `src/pages/Relatorios.tsx`, `src/pages/Pedidos.tsx` — redirect/empty state quando sem permissão.
- `src/pages/Configuracoes.tsx` — aba Impressora exibida se `manage_printers || isAdmin`; aba Cupons (se existir na Configurações) usa `manage_coupons`.
- Estoque → aba Fornecedores gated por `manage_suppliers`.

### 5. Anexo 2 (Superadmin Usuários)
Sem mudanças — funcionalidade já implementada em `SuperAdminUsersTab` (view/edit/reset/delete). Nenhum novo trabalho.

## Detalhes técnicos

- Novas colunas seguem padrão `NOT NULL DEFAULT false` para não quebrar inserts existentes.
- Realtime do hook já cobre novas colunas (subscription é `event: '*'`).
- Tipos Supabase (`src/integrations/supabase/types.ts`) regenerados automaticamente após migration; código do hook usa cast leve para evitar quebra transitória.
- Nenhuma alteração em `AuthContext`, `client.ts` ou config.

## Fora de escopo

- Reset de senha superadmin (já existe).
- Permissões por tenant multi-organização (usuário só pertence a 1 tenant hoje).
