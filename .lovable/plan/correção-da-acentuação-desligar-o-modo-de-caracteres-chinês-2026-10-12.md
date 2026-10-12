# Correção da acentuação: desligar o modo de caracteres chinês da impressora

## O que a foto mostrou
- Todas as linhas do teste ampliado (ESC t 7 até 17) saíram **idênticas**: "AU MadCaf" no lugar de "Ação Maçã Café Ç Ã É".
- Se a impressora estivesse trocando de tabela, cada linha sairia diferente. Como todas saem iguais, ela está **ignorando o comando de tabela**.
- O padrão do erro (cada letra acentuada "come" o caractere seguinte, e Ç/Ã/É do final somem) é típico de impressoras térmicas genéricas de fabricação chinesa que vêm de fábrica no **modo de caracteres chinês** (2 bytes por letra). Nesse modo, cada letra acentuada é lida junto com a letra seguinte como um único ideograma, e qualquer tabela escolhida é ignorada.
- O comando de reinicialização enviado no início de cada cupom pode reativar esse modo, então ele precisa ser desligado em todos os cupons.
- A causa é muito provável, mas **só fica confirmada no papel**. Por isso o novo teste compara as duas situações lado a lado.

## Correção
1. **Desligar o modo chinês em todos os cupons**: enviar o comando "cancelar modo chinês/kanji" logo após cada reinicialização e antes da tabela de caracteres, em comanda da cozinha, conta, fechamento de caixa, teste e confirmação. Vale para QZ Tray, Bluetooth, aplicativo desktop e fila do Caixa. Esse comando é ignorado com segurança por impressoras que não têm esse modo (Epson, Bematech etc.).
2. **Novo teste de acentuação comparativo**: no topo da folha, imprimir a mesma frase em CP850 duas vezes, **"A) sem desligar modo chinês"** e **"B) desligando modo chinês"**, seguidas das opções numeradas já existentes (agora todas com o modo desligado). Se a linha B sair correta, a causa fica confirmada e basta manter CP850.
3. **Prévia na tela**: garantir que o novo comando não apareça como um "." na prévia dos cupons.
4. **Sem mudar nada que já funciona**: colunas (32/16 em 55/58 mm, 40/20 em 80 mm), layout, setores, fila e calibração salva por impressora continuam iguais. UTF-8 nativo não recebe o comando.

## Depois de publicar
- Imprimir o teste em Configurações > Impressoras e enviar uma foto.
- Se a linha B sair correta: deixar a Cozinha e o Recibo do Pastelão Sousa em CP850 e confirmar com "Confirmar configuração salva".
- Se A e B saírem iguais e erradas: o problema está no driver do Windows instalado para a impressora (por exemplo, driver "Somente texto"), e precisaremos da marca/modelo e do nome do driver para o próximo passo.

## Detalhes técnicos
- `src/lib/escpos-encoding.ts`: `CharEncoding` ganha um prefixo `FS .` (`0x1C 0x2E`) para todas as tabelas de 1 byte e para "Sem acentos"; `utf8` fica sem prefixo. Expor helper `encodingSetupCommand(enc)` = `FS .` + `ESC t n`.
- `src/lib/escpos.ts`: substituir `codepageCommand` nos três builders e nas amostras de teste/confirmação por `encodingSetupCommand`, sempre depois de cada `CMD_INIT`; adicionar as linhas comparativas A/B no `buildEncodingTestReceipt` (padrão e ampliado).
- `src/lib/receipt-renderer.ts`: tratar `0x1C` como prefixo de comando (`FS .`, `FS &`, `FS C n`) e não renderizar seus bytes.
- Testes em `src/test/encoding-calibration.test.ts`: cada cupom contém `28,46` seguido de `27,116,n` após cada `27,64`; utf8 não contém `28,46`; a amostra A não tem o comando e a B tem; prévia sem "." extra; contagem de resets atualizada; larguras inalteradas.
- Atualizar a regra de codificação no `AGENTS.md` (todo cupom de 1 byte cancela o modo multibyte antes de selecionar a tabela).
