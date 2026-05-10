## Objetivo

Permitir que o usuário acrescente **observações** e **complementos** a um item já lançado no carrinho do PDV, tanto no desktop quanto no mobile, reaproveitando o `ItemNotesModal` que já existe (já está plugado via `setEditingItemNotesId`, só falta o gatilho na UI do item).

## Onde o botão vai aparecer

Cada linha de item do carrinho em `src/pages/PDV.tsx` → componente `CartContent` (renderização única que serve mobile e desktop, por volta das linhas 955–1010).

Hoje cada item tem:
- À direita: ícone "lixeira" (excluir) no topo + subtotal embaixo.
- Abaixo: stepper de quantidade (− qty +).

Vamos acrescentar um botão "Observações / Complementos" ao lado do botão excluir, com tratamento responsivo:

```text
Mobile (< 1024px) — minimalista, só ícone
┌──────────────────────────────────────────────┐
│ Açaí 500g                          [📝] [🗑] │
│ Obs: sem leite condensado                    │
│ [− 1 +]                          R$ 25,00    │
└──────────────────────────────────────────────┘

Desktop (≥ 1024px) — botão com rótulo curto
┌──────────────────────────────────────────────┐
│ Açaí 500g           [📝 Obs/Compl.]   [🗑]   │
│ Obs: sem leite condensado                    │
│ [− 1 +]                          R$ 25,00    │
└──────────────────────────────────────────────┘
```

- **Mobile**: `Button variant="ghost" size="icon"` com ícone `FileEdit` (lucide), 28×28, cor neutra com hover sutil. Fica imediatamente à esquerda da lixeira para manter padrão "ações do item agrupadas".
- **Desktop**: mesmo botão, mas com rótulo "Obs/Compl." visível usando a classe `hidden lg:inline` no texto (o ícone permanece sempre visível). Assim usamos **um único componente** com comportamento responsivo via Tailwind, sem duplicar código.
- Indicador visual quando o item já tem observação ou complemento: ícone ganha cor `text-primary` e um pequeno `dot` (ponto colorido) no canto, para o usuário saber rapidamente que aquele item já foi customizado.

Acessibilidade: `aria-label="Observações e complementos"` e `title` no botão.

## Comportamento

- Ao clicar: chama `setEditingItemNotesId(item.id)` (prop já passada para `CartContent`).
- O `ItemNotesModal` já existente abre, já carrega observações pré-cadastradas filtradas pela categoria do produto, e os complementos da categoria. O usuário pode marcar tags, digitar "outras observações" e ajustar quantidade dos complementos.
- Ao confirmar, o `handleConfirmNotes` (já implementado, linha ~156) atualiza `notes`, `selectedComplements` e recalcula `subtotal`.
- O auto-save com debounce de 500ms já persiste a alteração no pedido.

## Regra de bloqueio (consistência com o sistema)

- Se o item já estiver `printed: true` (já enviado para a cozinha), **desabilitar** o botão (igual ao que já é feito com o stepper de quantidade nas linhas 992/1002). Isso evita que observações sejam alteradas após o envio sem rastreabilidade.
- O botão excluir continua com a proteção atual (`handleProtectedRemove`), nada muda nele.

## Detalhes técnicos

Arquivo único alterado: **`src/pages/PDV.tsx`**, dentro de `CartContent` (~linha 978).

- Importar `FileEdit` de `lucide-react` (já existe `import { ... } from 'lucide-react'`).
- No bloco `<div className="flex flex-col items-end shrink-0 ...">`, transformar o topo em um pequeno cluster horizontal com 2 botões:
  - Botão "Obs/Compl." (novo) → `onClick={() => setEditingItemNotesId?.(item.id)}`, `disabled={item.printed}`.
  - Botão lixeira (existente).
- Marcador "tem customização": `const hasCustom = !!item.notes || (item.selectedComplements?.length ?? 0) > 0;` para alterar a cor do ícone e mostrar um `span` ponto.

Nada muda no `ItemNotesModal.tsx`, no schema do banco, nem na lógica de cálculo — toda a infraestrutura já existe.

## Fora do escopo

- Não alterar fluxo de impressão.
- Não criar um modal novo no desktop: o `ItemNotesModal` atual já é responsivo (`sm:max-w-md sm:mx-auto sm:border-x sm:shadow-2xl`) e funciona bem como modal centralizado em telas grandes e como bottom sheet em mobile.
- Não mexer no botão "+" do produto (adicionar ao carrinho com observações já no momento da inclusão fica como melhoria futura, se desejado).
