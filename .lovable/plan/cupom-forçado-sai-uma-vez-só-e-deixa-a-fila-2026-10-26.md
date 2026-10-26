# Cupom forçado sai uma vez só e deixa a fila

## Objetivo
Qualquer cupom "Na fila" ou "Falhou" que for forçado (individual ou "Forçar todos") imprime no máximo uma vez e sai da fila na hora. Nova cópia só por reimpressão pedida pelo admin.

## Brechas encontradas hoje
1. Se o Caixa imprime mas a gravação de "Impresso" falha (sinal fraco), o cupom fica "Imprimindo"; depois de 60s ele volta a ser elegível e sai de novo.
2. "Forçar" aceita cupons "Imprimindo" há mais de 60s — que podem já ter saído no papel.
3. Duas pessoas tocando "Forçar todos" ao mesmo tempo, ou o aviso em tempo real + a conferência de 10s, podem colocar o mesmo cupom duas vezes na lista do Caixa.
4. A marca local "já enviado" só é gravada depois da impressão; se a página recarregar no meio, o cupom pode repetir.

## O que muda
- **Marca antes de imprimir:** o Caixa grava no aparelho "enviado" no instante em que manda para a impressora, antes de esperar resposta. Recarregar a página não repete.
- **"Impresso" insistente:** se gravar "Impresso" falhar, o Caixa tenta de novo (até conseguir) em vez de deixar o cupom parado em "Imprimindo".
- **Imprimindo travado não reimprime sozinho:** um cupom que já foi entregue a um Caixa e travou passa a sair da fila como "Impresso (provável)" em vez de voltar para a fila. Forçar não o reenvia mais.
- **Forçar uma vez só:** o banco ignora "forçar" para cupom que já está sendo impresso ou que foi forçado há poucos segundos; a lista interna do Caixa não aceita o mesmo cupom duas vezes.
- **Saída imediata da tela:** ao confirmar a impressão, a Fila remove o cupom na hora em todos os aparelhos.
- **Reimpressão do admin** continua criando um cupom novo, sem afetar o antigo.

## Detalhes técnicos
- Migração: `force_print_jobs` passa a aceitar só `pending`/`error` com `printed_at IS NULL` e `updated_at < now() - 5s`; nova função `finalize_stale_printing_jobs()` (chamada no poll do host e no purge) marca `printing` com `claimed_at` > 60s como `done` com `printed_on = 'provável'`; `claim_print_job` deixa de reassumir `printing` vencido.
- `use-print-host.ts`: `markJobSent(jobId)` antes de `printJob`; `markPrintJobDone` com retry (backoff 2s/5s/10s, persistente em localStorage para reenviar no próximo poll); dedupe por `Set` de ids em processamento além de `queueRef`.
- `print-queue.ts`: `canForcePrintJob` remove o caso `printing` vencido; `canAutoPrintJob` idem.
- `PrintQueuePanel.tsx`: remoção otimista ao receber `done` via realtime.
- Testes: atualizar `print-queue-stale.test.ts` (printing vencido não é forçável/automático) e novo teste de retry de `markPrintJobDone` e de marca local antes da impressão.
- Registrar decisão no `AGENTS.md` (substituir a regra de retry de falhas).
