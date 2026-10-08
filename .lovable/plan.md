# Balcão: ENVIAR imprime sem fechar a janela

## Objetivo
No pedido de Balcão, o botão **ENVIAR** continua imprimindo a comanda na cozinha, mas a janela do pedido **permanece aberta**. O Balcão só é liberado (janela fecha e volta para a Home) quando o pagamento é concluído no **PAGAMENTO** — ou quando o pedido é descartado/cancelado.

## Estado atual (confirmado)
- `handleEnviarOrder` (`ConsumerOrderModal.tsx:307-350`) imprime os itens novos, salva o pedido e chama `onClose()` quando a impressão sai — no Balcão, `onClose` navega para a Home (`Balcao.tsx:46`), encerrando a sessão antes do pagamento.
- A conclusão do pagamento (`CheckoutModal` → `onComplete`, linhas 2121-2129) já fecha a janela e volta para a Home — esse caminho não muda.
- O atalho **ESC** e o botão "Enviar Pedido" do alerta de itens não enviados também chamam `handleEnviarOrder` (linhas 375 e 2083), herdando o mesmo comportamento.

## Mudanças
1. **`ConsumerOrderModal.tsx` — `handleEnviarOrder`**: quando `currentOrder.orderType === 'balcao'`, não chamar `onClose()` após imprimir. Em vez disso, mostrar aviso de sucesso ("Comanda enviada para a cozinha") e manter a janela aberta com o pedido salvo e os itens marcados como impressos. Em caso de falha de impressão, o aviso de erro na janela já existe e permanece.
2. **Mesma regra no ESC e no alerta de itens não enviados**: como ambos reutilizam `handleEnviarOrder`, o comportamento se propaga automaticamente — no Balcão, ESC com itens novos envia a comanda e permanece na janela.
3. **Mesas não mudam**: para `orderType === 'mesa'`, o ENVIAR continua fechando a janela e voltando para Mesas, como hoje.

## Detalhes técnicos
- Arquivo alterado: `src/components/consumer/ConsumerOrderModal.tsx` (apenas `handleEnviarOrder`).
- `Balcao.tsx` não precisa de alteração: `onClose` continua sendo chamado apenas pelo pagamento concluído, pelo descarte ou pelo botão Voltar.
- O botão PAGAMENTO, o bloqueio de finalização até zerar o "Falta pagar" e a liberação do Balcão após o pagamento seguem o fluxo já existente.

## Validação
- Rodar os testes automáticos existentes (`vitest`) e a checagem de tipos.
- Fluxo esperado no app: Home → Balcão → adicionar item → ENVIAR (comanda imprime, janela continua aberta) → PAGAMENTO → concluir → janela fecha, Balcão livre, valor no Caixa.
