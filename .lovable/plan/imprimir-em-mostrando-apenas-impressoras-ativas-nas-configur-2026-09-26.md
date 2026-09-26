# "Imprimir em" mostrando apenas impressoras ativas nas configurações

## Objetivo

Hoje o campo "Imprimir em" (no cadastro de produto e de categoria) lista sempre os setores fixos (Cozinha, Bar, Balcão, Recibo), mesmo quando não há nenhuma impressora configurada para eles em Configurações > Impressora. Isso permite escolher um destino que nunca imprime.

A lista passa a mostrar **somente os setores que têm uma impressora ativa configurada**, além das opções fixas "Padrão da categoria" (no produto) e "Não imprimir".

## Mudanças

1. **Fonte das opções**: usar as impressoras já carregadas de `printer_configs` (via `usePrinter().printers`, que já traz o `sector` de cada impressora salva). Cada setor com impressora configurada vira uma opção, com o nome do setor e, entre parênteses, o nome da impressora — ex.: `Cozinha (Epson TM-T20)`.
2. **Produto**: o dropdown "Imprimir em" passa a ser:
   - `Padrão da categoria (<setor da categoria>)`
   - uma opção por setor com impressora ativa
   - `Não imprimir`
3. **Categoria**: o dropdown "Imprimir em" passa a ser uma opção por setor com impressora ativa + `Não imprimir`.
4. **Valores já salvos preservados**: se um produto/categoria já estiver com um setor cuja impressora foi removida das configurações, a opção continua aparecendo (marcada como "sem impressora configurada") para não perder o valor salvo — e o usuário pode trocar.
5. **Setores personalizados**: setores criados em Configurações > Impressora (além dos fixos) passam a aparecer automaticamente na lista, desde que tenham impressora vinculada.
6. **Lista de produtos**: a coluna "Imprimir em" continua mostrando o setor resolvido; sem impressora configurada para o setor, exibe o nome do setor sem indicação de impressora.

## Detalhes técnicos

- `src/lib/print-sectors.ts`: nova função `buildSectorOptions(printers: { sector?: string; name: string }[])` que monta as opções a partir dos setores presentes em `printer_configs`, usando `sectorLabel` para os rótulos e incluindo setores customizados.
- `src/pages/Produtos.tsx`: os dois `<select>` de "Imprimir em" (produto e categoria) consomem `buildSectorOptions(usePrinter().printers)`; opção extra para valor salvo sem impressora correspondente; coluna da tabela inalterada.
- Sem mudança no banco, na impressão (`use-printer.ts`/`print-sectors.resolveItemSector`) ou na fila: setor sem impressora continua caindo na impressora de recibo, como hoje.
- Verificação: `bunx tsgo --noEmit -p tsconfig.app.json`.
