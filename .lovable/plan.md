# Plano: Verificar e Diagnosticar Sincronização Realtime

## 1. Resultado da Auditoria (já executada)

### ✅ Tabelas sincronizando (15)
`attendant_permissions`, `cash_registers`, `categories`, `coupons`, `customers`, `orders`, `product_note_options`, `products`, `sales`, `stock_entries`, `store_settings`, `store_tables`, `suppliers`, `tenant_members`, `tenants`

### ❌ Tabelas FORA da publication realtime (6)
| Tabela | Impacto |
|---|---|
| **`printer_configs`** | 🔴 Crítico — impressora cadastrada no desktop não aparece no mobile sem F5 |
| **`cash_movements`** | 🟡 Entradas/saídas manuais de caixa não atualizam ao vivo |
| `commission_records` | 🟢 Baixo — só consultado em fechamento |
| `profiles` | 🟢 Baixo — nome/foto do usuário |
| `user_roles` | 🟢 Baixo — raro mudar em runtime |
| `audit_logs` | 🟢 Append-only, refresh manual OK |

### ⚠️ Sem `REPLICA IDENTITY FULL` (3)
`printer_configs`, `product_note_options`, `commission_records` — sem isso, eventos de UPDATE/DELETE chegam sem o `old` record, quebrando merges no cliente.

---

## 2. Migration de Correção

```sql
ALTER TABLE public.printer_configs REPLICA IDENTITY FULL;
ALTER TABLE public.cash_movements REPLICA IDENTITY FULL;
ALTER TABLE public.product_note_options REPLICA IDENTITY FULL;
ALTER TABLE public.commission_records REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE
  public.printer_configs,
  public.cash_movements,
  public.commission_records,
  public.profiles,
  public.user_roles;
```
(`audit_logs` fica fora — não precisa de live update.)

---

## 3. Tela `/diagnostico-sync` (somente Superadmin)

Nova rota acessível via `/:slug/diagnostico-sync`, protegida por `requireRole=['superadmin']`.

### Layout
```text
┌─ Diagnóstico de Sincronização ───────────────────────┐
│                                                       │
│  Status global: 🟢 12 canais ativos                  │
│                                                       │
│  ┌─ Tabela ────────┬─ Canal ─┬─ Último evento ──┐    │
│  │ tenants         │ 🟢 OK   │ 2s atrás (UPDATE) │    │
│  │ products        │ 🟢 OK   │ 14s atrás (INSERT)│    │
│  │ printer_configs │ 🟢 OK   │ nunca             │    │
│  │ orders          │ 🟢 OK   │ 1m atrás (UPDATE) │    │
│  │ ...             │         │                   │    │
│  └─────────────────┴─────────┴───────────────────┘    │
│                                                       │
│  [Disparar ping de teste em todas as tabelas]        │
│  [Copiar relatório]                                  │
└───────────────────────────────────────────────────────┘
```

### Funcionamento
- Ao montar, abre um `supabase.channel()` para cada tabela monitorada (12 críticas).
- Mostra status em tempo real: `SUBSCRIBED` (🟢), `CHANNEL_ERROR` (🔴), `TIMED_OUT` (🟡).
- Contador de eventos recebidos por tabela + timestamp do último.
- Botão "Disparar ping": faz um UPDATE inócuo em `store_settings` (atualiza `updated_at`) para confirmar round-trip end-to-end. Mede latência ms entre disparo e recepção.
- Botão "Copiar relatório": gera JSON com snapshot do estado (útil para suporte).
- Limpa todos os canais no unmount.

### Como usar para validar cross-device
1. Abra `/diagnostico-sync` no desktop.
2. Em outro dispositivo, edite qualquer entidade (ex.: nome da loja).
3. No desktop, a linha correspondente acende com timestamp "agora" e contador +1.
4. Se não acender → aquela tabela tem problema de publication/RLS.

---

## 4. Arquivos a criar/editar

- **Migration** (novo arquivo SQL com os ALTERs acima)
- **`src/pages/DiagnosticoSync.tsx`** — nova página
- **`src/App.tsx`** — adicionar rota `/:slug/diagnostico-sync`
- **`src/components/Sidebar.tsx`** (ou equivalente) — link "Diagnóstico" visível só para superadmin
- **Memória** — atualizar `mem://architecture/data-storage` registrando que `printer_configs` e `cash_movements` agora sincronizam

---

## 5. O que NÃO faz parte deste plano
- Refatorar `usePrinter` ou hooks já existentes (apenas a infra de sync é corrigida; o consumo já está pronto).
- Mudar lógica de negócio de caixa, impressão ou pedidos.

Posso prosseguir?
