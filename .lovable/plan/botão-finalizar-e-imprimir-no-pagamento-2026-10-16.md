# Botão "Finalizar e Imprimir" no pagamento

## O que muda
- Ao lado de **FINALIZAR VENDA**, novo botão **FINALIZAR E IMPRIMIR** (celular e computador).
- Mesmas travas do botão atual: fica bloqueado com caixa fechado, enquanto "Falta pagar" não zerar e durante a finalização.
- Ao tocar: finaliza a venda normalmente e imprime o comprovante na impressora do Caixa (recibo), listando cada forma de pagamento com valor (ex.: PIX R$ 30,00, Dinheiro R$ 20,00, Cartão Crédito R$ 15,00), troco quando houver, desconto e taxa de serviço.
- Se a impressão falhar, a venda continua finalizada e aparece aviso na própria tela com a prévia do cupom (sem notificações flutuantes).

## Detalhes técnicos
- `CheckoutModal.tsx`: `handleFinalize(printAfter = false)`; montar `finalOrder` com `paymentSplits` antes de `completeSale`; se `printAfter`, chamar `usePrinter().printBill(finalOrder)` (já imprime `paymentSplits` em `buildBillReceipt`, com subtipos de cartão vindos de `notes`).
- Botão secundário com ícone Printer nos dois rodapés (linhas ~819 e ~1426), mesmo `disabled`.
- Fechar o modal só após a tentativa de impressão; em falha, exibir mensagem/prévia antes de `onComplete`.
- Teste: cupom de conta com duas parcelas lista ambas as formas e valores.
