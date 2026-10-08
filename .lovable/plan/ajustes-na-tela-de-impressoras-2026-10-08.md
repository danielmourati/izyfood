# Ajustes na tela de Impressoras

## 1. "Usar impressora neste dispositivo" só no celular
- Em computadores, a chave some e a impressão fica **sempre ativa** para as impressoras configuradas (QZ Tray/USB).
- No celular/tablet nada muda: a chave continua lá, desligada por padrão.

## 2. Gerenciar os locais de impressão (Caixa, Cozinha, Bar, Balcão e personalizados)
Cada cartão da lista à esquerda ganha um menu (⋮) com:
- **Renomear**: muda o nome exibido do local (ex.: "Bar" → "Bar da Piscina"). O código interno do setor não muda, então produtos e categorias continuam apontando para ele.
- **Excluir**: remove o local e a impressora vinculada. Pede confirmação na própria janela e avisa quantos produtos/categorias usam esse setor (eles passam a imprimir na Cozinha).
- O **Caixa (recibo)** não pode ser excluído, só renomeado.
- Locais excluídos e nomes renomeados ficam salvos para a loja (valem em todos os aparelhos).

## 3. Remover "Imprimir e aceitar pedidos automaticamente"
- O cartão some do formulário da impressora. O valor já salvo fica sem uso, sem afetar a impressão.

## Detalhes técnicos
- `src/hooks/use-printer.ts`: `enablePrinterDevice` efetivo = `!isMobileDevice() || getEnablePrinterDevice()`; reflete em `hasPrinterAvailable`, `sendToPrinter` e nos `print*`.
- `src/components/ImpressoraTab.tsx`: Card da chave renderizado apenas quando `isMobileDevice()`; o bloco Bluetooth passa a aparecer também no desktop; remove o bloco `auto-print-switch` (salvamento mantém `auto_connect_qz` como está).
- Locais: lista = setores padrão + setores vindos de `printer_configs` + personalizados, menos os ocultos. Nomes e ocultos salvos em `store_settings.print_settings` (`sectorNames: Record<string,string>`, `hiddenSectors: string[]`) — sem migração (coluna jsonb existente).
- Renomear: atualiza `sectorNames[key]` e o `name` da linha em `printer_configs`, se houver.
- Excluir: `delete` em `printer_configs` onde `sector = key` do tenant + adiciona a `hiddenSectors` (padrão) ou remove dos personalizados; `recibo` bloqueado. Confirmação via `AlertDialog`, sem toast.
- Menu ⋮ com `DropdownMenu`; renomear em `Dialog` com `Input`.
