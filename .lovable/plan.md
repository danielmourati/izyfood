# Corrigir cupom "salvo em Documentos" em vez de impresso (QZ Tray / USB)

## O que está acontecendo
O aviso do Windows "O arquivo foi salvo na pasta Documentos – QZ Tray Raw Print" significa que o cupom foi mandado para uma **impressora virtual** (ex.: "Microsoft Print to PDF", "OneNote", "Fax", "XPS"), não para a térmica USB.

Causa no código de impressão via QZ Tray: quando o nome da impressora configurada não bate exatamente com o nome no Windows (ou está vazio para o setor Cozinha), o sistema pega **a primeira impressora da lista do Windows** — normalmente uma virtual em ordem alfabética. Como o envio "deu certo" do ponto de vista do QZ, a fila marca **Impresso**, mesmo sem papel sair.

## O que será corrigido
1. **Nunca mais escolher "a primeira da lista".** Ordem de escolha: impressora configurada para o setor → impressora padrão da loja → impressora padrão do Windows — sempre ignorando impressoras virtuais (PDF, XPS, OneNote, Fax, "Enviar para").
2. **Se não achar uma impressora real**, o cupom fica como **Falhou** na fila com o motivo ("Impressora 'X' não encontrada no Windows"), em vez de falso "Impresso".
3. **Fila mostra onde imprimiu**: cada cupom impresso exibe o nome da impressora usada (ex.: "Impresso · POS-80"), facilitando conferir.
4. **Aba Impressora (computador do caixa)**: aviso na tela se a impressora selecionada for virtual ou não existir mais no Windows, com lista das impressoras reais detectadas para escolher.
5. Mesma regra vale para o app de computador (instalado), não só QZ Tray.

## Detalhes técnicos
- `src/lib/printer.ts` `printViaQzTray`: novo `resolveSystemPrinter(list, preferred)` — match exato → parcial → `qz.printers.getDefault()`; filtro `isVirtualPrinter` (regex `pdf|xps|onenote|fax|send to|enviar para|document writer`); sem candidato real → `throw`. Retorna o nome usado. Aplicar também ao ramo Electron.
- `src/hooks/use-printer.ts` `sendToPrinter`: não engolir erro do QZ quando chamado com `force` pelo host (hoje cai para a janela HTML e retorna sucesso); retornar `{ ok, printerUsed }` para o host.
- `src/hooks/use-print-host.ts`: gravar a impressora usada no `markPrintJobDone` (campo `error` nulo; nome em `claimed_by` complementado ou nova coluna `printed_on text` via migração simples com a mesma RLS).
- `src/components/PrintQueuePanel.tsx`: exibir `printed_on`.
- `src/components/ImpressoraTab.tsx`: validação da impressora do sistema selecionada contra `qz.printers.find()`.
