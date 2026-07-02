## Objetivo

1. Garantir aderência total da nova paleta food (Fire Red / Vanilla Cream / Retro Green / Saffron / Russet) em todas as páginas — com foco especial no `/pdv` — seguindo padrões modernos de UX/UI para food apps.
2. Remover do sidebar: item "Diagnóstico Sync" e botão "Modo Escuro" (ThemeToggle).
3. Mover "Super Admin" do sidebar para dentro da página de Configurações (como aba/seção acessível apenas a `superadmin`).

---

## 1. Sidebar — Limpeza (`src/components/AppSidebar.tsx`, `src/components/Layout.tsx`)

- Remover o `<ThemeToggle />` do `SidebarFooter`.
- Remover o `SidebarMenuItem` do "Diagnóstico Sync".
- Remover o `SidebarMenuItem` do "Super Admin" (ele passa a viver dentro de `/configuracoes`).
- Remover imports agora não usados (`Shield`, `Activity`, `ThemeToggle`).
- Como o modo escuro deixa de ser alternável pelo usuário, forçar tema claro no boot (`src/hooks/use-theme.tsx` ou `main.tsx`): remover a classe `dark` e ignorar `localStorage.theme`. As definições `.dark` do `index.css` permanecem no arquivo (não removeremos CSS), mas nunca serão ativadas.

## 2. Super Admin dentro de Configurações (`src/pages/Configuracoes.tsx`, `src/pages/SuperAdmin.tsx`)

- Adicionar em `Configuracoes.tsx` uma nova aba "Super Admin" visível **apenas** quando `user?.role === 'superadmin'`.
- Reaproveitar o conteúdo de `SuperAdmin.tsx` extraindo-o como componente (`SuperAdminTab`) para ser renderizado dentro da aba. A rota `/:slug/admin` continua funcional (usa o mesmo componente), garantindo compatibilidade.
- Nenhuma mudança em roles, RLS ou edge functions.

## 3. Paleta consistente em toda a plataforma

Objetivo: eliminar cores hardcoded (`bg-white`, `bg-black`, `text-white`, `bg-green-*`, `bg-blue-*`, `bg-yellow-*`, `bg-red-*`, `#hex`) em todo `src/**` e trocar por tokens semânticos (`bg-background`, `bg-card`, `bg-primary`, `text-primary-foreground`, `bg-success`, `bg-warning`, `bg-destructive`, `bg-accent`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-section-vendas`, etc.).

Componentes/páginas a auditar e refatorar (varredura por `rg` de classes hardcoded):

- `src/pages/PDV.tsx` — foco principal. Aplicar padrões food-app:
  - Header do PDV: fundo `bg-card` com borda `border-border`, título `font-heading`.
  - Grid de produtos: cartões com `bg-card`, sombra `shadow-warm` no hover, preço em `text-primary` e `text-price`.
  - Botão principal (Adicionar/Finalizar): `bg-primary text-primary-foreground`, hover `hover:bg-primary/90`, radius `rounded-xl`.
  - Painel de carrinho (drawer/aside): `bg-card`, divisores `border-border`, total em destaque com `bg-gradient-warm` ou `bg-primary/10 text-primary`.
  - Estados: itens ativos com `ring-2 ring-primary`; badges de quantidade com `bg-accent text-accent-foreground`.
- `src/components/ProductCard.tsx`, `CategoryBar.tsx`, `TableBar.tsx`, `CheckoutModal.tsx`, `OrderTypeSelector.tsx`, `ItemNotesModal.tsx`, `WeightModal.tsx`, `CashRegisterReceipt.tsx`.
- Páginas: `Home.tsx`, `Mesas.tsx`, `Pedidos.tsx` (já parcialmente feito), `Entregas.tsx`, `Caixa.tsx`, `Clientes.tsx`, `Produtos.tsx`, `Estoque.tsx`, `Relatorios.tsx`, `Configuracoes.tsx`, `SuperAdmin.tsx`, `NotFound.tsx`.
- Componentes de aba: `AuditLogsTab.tsx`, `ImpressoraTab.tsx`, `MeuPerfilTab.tsx`, `SuperAdminUsersTab.tsx`.

Mapeamento padrão a aplicar:

```text
bg-white              -> bg-card  (ou bg-background em superfícies principais)
text-black            -> text-foreground
text-white (em CTA)   -> text-primary-foreground
bg-green-500/600      -> bg-success  |  bg-primary (se for CTA)
text-green-*          -> text-success  |  text-primary
bg-blue-*             -> bg-accent  |  bg-primary
bg-yellow-*           -> bg-warning
text-yellow-*         -> text-warning
bg-red-*              -> bg-destructive  |  bg-primary
border-gray-*         -> border-border
text-gray-*           -> text-muted-foreground
#2D6A4F / #40916C     -> hsl(var(--accent)) via bg-accent / text-accent
```

Padrões UX food-app a reforçar globalmente:
- Radius: `rounded-xl` em cards e botões grandes, `rounded-lg` em inputs.
- Sombras quentes: usar `shadow-warm` em CTAs e cards de destaque.
- Tipografia: títulos com `font-heading` (Bricolage Grotesque), preços com `.text-price`.
- Badges de status (pedidos, mesas, caixa): usar `success`, `warning`, `destructive`, `accent` com opacidade `/15` no fundo e `/30` na borda (mesmo padrão já aplicado em `Pedidos.tsx`).
- Estados vazios: ilustração/ícone em `text-muted-foreground`, headline `font-heading`.

## 4. Verificação

- `bun run build` para checar tipos após remoções e refactor.
- `rg -n "bg-(white|black|green-|blue-|yellow-|red-|gray-)|text-white|text-black|#[0-9a-fA-F]{6}" src` para confirmar que não há mais hardcodes fora de exceções justificadas (ex.: recibo térmico impresso, que precisa de preto puro).
- Inspeção visual do `/pdv`, `/pedidos`, `/mesas`, `/caixa`, `/configuracoes` (aba Super Admin visível só para superadmin).

## Fora de escopo

- Nenhuma alteração em schema, RLS, edge functions, rotas, lógica de negócio, testes ESC/POS ou tokens do `index.css` (paleta já definida na iteração anterior).
- Não remover o CSS `.dark` — apenas deixar de ativá-lo.
- Não alterar a página `/login` (já refatorada).
