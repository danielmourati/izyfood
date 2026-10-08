# Corrigir pedidos que não imprimem (o teste imprime)

## O que foi encontrado
- O botão de teste imprime com "força total": ignora a chave "Usar impressora neste dispositivo" e qualquer verificação. Os pedidos passam por essas verificações e podem ser descartados em silêncio.
- No fluxo das Mesas, quando o pedido é bloqueado (chave desligada, impressora não detectada ainda, QZ Tray reconectando), o sistema não avisa nada e **marca os itens como "Impresso" mesmo assim** — por isso parece que foi enviado.
- Nenhum pedido chegou à fila do Caixa (só existe 1 conta antiga lá), ou seja, os pedidos nem foram para a fila.
- As duas impressoras da loja (Caixa e Cozinha) estão sem "padrão" marcado, e a verificação "existe impressora disponível?" depende da impressora padrão — isso pode fazer o sistema achar que não há impressora mesmo com o QZ Tray conectado.
- Se o envio ao QZ Tray falha num pedido normal, o erro é engolido e abre só a visualização no navegador.

## O que vai mudar
1. **Mesma rota do teste para os pedidos**: se este aparelho tem impressora conectada (QZ Tray/USB ou Bluetooth), o pedido imprime nela, como o teste.
2. **Detecção de impressora corrigida**: considera as impressoras do setor (Cozinha/Caixa) e não só a "padrão"; com QZ Tray conectado e impressora cadastrada, conta como disponível.
3. **Antes de imprimir, tenta reconectar o QZ Tray** (como o teste faz ao abrir a tela), em vez de desistir.
4. **Itens só ficam "Impresso" se saiu de fato** (ou foram para a fila do Caixa). Se falhar, ficam como não impressos e aparece aviso na própria janela da mesa com o motivo e a prévia do cupom (sem notificações flutuantes).
5. **Erros do QZ Tray aparecem** com o motivo, em vez de abrir a visualização silenciosamente.

## Detalhes técnicos
- `src/hooks/use-printer.ts`: `hasPrinterAvailable` passa a considerar `printers.some(p => system/network)` + `qzConnected`, não só `defaultPrinter`; `printOrder/printBill` chamam `retryQzConnection` quando não conectado; `sendToPrinter` retorna o canal usado (`bluetooth|qz|html|disabled`) e propaga erro do QZ; `PrintResult` inclui `printed`.
- `src/pages/Mesas.tsx` `handlePrintConsumerKitchen`: retorna o `PrintResult` (hoje é descartado).
- `src/components/consumer/ConsumerOrderModal.tsx`: só marca `printed: true` quando `ok && (printed || queued)`; senão mostra `printNotice` / `PrintPreviewModal`.
- `src/pages/PDV.tsx`: mesmo tratamento no envio.
- Verificação: testes existentes + Playwright no fluxo de enviar mesa conferindo o aviso; teste físico pelo usuário no computador do caixa.
