# Permissões dos atendentes, fechamento de mesas e observações no mobile

## 1. Atendente com todas as permissões = mesmos poderes do admin
- Hoje o botão **PAGAR** e a 5ª coluna do rodapé do pedido aparecem só para admin (verificação fixa de cargo), por isso o atendente não recebe pagamentos mesmo com tudo marcado.
- Trocar essas verificações por permissões: PAGAR/COBRAR liberado para admin ou atendente com permissão de caixa (`manage_cash`).
- Regra geral: quando o atendente tiver **todas** as permissões marcadas, ele passa a ser tratado como admin no pedido (pagar, fechar, reabrir, cancelar, remover itens sem senha de admin).
- Revisar os demais pontos da tela de pedidos/pagamento que checam só "é admin" e aplicar a mesma regra.

## 2. Fechar/reabrir mesa para atendentes
- Liberar o botão Fechar/Reabrir (bloqueio da mesa) e as opções de fechamento no menu da mesa para atendentes com permissão de **Salão** (`manage_tables`), no celular e no computador.

## 3. Observações do pedido no celular
- Na tela do pedido no celular, adicionar um campo de **Observações do pedido** com várias linhas (texto livre), salvo automaticamente no pedido.
- Mostrar as observações na revisão do pedido (já exibido) e incluí-las na **comanda da cozinha**, em fonte dupla, ao final dos itens — também na prévia.

## Validação
- Logar como atendente com todas as permissões: conseguir pagar, fechar e reabrir mesa.
- Atendente sem `manage_cash` não vê PAGAR; sem `manage_tables` não fecha mesa.
- No celular, escrever observações em várias linhas, enviar e conferir no cupom da cozinha (58 e 80 mm).
- Rodar os testes de impressão.

## Detalhes técnicos
- `ConsumerOrderModal.tsx`: criar `hasAllPermissions = PERMISSION_KEYS.every(k => permissions[k])`, `effectiveAdmin = isAdmin || hasAllPermissions`, `canReceivePayment = effectiveAdmin || permissions.manage_cash`; substituir `isAdmin` nas linhas do rodapé (≈1157, 1218) e nos gates de fechamento.
- Expor `hasAllPermissions` em `useAttendantPermissions` para reuso (CheckoutModal, Mesas).
- Observações gravadas em `orders.pickup_notes` (campo já usado pelo desktop); adicionar `<Textarea>` no fluxo mobile.
- `escpos.ts` (`buildOrderReceipt`) e `receipt-preview.ts`: imprimir bloco `OBS:` com `pickupNotes` quebrado pela regra de colunas; passar o campo em `use-printer.ts`. Adicionar teste.
