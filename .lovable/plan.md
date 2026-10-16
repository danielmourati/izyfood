# Corrigir cobrança da taxa de serviço

## O que os dados mostram
- Configurado: Zezinho e Loja Padrão com 10%; demais lojas com 0%.
- Na tela de pagamento a taxa é cobrada certo: as mesas finalizadas no Zezinho hoje gravaram 10% (ex.: R$ 168,00 + R$ 16,80 = R$ 184,80).
- Mas as mesas abertas/seguradas não têm taxa nenhuma registrada. A taxa só é calculada dentro da tela de pagamento. Por isso:
  - a **conta impressa** antes do pagamento sai com "Taxa de Serviço: R$ 0,00" e um total sem os 10%;
  - o **total da mesa** (no pedido e no card da mesa) não mostra a taxa, e o cliente vê um valor diferente do que vai pagar.

## Correção
1. Uma regra única para calcular a taxa: só em mesa, percentual configurado pelo admin, sem contar itens marcados como "Isento da taxa de serviço" e calculada sobre o valor dos itens.
2. **Conta impressa** (e prévia): usa essa regra quando o pedido ainda não tem taxa gravada, então imprime o valor certo e o total com a taxa.
3. **Janela do pedido**: mostra o subtotal, a taxa e o total a pagar.
4. **Tela de pagamento**: continua igual, mas usando a mesma regra, para os valores sempre baterem com a conta impressa.
5. Balcão continua sem taxa. Quando o admin muda o percentual, as mesas abertas passam a usar o novo valor.

## Validação
- Testes automáticos: 10% sobre R$ 168,00 = R$ 16,80; item isento fica fora; balcão = R$ 0,00; percentual 0 = R$ 0,00; conta impressa mostra a taxa e o total certo.
- Conferir no Zezinho: conta de uma mesa aberta sai com a taxa, e o valor bate com a tela de pagamento.

## Detalhes técnicos
- Novo `computeServiceFee(order, products, percentage)` em `src/lib/utils.ts`; usado em `CheckoutModal.tsx`, `ConsumerOrderModal.tsx` (exibição e `onPrintBill`) e `use-printer.ts` `printBill` (preenche `serviceFee` quando ausente, lendo `settings.serviceFeePercentage`).
- `buildBillReceipt` mantém o uso de `bill.serviceFee`.
- Teste novo em `src/test/service-fee.test.ts`.
