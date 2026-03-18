

## Migração para Supabase: Sincronização em Tempo Real

### Situação Atual
Todos os dados (produtos, pedidos, clientes, vendas, estoque, usuários, etc.) estão em **localStorage** — isolados por dispositivo, sem sincronização. A autenticação usa credenciais fixas em memória.

### O que precisa acontecer

Esta é uma migração completa de arquitetura: localStorage → Supabase (banco de dados PostgreSQL + autenticação + realtime). É um trabalho extenso que deve ser feito em etapas.

---

### Etapa 1: Configurar Supabase e criar tabelas

Conectar o projeto Supabase externo e criar todas as tabelas necessárias:

| Tabela | Campos principais |
|---|---|
| `categories` | id, name |
| `products` | id, name, description, price, category_id, type, unit, stock, image |
| `customers` | id, name, phone, address, notes, credit_balance, loyalty_points |
| `suppliers` | id, name, contact |
| `orders` | id, items (jsonb), total, order_type, status, table_number, customer_id, payment_method, payment_splits, discount, coupon_id, delivery_fee, delivery_status, order_source, motoboy_name, created_at, completed_at, loyalty_redemptions |
| `sales` | id, order_id, total, payment_method, customer_id, date, items (jsonb) |
| `stock_entries` | id, product_id, quantity, supplier_id, date |
| `tables` | number, status, order_id |
| `coupons` | id, code, type, value, active, min_order, expires_at |
| `settings` | id, table_count |
| `user_roles` | id, user_id, role (enum: admin, atendente, motoboy) |
| `profiles` | id (ref auth.users), name, email, pin |

- RLS habilitado em todas as tabelas
- Políticas baseadas em `user_roles` via função `has_role()`

### Etapa 2: Migrar autenticação

- Substituir o login local por **Supabase Auth** (email + senha)
- Criar tabela `profiles` + `user_roles` com trigger para auto-criar perfil no signup
- Criar usuários iniciais (admin, atendente) via seed ou manualmente
- O PIN atual vira a senha do Supabase Auth
- Atualizar `AuthContext.tsx` para usar `supabase.auth`
- Proteger rotas conforme role (admin, atendente, motoboy)

### Etapa 3: Migrar StoreContext para Supabase

- Substituir todas as chamadas `localStorage.getItem/setItem` por queries Supabase
- Cada `useState` + `useEffect(localStorage)` vira um hook que faz fetch + subscribe ao Supabase Realtime
- Exemplo: `products` será carregado com `supabase.from('products').select('*')` e atualizado em tempo real via `supabase.channel('products').on('postgres_changes', ...)`
- Manter a mesma interface `StoreContextType` para não quebrar nenhuma página

### Etapa 4: Realtime para o admin

- Supabase Realtime já estará ativo nas tabelas (etapa 3)
- Qualquer alteração feita em qualquer dispositivo (novo pedido, venda finalizada, estoque atualizado) será refletida automaticamente em todos os dispositivos conectados
- O admin verá em tempo real: pedidos entrando, mesas sendo ocupadas, vendas sendo finalizadas

---

### Impacto nos arquivos

| Arquivo | Mudança |
|---|---|
| `src/integrations/supabase/` | Novo — client + tipos gerados |
| `src/contexts/AuthContext.tsx` | Reescrito — Supabase Auth |
| `src/contexts/StoreContext.tsx` | Reescrito — queries + realtime |
| `src/pages/Login.tsx` | Atualizado — usar supabase.auth |
| `src/pages/Configuracoes.tsx` | Atualizado — CRUD usuarios via Supabase |
| `src/data/seed.ts` | Removido ou convertido em migration |
| Demais páginas | Mínimo — interface do StoreContext não muda |

### Considerações importantes

- **Migração incremental**: O sistema continuará funcional durante a migração. Cada etapa pode ser testada independentemente.
- **Dados existentes em localStorage**: Serão perdidos após a migração. Se houver dados importantes, será necessário inserir manualmente no Supabase.
- **Segurança**: Senhas serão hash pelo Supabase Auth (bcrypt). Roles verificados via função `has_role()` server-side, sem localStorage.
- **Escopo grande**: Esta é a maior mudança arquitetural do projeto. Recomendo implementar uma etapa por vez para garantir estabilidade.

### Próximo passo

Conectar seu projeto Supabase externo ao Lovable para iniciar a criação das tabelas e migração.

