# Destaque de tipografia, mobile e seletor de tipo de venda

## 1. Tipografia com mais destaque

Em `src/index.css`:
- Importar a família **Poppins** (600/700/800) para títulos e manter **Inter** (400/500/600) no corpo.
- Definir `--font-heading` e `--font-body` como CSS vars.
- Ajustar `body` para `font-feature-settings: "ss01", "cv11"` e `letter-spacing: -0.01em` em headings.
- Aumentar peso base: `body` em `font-medium` (500) e adicionar utilitários `.text-display`, `.text-title`, `.text-price` com tamanhos/peso fortes.

Em `tailwind.config.ts`:
- Estender `fontFamily: { heading: ['Poppins', ...], sans: ['Inter', ...] }`.
- Estender `fontSize` com escala mais marcante (ex: `display: ['2.25rem', { lineHeight: '1.1', fontWeight: '800' }]`).

Aplicar nos pontos de maior leitura:
- `ProductCard`: nome em `font-heading font-semibold text-xs` e preço em `text-sm font-extrabold` (mais legível).
- `CategoryBar`: `font-semibold tracking-wide`.
- Cabeçalhos de página (`PDV`, `Mesas`, `Caixa`, etc.) usando `font-heading`.

## 2. Melhorias para mobile

- **PDV (`src/pages/PDV.tsx`)**: aumentar área de toque dos botões do carrinho (mínimo 44px), `text-sm` no nome do produto no carrinho, espaçamento maior entre itens.
- **`ProductCard.tsx`**: em telas `<sm`, mostrar o botão `+` sempre visível (não só no hover), aumentar padding interno (`p-2`) e font do preço.
- **`CategoryBar`**: aumentar altura para `py-2.5` no mobile, `scroll-snap-x` para deslize confortável.
- **`Layout.tsx`**: header mobile mais alto (`h-16`), título em `font-heading text-base font-bold`.
- **Modais** (`CheckoutModal`, `WeightModal`, etc.): garantir `max-h-[90vh]` com scroll interno (já é regra de memória, conferir e ajustar onde faltar).
- Revisão geral: trocar `text-[10px]`/`text-[11px]` no PDV por `text-xs`/`text-sm` para melhor leitura no celular.

## 3. Seletor de tipo de venda em destaque

Hoje em `PDV.tsx` (linha ~860) os 4 tipos aparecem como botões `ghost` minúsculos `text-[10px] h-6` com emoji. Substituir por um grid de **cards-pílula** com ícone Lucide + label, mais visíveis.

Novo componente: `src/components/OrderTypeSelector.tsx`
- Recebe `value`, `onChange`, opcional `compact`.
- 4 opções com ícones Lucide:
  - **Mesa** → `Utensils`
  - **Balcão** → `Store`
  - **Delivery** → `Bike`
  - **Retirada** → `ShoppingBag`
- Layout: `grid grid-cols-4 gap-2` (desktop) / `grid-cols-2` (mobile).
- Cada item: card `rounded-xl border-2 p-2.5` com ícone (20px) acima e label `text-xs font-semibold`.
- Estado ativo: `bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]`.
- Inativo: `bg-card text-foreground border-border hover:bg-accent/10 hover:border-accent`.
- Ao clicar em "Mesa", continua acionando `setTableModalOpen(true)` (mesmo handler atual).

Integrar em `PDV.tsx`:
- Substituir o bloco do `grid grid-cols-2 gap-1` (linhas ~860-866) pelo `<OrderTypeSelector />`.
- Quando há `tableNumber`, manter o badge atual (Mesa N).
- No mobile, exibir o seletor também acima do carrinho/produtos quando não houver mesa selecionada (atualmente só aparece em desktop). Garantir compactação para não comprometer a área de produtos.

## Detalhes técnicos

- Importar Poppins via `<link>` no `index.html` (preconnect + display=swap) para evitar FOUT.
- Manter cores via tokens HSL existentes (`--primary`, `--accent`); nada hard-coded.
- Não usar toasts (regra do projeto); feedback visual já vem do estado ativo do botão.
- Nenhuma mudança de schema/DB. Sem novas dependências (Lucide já está disponível).

## Arquivos afetados

- `index.html` (fonte Poppins)
- `src/index.css` (vars de fonte, utilitários)
- `tailwind.config.ts` (fontFamily, fontSize)
- `src/components/OrderTypeSelector.tsx` (novo)
- `src/pages/PDV.tsx` (uso do seletor + ajustes mobile)
- `src/components/ProductCard.tsx` (tipografia + mobile)
- `src/components/CategoryBar.tsx` (tipografia)
- `src/components/Layout.tsx` (header mobile)
