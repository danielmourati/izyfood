# Comandas do celular marcadas como "Impresso" sem sair no papel (Zezinho)

## O que foi encontrado
- Os cupons do celular chegam ao Caixa: todos os 11 cupons de hoje aparecem como **Impresso**, assumidos pelo "Computador" do Caixa.
- As **contas** saem de verdade (aparecem com a impressora "Caixa" registrada). As **comandas** não têm impressora registrada: elas não chegaram a ser enviadas ao papel.
- Causa: a proteção contra reimpressão, criada na correção anterior, roda também no Caixa. O Caixa procura na fila se aqueles itens "já foram enviados" e encontra **o próprio cupom que está imprimindo**. Ele conclui que tudo já saiu, pula a impressão e marca o cupom como Impresso.
- Observação extra: as duas impressoras do Zezinho se chamam "Cozinha" (uma é o setor Caixa/recibo) e as duas apontam para a mesma impressora do Windows ("Caixa"). Isso não causa o problema, mas confunde a tela.

## O que vai mudar
1. A proteção contra reimpressão roda só em quem **envia** a comanda (celular ou computador do atendente). O Caixa imprime o que recebeu da fila sem checar de novo.
2. O Caixa só marca uma comanda como **Impresso** quando ela realmente saiu na impressora. Se nada for enviado, ela fica como **Falhou** com o motivo.
3. Reenviar as comandas de hoje do Zezinho que ficaram como "Impresso" sem sair, apenas das mesas ainda abertas (vou listar antes para você confirmar).
4. Renomear a impressora do setor Caixa no Zezinho para "Caixa", se você concordar.

## Detalhes técnicos
- `use-printer.ts` `printOrder`: pular `fetchAlreadySentItemIds/excludeAlreadySent` quando `options.force` (chamada do host); o filtro continua antes de `enqueuePrintJob`.
- `printed-guard.ts`: aceitar `excludeJobId` para ignorar o job atual (defesa extra).
- `use-print-host.ts`: se `printJob` retornar canal diferente de `qz`/`bluetooth`, `markPrintJobError` em vez de `markPrintJobDone`.
- Teste em `src/test/printed-guard.test.ts`: o job atual não conta como "já enviado".
