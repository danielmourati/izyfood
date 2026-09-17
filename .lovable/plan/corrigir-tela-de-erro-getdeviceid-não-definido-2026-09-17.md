# Corrigir tela de erro: getDeviceId não definido

## Problema
A tela de Configurações > Impressora quebra com `ReferenceError: getDeviceId is not defined`. Confirmado por leitura do código: `src/hooks/use-printer.ts` usa `getDeviceId()` na linha 199 (presença do host), mas a função não está na lista de importações de `@/lib/printer` (linhas 5-31), onde ela é exportada.

## Correção
Adicionar `getDeviceId` ao bloco de importações de `@/lib/printer` em `src/hooks/use-printer.ts`.

## Verificação
- Rodar `bunx tsgo --noEmit -p tsconfig.app.json` para garantir que não há outros usos sem importação.
- A tela de Configurações > Impressora volta a abrir normalmente.

## Detalhes técnicos
- Arquivo alterado: `src/hooks/use-printer.ts` (1 linha de import).
- Nenhuma mudança de comportamento ou layout.
