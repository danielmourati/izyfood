

## Correção: Persistência de cliente, liberação de mesa e estabilidade do realtime

### Problemas identificados

**1. Cliente some ao segurar/salvar mesa**
No `PDV.tsx`, o `useEffect` (linha 60-67) que sincroniza o carrinho com o pedido existente só atualiza `items` e `total`, mas **não persiste o `customerId`**. Além disso, o `holdOrder` quando já existe um `pedidoParam` (mesa) simplesmente limpa o carrinho sem atualizar o pedido no banco com o `customerId` e status `segurado`.

**2. Mesa não volta para "Disponível" ao finalizar**
O `completeSale` no `StoreContext.tsx` faz `supabase.from('store_tables').update(...)` diretamente no banco (linha 361-363), mas o `onComplete` do `CheckoutModal` no `PDV.tsx` chama `setCart([])` e navega para `/`. Porém, o `useEffect` de sincronização do carrinho (linha 60-67) **não atualiza o status da mesa** — e a navegação acontece antes do realtime propagar a mudança. O problema real é que o `completeSale` usa `order.tableNumber`, mas este pode estar `undefined` se o `currentOrder` montado na linha 171-180 não receber corretamente o `tableNumber` do URL param em certos fluxos.

**3. Mesas desaparecem do realtime**
O handler de `DELETE` no realtime de `store_tables` (linha 179) remove mesas do estado local. Isso acontece legitimamente quando o admin reduz a quantidade de mesas em `updateTableCount`, mas também pode ser disparado por **race conditions**: se dois dispositivos estiverem sincronizando tabelas simultaneamente, ou se o `updateTableCount` deletar e recriar mesas rapidamente, o realtime pode enviar DELETE sem o INSERT subsequente ter chegado ainda.

---

### Solução

**Arquivo: `src/pages/PDV.tsx`**

1. **Sincronizar `customerId` no useEffect do carrinho** — adicionar `customerId` e `customerName` ao objeto atualizado no `setOrders` (useEffect linha 60-67).

2. **Corrigir `holdOrder` para pedidos existentes** — quando `pedidoParam` existe, atualizar o pedido no estado com `status: 'segurado'`, `customerId` e `heldAt`, em vez de simplesmente ignorar.

3. **Garantir que `onComplete` do CheckoutModal não interfira** — o `completeSale` já libera a mesa no DB. O `onComplete` só precisa limpar estado local e navegar.

**Arquivo: `src/contexts/StoreContext.tsx`**

4. **Proteger contra DELETE espúrio de mesas** — no handler realtime de `store_tables`, ignorar DELETEs de mesas que tenham `status: 'occupied'` (mesa ocupada nunca deveria ser deletada). Alternativamente, ao receber DELETE, só remover se o número da mesa for maior que o `tableCount` atual.

5. **Garantir que `completeSale` funcione corretamente** — verificar que `order.tableNumber` está definido antes de tentar liberar a mesa, e logar erros do Supabase para diagnóstico.

---

### Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `src/pages/PDV.tsx` | Sincronizar `customerId` no useEffect; corrigir `holdOrder` para pedidos existentes |
| `src/contexts/StoreContext.tsx` | Proteger handler DELETE de mesas no realtime; melhorar robustez do `completeSale` |

