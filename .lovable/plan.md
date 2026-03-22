

## Micro-refresh: Persistência automática do pedido em tempo real

### Situação atual

- O carrinho no PDV é **estado local** (`useState`). Ele só sincroniza com o banco quando:
  - Já existe um `pedidoParam` (mesa reaberta) — via `useEffect` que faz `setOrders`
  - O atendente clica "Segurar" ou "Finalizar"
- Para pedidos **novos** (balcão sem mesa), o pedido só existe localmente até ser segurado ou finalizado — nenhum outro dispositivo o vê

### O que precisa mudar

**Criar o pedido no banco imediatamente** ao iniciar qualquer venda, e fazer **auto-save debounced** do carrinho a cada alteração.

### Mudanças

**1. `src/pages/PDV.tsx`**

- Ao iniciar um pedido novo (sem `pedidoParam`), criar imediatamente um registro `orders` no banco com `status: 'aberto'` e redirecionar para `/pdv?pedido={id}` (para balcão) ou `/pdv?mesa=X&pedido={id}` (para mesa)
- O `useEffect` de sincronização do carrinho (linhas 60-67) já existe mas precisa:
  - Adicionar **debounce de ~500ms** para não sobrecarregar o banco a cada tecla
  - Sincronizar também `orderType`, `customerName`, `customerPhone`, `customerAddress`
  - Funcionar para **todos** os pedidos (não só os com `pedidoParam`)

**2. `src/contexts/StoreContext.tsx`**

- O `syncOrders` no wrapped setter já faz upsert no banco — a propagação via realtime já funciona
- Nenhuma mudança necessária aqui, o realtime de `orders` (linha 162-165) já propaga UPDATEs para todos os dispositivos

### Fluxo proposto

```text
Atendente adiciona item → cart muda → debounce 500ms → setOrders(atualiza pedido)
    → wrapped setter → syncOrders → DB update
    → Realtime → todos os dispositivos recebem o pedido atualizado
```

### Resumo

| Arquivo | Mudança |
|---|---|
| `src/pages/PDV.tsx` | Criar pedido no banco ao iniciar; debounce no auto-save do carrinho; sincronizar todos os campos relevantes |

Impacto: 1 arquivo. O mecanismo de realtime e sync já está funcional — falta apenas garantir que o pedido exista no banco desde o início e que cada alteração no carrinho seja persistida com debounce.

