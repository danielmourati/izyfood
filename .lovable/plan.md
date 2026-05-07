# Plano: Tela Inicial com Atalhos por Seções

## Objetivo
Antes de mostrar mesas/comandas, exibir uma **Home** após o login com atalhos dos principais módulos do sistema, agrupados por seções. A tela atual de mesas continua existindo, mas acessada via atalho "Mesas".

## Nova rota
- `/:slug` → nova página `Home.tsx` (substitui o Mesas como rota raiz).
- `/:slug/mesas` → página `Mesas.tsx` existente (movida da raiz).
- Atualizar `AppSidebar` para apontar "Início" → `/` e adicionar/manter "Mesas" → `/mesas`.
- Atualizar redirects internos relevantes (login, fallbacks) para continuar indo a `/:slug` (Home).

## Estrutura da Home
Layout responsivo, mobile-first, respeitando tipografia/cores do projeto (Poppins headings, primary #2D6A4F).

Seções com título em uppercase + grid de cards com ícone + label:

1. **Vendas**
   - Mesa → `/mesas`
   - Balcão → `/pdv?tipo=balcao`
   - Delivery → `/pdv?tipo=delivery`
   - Retirada → `/pdv?tipo=retirada`
   - Pedidos → `/pedidos`
   - Entregas → `/entregas`
   - Caixa → `/caixa`

2. **Cadastros** (admin / por permissão)
   - Produtos → `/produtos`
   - Estoque → `/estoque`
   - Clientes → `/clientes`

3. **Gestão** (admin)
   - Relatórios → `/relatorios`
   - Configurações → `/configuracoes`

Cada card: botão grande (mín. 96px), ícone Lucide (28px), label em `font-heading font-bold`, borda 2px, hover `border-primary` + `bg-primary text-primary-foreground`, `active:scale-95`. Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`.

Filtragem por permissão usando `useAuth().isAdmin` + `useAttendantPermissions()` (mesmo padrão das rotas em `App.tsx`): esconder cards aos quais o usuário não tem acesso.

## Componente reutilizável
`ShortcutCard` interno em `Home.tsx` (ícone, label, onClick) — evita duplicação visual.

## Arquivos
- **Novo**: `src/pages/Home.tsx`
- **Editar**: `src/App.tsx` (adicionar rota `/mesas`, trocar rota raiz para `Home`)
- **Editar**: `src/components/AppSidebar.tsx` (adicionar item "Mesas", manter "Início" apontando para raiz)
- **Editar (opcional)**: `src/pages/Mesas.tsx` — remover bloco "Nova venda" (agora redundante na Home), mantendo só a listagem de mesas.

## Detalhes técnicos
- Navegação via `useTenantNavigate` para preservar slug.
- Ícones: `Utensils, Store, Bike, ShoppingBag, ClipboardList, Truck, DollarSign, Package, Boxes, Users, BarChart3, Settings`.
- Sem alterações de banco/RLS.
