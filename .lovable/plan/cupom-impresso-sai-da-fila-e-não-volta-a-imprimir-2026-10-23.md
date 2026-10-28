# Cupom impresso sai da fila e não volta a imprimir

## Objetivo
Depois que um cupom "Na fila" ou "Falhou" é impresso (automático ou "Forçar"), ele sai da fila na hora e nunca mais é impresso sozinho. Só um admin pode pedir nova impressão.

## Riscos atuais de reimpressão
1. A marcação "Impresso" é gravada uma vez só, sem conferir se deu certo. Com sinal fraco, o cupom fica "Imprimindo" e, após 60s, volta à fila e sai de novo.
2. Se a impressora demora a responder, o tempo-limite marca "Falhou" mesmo que o papel tenha saído, e a tentativa automática imprime de novo.
3. "Forçar impressão" e "Forçar todos" aceitam qualquer cupom aberto, sem checar se ele já foi impresso antes.

## O que muda
- **Marcar impresso com garantia:** após enviar à impressora, o Caixa grava "Impresso" com até 3 tentativas; o cupom é lembrado no aparelho e nunca é reenviado por ele, mesmo se a gravação falhar.
- **Sai da fila na hora:** cupom impresso é apagado da fila logo após a impressão (sem esperar a limpeza de 1 minuto) e some da tela.
- **Tempo-limite não reimprime:** se a impressora já recebeu os dados e só a resposta atrasou, o cupom é dado como impresso, não como falho.
- **Banco bloqueia repetição:** um cupom com registro de impressão não pode mais ser assumido pelo Caixa, nem voltar à fila por "Forçar"/tentativa automática.
- **Reimpressão só do admin:** novas cópias só pelo botão de reimprimir do admin (já existente), que cria um cupom novo marcado como reimpressão.

## Detalhes técnicos
- Migração: `claim_print_job` / `claim_print_job_for_host` e `force_print_jobs` passam a ignorar jobs com `printed_at IS NOT NULL`; trigger em `print_jobs` impede voltar `status` para `pending/printing/error` quando `printed_at` já existe.
- `print-queue.ts`: `markPrintJobDone` com retry e retorno de sucesso; nova `removePrintedJob(id)` que apaga o job `done`; `canAutoPrintJob`/`canForcePrintJob` retornam false se `printed_at`.
- `use-print-host.ts`: conjunto local persistido (`localStorage`, por tenant, com expiração de 24h) de jobs enviados; pular jobs nele em `enqueue`/poll; separar timeout de envio (antes dos bytes) de timeout de confirmação (depois dos bytes = impresso).
- `PrintQueuePanel.tsx`: remover cupom da lista ao virar `done`.
- Testes: `canAutoPrintJob`/`canForcePrintJob` false com `printed_at`; job enviado não é reenfileirado; retry de `markPrintJobDone`.
- Vale para todas as lojas.
