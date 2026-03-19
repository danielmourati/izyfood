

## Problema

As tabelas do banco estão com **Replica Identity = DEFAULT**, o que significa que o Supabase Realtime só envia a chave primária nos eventos de UPDATE/DELETE. Como a tabela `store_tables` usa `number` (não `id`) para matching no código, e o payload `new` pode não conter todos os campos necessários, as atualizações em tempo real falham silenciosamente.

Além disso, há um problema arquitetural: os "wrapped setters" fazem **write local + sync to DB**, e o realtime listener também faz **update local**. Isso cria duplicação e race conditions entre dispositivos.

## Solução

### 1. Migration: Replica Identity FULL em todas as tabelas

Executar uma migration SQL que define `REPLICA IDENTITY FULL` em todas as tabelas públicas. Isso garante que o Supabase Realtime envie todos os campos do registro nos eventos, permitindo que os listeners atualizem o estado corretamente.

Tabelas afetadas: `categories`, `products`, `customers`, `suppliers`, `orders`, `sales`, `stock_entries`, `store_tables`, `coupons`, `store_settings`, `profiles`, `user_roles`.

### 2. Corrigir race conditions nos wrapped setters

O problema atual: quando o dispositivo A atualiza uma mesa, o wrapped setter:
1. Atualiza estado local imediatamente
2. Faz sync para o DB
3. O DB dispara evento realtime
4. O listener do dispositivo A recebe o evento e tenta atualizar novamente (duplicação)
5. O dispositivo B recebe o evento e atualiza (funciona)

Mas se o sync falhar silenciosamente (erro de rede, RLS), o dispositivo B nunca recebe a mudança.

**Correção**: Nos wrapped setters, não atualizar o estado local imediatamente. Em vez disso, fazer apenas o write no DB e deixar o realtime listener atualizar o estado em todos os dispositivos (inclusive o que originou a mudança). Isso garante consistência.

Para manter a UX responsiva, podemos aplicar o update local otimisticamente, mas o realtime irá sobrescrever com o dado real do DB.

### 3. Arquivo afetado

- `src/contexts/StoreContext.tsx` — ajustar wrapped setters para garantir que o write no DB aconteça primeiro e o realtime propague para todos os dispositivos.

### Resumo técnico

```text
Dispositivo A (atendente)          Banco de Dados          Dispositivo B (admin)
        |                               |                          |
        |-- UPDATE store_tables ------->|                          |
        |                               |-- realtime event ------->|
        |<----- realtime event ---------|                          |
        |                               |                          |
    (estado atualizado)            (fonte da verdade)      (estado atualizado)
```

