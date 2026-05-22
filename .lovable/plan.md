# Sincronização entre dispositivos + layout do cupom de Conta

## Diagnóstico do não-sincronismo (mobile → desktop)

A tabela **`tenants`** (nome da loja, logo, ícones, carrossel) **não estava no publication realtime** do Supabase. Por isso, salvar no mobile não disparava o evento `UPDATE` no desktop — só apareciam mudanças após F5.

A `store_settings` já estava no realtime, então as configurações de impressão sincronizavam — mas o nome e logo da loja não. ✅ Migration já aplicada para adicionar `tenants` ao publication com `REPLICA IDENTITY FULL`.

## Mudanças de código a aplicar

### 1. `src/lib/escpos.ts` — corrigir build error
Adicionar `storeName?: string` na interface `PrintSettings` (já é usado no fetch e no header do cupom, faltava na tipagem).

### 2. `src/lib/escpos.ts` — layout do cupom Conta
A função `buildBillReceipt` **já produz exatamente** o layout pedido (linhas 339-344):
```
Tipo:                               Mesa
Mesa:                                  1
Cliente:                          Daniel
Data:               21/05/2026, 17:23
```
Nenhuma mudança necessária no ESC/POS, desde que o `bill` recebido carregue `tableNumber` e `customerName`. Vou verificar em `PDV.tsx`/`CheckoutModal.tsx` se esses campos são preenchidos ao chamar `printBill`, e ajustar se faltar.

### 3. `src/hooks/use-printer.ts` — `buildBillHtml` (fallback navegador)
Hoje o HTML fallback omite "Tipo:", usa default "Consumidor" mesmo sem cliente, e formata como linhas `row` simples. Refatorar para:
- Adicionar linha "Tipo:" sempre
- Adicionar "Mesa:" quando `tableNumber` ou `orderType === 'mesa'`
- Linha "Cliente:" mostra o nome real (não "Consumidor" se vazio — mostra em branco)
- Linha "Data:" no mesmo padrão
- Usar `<div class="row">` (já tem `justify-content: space-between` no CSS do fallback) para alinhamento esquerda/direita consistente

### 4. `src/pages/Configuracoes.tsx` — realtime de `tenants`
Já tem assinatura `postgres_changes` em `tenants` (linhas 247-257). Com o publication agora correto, vai funcionar sem mudança de código.

## Verificação após aplicar

1. Abrir Configurações no desktop e no mobile lado a lado.
2. Alterar nome da loja no mobile, salvar.
3. Confirmar que o desktop atualiza sem F5.
4. Imprimir uma Conta de Mesa com cliente "Daniel" e verificar via fallback HTML que aparece:
   - Tipo: ... Mesa
   - Mesa: ... 1
   - Cliente: ... Daniel
   - Data: ... 21/05/2026, 17:23

Posso seguir aplicando as 3 mudanças de código?