# Acentuação definitiva nos cupons (qualquer impressora)

## Diagnóstico

- O caminho de envio está correto: o QZ Tray recebe os bytes em formato bruto (hex) e os repassa ao Windows sem alterá-los. As duas impressoras do Quintal de Casa estão com perfil Bematech, 80 mm.
- O problema está na forma como o texto é codificado: hoje todo cupom é enviado em **UTF‑8** (cada letra acentuada vira 2 bytes). Isso só funciona se a impressora estiver com a tabela UTF‑8 ativa no firmware. Na Bematech, isso depende da versão do firmware e do modo de comandos (ESC/POS ou ESC/Bema); no perfil Genérico nenhum comando de tabela é enviado. Como os dois testes falharam, a impressora claramente não interpreta UTF‑8.
- Também não há como o sistema "adivinhar" a tabela certa: o número da tabela muda entre marcas e firmwares (ex.: CP860 é a tabela 3 na Epson e 4 na Bematech).

## Solução definitiva

Parar de depender de UTF‑8 e usar **tabelas de 1 byte por caractere** (padrão das impressoras térmicas brasileiras), com uma calibração feita pela própria impressora.

1. **Novo campo por impressora: "Acentuação"**
   - Opções (cada uma define a tabela enviada e como o texto é convertido):
     - CP850 (padrão recomendado — suportada por praticamente todas as térmicas)
     - CP860 Português (índice Epson/Elgin)
     - CP860 Português (índice Bematech)
     - Windows‑1252
     - CP850 sem comando de tabela (usa a tabela de fábrica)
     - UTF‑8 (só para impressoras que suportam)
     - Sem acentos (troca "ç" por "c", "ã" por "a", etc. — funciona em 100% das impressoras)
   - Fica em Editar impressora, ao lado do Perfil ESC/POS. Novas impressoras começam em CP850.

2. **Botão "Teste de acentuação"**
   - Imprime uma única folha com todas as opções numeradas, cada uma com o texto `Ação Pão Coração Maçã Café Açaí Ônibus`.
   - Você olha qual linha saiu correta e seleciona aquela opção no cadastro. Isso resolve para qualquer marca/modelo, inclusive se a impressora for trocada no futuro.

3. **Aplicar em todos os cupons**
   - Comanda, conta, fechamento de caixa e teste passam a usar a opção escolhida, em QZ Tray/USB, Bluetooth, aplicativo desktop e fila do caixa (Host).
   - Caracteres que não existem na tabela (travessão, emoji, "º" etc.) são trocados por equivalentes simples, nunca por símbolos estranhos.
   - A prévia na tela não muda (continua correta), e as 40/27 colunas permanecem.

4. **Quintal de Casa**
   - As impressoras Caixa e Cozinha passam para CP850. Após a publicação, você imprime o Teste de acentuação uma vez e, se outra linha sair melhor, ajusta a opção.

## Validação

- Testes automáticos dos bytes gerados para cada opção (ex.: "ç" vira o byte 0x87 em CP850/CP860, "ã" vira 0xC6 em CP850 e 0x84 em CP860; "Sem acentos" gera só ASCII).
- Confirmar que cada cupom tem exatamente um comando de tabela correto no início e que as larguras de 40/27 colunas continuam iguais.
- Verificação de tipos e build.

## Detalhes técnicos

- Migração: coluna `printer_configs.char_encoding text not null default 'cp850'` (RLS já existente cobre a coluna).
- `src/lib/escpos.ts`: substituir `encodeUtf8`/`codepageCommand` por um encoder configurável (`getCharEncoding(id)` → `{ command: Uint8Array, encode(s) }`), com tabelas de mapeamento Unicode→byte para CP850, CP860 e Windows‑1252, e transliteração via `normalize('NFD')` para o modo sem acentos. Os builders recebem a codificação em vez de (ou além de) `escposProfile`.
- Novo `buildEncodingTestReceipt()` com cada linha precedida por `ESC t n` próprio e rótulo em ASCII.
- `use-printer.ts`: passar `targetPrinter.char_encoding` aos builders; novo `printEncodingTest(sector)`.
- `ImpressoraTab.tsx`: select "Acentuação" + botão de teste.
- Atualizar `AGENTS.md` (regra de codificação por impressora, substituindo a regra que vinculava a codificação ao perfil ESC/POS) e `src/test/escpos.test.ts`.
