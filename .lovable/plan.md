# Imprimir fechamento de caixa na impressora do Caixa

## Objetivo

O botão **Imprimir** do cupom de fechamento de caixa hoje só abre a janela de impressão do navegador. Ele deve enviar o cupom para a impressora configurada no setor **Caixa (recibo)** — a mesma usada nas contas dos clientes — incluindo o envio pela fila quando o aparelho que imprime é outro (host).

## Alterações

1. **Ligar o botão Imprimir à impressora configurada**
   - Em `src/components/CashRegisterReceipt.tsx`, o botão **Imprimir** passa a chamar `printCashClose` do hook `usePrinter`, enviando os dados do fechamento (abertura, fechamento, operador, fundo de troco e totais por forma de pagamento).
   - Esse caminho já resolve automaticamente: impressora do setor Caixa (recibo), largura da bobina (27/40 colunas), acentuação configurada e fila de impressão quando este aparelho não tem impressora e o host está online.

2. **Manter o navegador como alternativa**
   - Se não houver impressora configurada/disponível (resultado sem canal real de impressão), manter o comportamento atual de abrir a janela de impressão do navegador como fallback.
   - Mostrar aviso na própria janela quando a impressão falhar, em vez de falhar em silêncio.

3. **Verificação**
   - Fechar um caixa e imprimir: o cupom deve sair na impressora do setor Caixa (recibo), com acentuação e largura corretas.
   - Reimprimir um fechamento antigo pelo histórico: mesmo comportamento.
   - Tipagem, testes existentes e build.

## Detalhes técnicos

- `printCashClose` (em `src/hooks/use-printer.ts`) já existe e é usado pelo host da fila (`use-print-host.ts`); apenas o componente `CashRegisterReceipt` não o utilizava.
- Os campos de `CashRegister` correspondem ao formato `CashCloseData` esperado por `buildCashCloseReceipt`; basta acrescentar `operatorName`.
- Nenhuma alteração de banco de dados ou de layout do cupom.
