## Objetivo
Ajustar o modal de Observações/Complementos (`ItemNotesModal`) para exibir as observações em lista vertical com checkbox, e garantir que o texto do campo "Outras observações" seja preservado e renderizado no cupom da cozinha.

## Escopo

### 1. `src/components/ItemNotesModal.tsx` — Layout vertical com checkbox

- Substituir o container atual das observações (`flex flex-wrap gap-2` com `<button>` estilizados) por uma lista **vertical** (`flex flex-col`).
- Cada item da lista vira uma linha clicável contendo:
  - `Checkbox` (shadcn `@/components/ui/checkbox`) alinhado à esquerda
  - Label com o nome da observação (`obs.name`) ao lado
  - Toda a linha continua clicável (`onClick` chama `toggleObs`) e o checkbox reflete `selectedObs.includes(obs.name)`
- Manter o input "Outras observações..." logo abaixo da lista (sem alterações no comportamento do input).
- Não alterar a seção de Complementos.

### 2. `src/components/ItemNotesModal.tsx` — Corrigir persistência de "Outras observações"

Problema atual: no `useEffect` que reabre o modal, o parser divide `item.notes` por `|`, e qualquer trecho que não seja uma observação pré-definida cai em `others`. Isso funciona na primeira edição, mas o texto salvo em `finalNotesString` usa `' | '` como separador, e ao reabrir tudo é remontado — porém há dois pontos frágeis:

- Se o usuário digitar texto contendo `|`, ele é fragmentado.
- Se uma observação pré-definida for renomeada/removida depois, ela reaparece como "outras".

Ajuste mínimo (sem mudar estrutura de dados):
- Serializar como hoje (`selectedObs.join(' | ') + ' | ' + otherNotes`), mas ao reparsear, tratar como "outras" tudo que não bater exatamente com uma observação ativa e não começar com `+`. Manter comportamento atual.
- Garantir que `otherNotes.trim()` seja incluído mesmo quando `selectedObs` estiver vazio (já está — validar).

### 3. `src/lib/escpos.ts` — Renderizar "Outras observações" no cupom da cozinha

Hoje `buildOrderReceipt` imprime `item.notes` em uma única linha:
```
if (item.notes) parts.push(rowWrap(`  *${item.notes}`, '', cols));
```
Isso concatena tudo separado por ` | `, o que na prática funciona, mas visualmente fica ruim e o texto livre pode ser truncado/misturado com as observações fixas.

Ajuste:
- Dividir `item.notes` por ` | ` e imprimir **uma linha por observação**, cada uma prefixada por `  * `, usando `rowWrap(..., '', cols)` para respeitar a largura útil (30 cols em 58mm, 44 em 80mm).
- Isso garante que o texto de "Outras observações" apareça em sua própria linha, sem risco de ficar cortado no meio da lista.

## Fora do escopo
- Não alterar a lógica/aparência da seção de Complementos.
- Não alterar `buildBillReceipt`, `buildCashCloseReceipt`, `receipt-preview.ts` nem `ReceiptPreview.tsx`.
- Sem mudanças em RLS, banco de dados, tipos ou StoreContext.

## Verificação
- `bunx tsgo --noEmit` e `bun run build`.
- Estender `src/test/escpos.test.ts` com um caso de comanda 58mm em que `item.notes = "Sem cebola | Sem farofa | tirar tudo e mandar extra"`, validando que cada trecho é impresso em sua própria linha com prefixo `  * ` e sem exceder `cols`.
- Verificação visual: abrir modal de observações no PDV, marcar/desmarcar via checkbox, digitar em "Outras observações", confirmar, reabrir para verificar persistência, imprimir comanda da cozinha e conferir as linhas.