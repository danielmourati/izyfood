## Objetivo
Aplicar na comanda de cozinha (`buildOrderReceipt` em `src/lib/escpos.ts`) a mesma lógica de área segura, colunas úteis e quebra/alinhamento já usada na CONTA — evitando cortes laterais em impressoras 58mm e 80mm.

## Escopo (apenas `src/lib/escpos.ts` → função `buildOrderReceipt`)

1. **Colunas úteis**
   - Já usa `colsForWidth(paperWidth)` (30 cols para 58mm / 44 cols para 80mm). Manter, e passar essas colunas para todos os helpers abaixo em vez de imprimir strings brutas com `text()`.

2. **Cabeçalho "Cozinha Principal" e tipo do pedido**
   - Trocar `text('Cozinha Principal\n\n')` por `center('Cozinha Principal', cols)` (com wrap).
   - Trocar `text('* Cod. Pers./Senha: XXXX *\n')` por `center(...)`.
   - Trocar `text('${tipoPedido}\n\n')` por `center(tipoPedido, cols)` para nunca estourar em 58mm (ex.: `MESA: 001`, `DELIVERY`).

3. **Linha de data + nº do pedido**
   - Hoje: `text(\`${fmtDate(...)} Pedido No: ${orderNo}\n\n\`)`. Em 58mm (30 cols) `dd/mm/aaaa hh:mm Pedido No: XXXX` estoura.
   - Trocar por `row('Pedido Nº:', orderNo, cols)` + linha separada `text(fmtDate(...) + '\n')` (ou `rowWrap('Data:', fmtDate(...), cols)`), garantindo que nada exceda `cols`.

4. **Cliente / endereço / telefone**
   - `customerLine` pode ser longo (nome + endereço no delivery). Trocar `text('Cliente: ' + ... + '\n\n')` por `rowWrap('Cliente:', customerName, cols)` e, quando houver, imprimir endereço/telefone em linha própria também via `rowWrap` (ou `centerWrap` do texto), assim o wrap acontece dentro da área segura em vez de cortar.

5. **Itens, observações e complementos**
   - Substituir `text(\`${qty} ${item.name}\n\`)` por `rowWrap(\`${qty} ${item.name}\`, '', cols)` (valor vazio → apenas quebra o nome dentro de `cols`), preservando `CMD_BOLD_ON/OFF`.
   - Observações: `text(\`  *${item.notes}\n\`)` → `rowWrap(\`  *${item.notes}\`, '', cols)` (a função já respeita indent nas linhas quebradas).
   - Complementos: `text(\`  + ${comp.quantity}x ${comp.name}\n\`)` → `rowWrap(\`  + ${comp.quantity}x ${comp.name}\`, '', cols)` (o helper já reconhece o prefixo `  + ` para reindentar quebras).

6. **Rodapé "Atendente do Pedido"**
   - Trocar as duas linhas `text('Atendente do Pedido:\n')` e `text('${nome}\n')` por versões com `rowWrap('Atendente:', nome, cols)` (ou manter em duas linhas usando `centerWrap`/`text` limitado a `cols`), garantindo que nomes longos não cortem.

7. **Ajuste do helper `rowWrap` (se necessário)**
   - `rowWrap` atualmente reserva `priceZone(cols)` mesmo quando `value` é vazio. Ajustar para: se `value.length === 0`, usar `nameMax = cols` (sem reservar zona de preço) — assim os itens/complementos/observações usam toda a largura útil na comanda da cozinha sem alterar o comportamento na CONTA.

## Fora do escopo
- Não alterar `buildBillReceipt` nem `buildCashCloseReceipt`.
- Não mexer em `ReceiptPreview.tsx` nem em `receipt-preview.ts` (comanda da cozinha não é exibida na prévia).
- Sem mudanças de UI, RLS, banco ou outros arquivos.

## Verificação
- `bunx tsc --noEmit` e `bun run build`.
- Atualizar/estender `src/test/escpos.test.ts` com um caso 58mm de comanda contendo nome de item longo, complemento longo e cliente delivery com endereço, validando que nenhuma linha do buffer gerado excede `cols` (30 para 58mm, 44 para 80mm).
