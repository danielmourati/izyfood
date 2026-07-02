# Refatoração de Design — Paleta Food & Login IzyFood

## Objetivo
1. Substituir toda a paleta atual (verde #2D6A4F) pela nova paleta food (Fire Red, Vanilla Cream, Retro Green, Saffron, Russet) com aderência aos padrões UX/UI de aplicativos de food service (iFood, Rappi, Uber Eats).
2. Substituir o carrossel de imagens no lado esquerdo da página `/login` por um bloco de conteúdo com textos criativos e persuasivos sobre os benefícios da plataforma IzyFood.

## Nova paleta (semantic tokens em HSL)

| Token | Cor | Hex | HSL |
|---|---|---|---|
| Primary (CTA, marca) | Fire Red | #D23D2D | `4 66% 50%` |
| Background base | Vanilla Cream | #F8EECB | `48 78% 88%` |
| Accent / Success | Retro Green | #31603D | `140 33% 28%` |
| Warning / Highlight | Saffron | #F5C065 | `39 88% 68%` |
| Secondary / Foreground escuro | Russet | #6E433D | `7 30% 34%` |

Aplicação semântica (padrão food app):
- `--primary`: Fire Red — botões principais, CTAs "Adicionar", "Finalizar", badges de destaque, preço em promoção.
- `--background` (app): branco quente `#FFFCF5` derivado de Vanilla Cream para não cansar em uso prolongado; Vanilla Cream puro apenas em superfícies decorativas (login, cards de destaque, hero).
- `--accent` / `--success`: Retro Green — status "pago", "finalizado", confirmações, badge de disponível.
- `--warning`: Saffron — pedidos pendentes, "segurado", alertas suaves, badge novo.
- `--secondary` / textos: Russet como tom escuro quente para foreground em modo claro (substituindo cinza-azulado atual).
- `--destructive`: mantém vermelho puro (`0 72% 51%`) — distinto do Fire Red primário para não confundir cancelar/CTA.

Dark mode: fundo `#1A0F0D` (russet quase preto), primary Fire Red mantido, accent verde levemente saturado, cream vira dourado suave para texto.

## Escopo — Passo 1: Design System

### `src/index.css`
Reescrever `:root` e `.dark` com os novos tokens HSL:
- `--background`, `--foreground`, `--card`, `--popover`
- `--primary` (Fire Red), `--primary-foreground` (Vanilla Cream)
- `--secondary` (creme suave), `--accent` (Retro Green), `--muted`
- `--destructive` (vermelho distinto), `--warning` (Saffron), `--success` (Retro Green)
- `--border`, `--input`, `--ring` (Fire Red)
- `--sidebar-*` alinhado à nova paleta
- `--login-bg` (Retro Green profundo), `--login-accent` (Saffron)
- Grupos `--section-vendas` (Fire Red), `--section-cadastros` (Retro Green), `--section-gestao` (Saffron)
- Adicionar gradientes utilitários: `--gradient-warm` (Fire Red → Saffron), `--gradient-hero` (Retro Green → Russet)
- Sombras quentes: `--shadow-warm`, `--shadow-elegant`

### `tailwind.config.ts`
- Adicionar tokens `warning`, `success` no `colors`
- Trocar fontes: `heading` passa a usar **Bricolage Grotesk** ou **Familjen Grotesk** (apelo food/orgânico), `sans` mantém Inter. Alternativa: **Fraunces** (display serifado com pegada gastronômica) + **Inter**. Vou usar **Bricolage Grotesk** (heading) + **Inter** (body) — mais moderno e legível, típico de food apps 2025.

### `index.html`
- Atualizar `<link>` do Google Fonts para carregar Bricolage Grotesk + Inter.

### Verificação de regressão visual
- Buscar hardcodes `text-white`, `bg-black`, `bg-[#...]`, classes com verde/roxo fixo nos componentes principais (`AppSidebar`, `NavLink`, `ProductCard`, `CategoryBar`, `TableBar`, `CheckoutModal`, `OrderTypeSelector`, páginas PDV/Caixa/Pedidos/Home) e substituir por tokens semânticos. Não alterar lógica de negócio.
- Cores de status (badges em `Pedidos.tsx`: `bg-blue-100`, `bg-yellow-100`, `bg-emerald-100`, `bg-red-100`) migradas para tokens semânticos (`bg-primary/10 text-primary`, `bg-warning/10 text-warning`, etc.).

## Escopo — Passo 2: Página `/login`

Substituir o `<div className="hidden lg:flex lg:w-1/2 ...">` (carrossel + controles + dots + botões prev/next) por um painel estático persuasivo:

### Estrutura do novo painel esquerdo
- Fundo: `bg-[hsl(var(--login-bg))]` (Retro Green profundo) com sutil textura/gradient warm no rodapé e um pattern SVG orgânico (círculos/blobs) em opacidade baixa em Saffron/Fire Red.
- Conteúdo em coluna:
  1. **Logo IzyFood** no topo (usa `tenantLogo` quando disponível, senão wordmark "IzyFood" em Bricolage Grotesk).
  2. **Headline principal** grande (Bricolage Grotesk, 4xl-5xl, cream): "Gestão fácil. Resultado rápido." (mantém tagline oficial).
  3. **Sub-headline**: "O sistema completo que transforma seu restaurante, lanchonete ou hamburgueria em uma máquina de vendas."
  4. **Lista de 4 benefícios** com micro-ícones (lucide) e uma linha cada — Saffron para o ícone, cream para o texto:
     - Pedidos em segundos, do balcão à mesa
     - Delivery e retirada com controle total
     - Caixa e comissões calculadas automaticamente
     - Impressão térmica direto do celular
  5. **Prova social curta**: "Feito para quem vive a rotina real de um food service."
  6. **Rodapé do painel**: badge pequeno "Multi-loja • Multi-atendente • Offline-ready".

- Remover completamente: `carouselImages`, `defaultCarouselImages`, `currentSlide`, `useEffect` do intervalo, botões prev/next, dots, o fetch de `login_carousel_images` da branding.
- Manter: fetch de `tenant_logo`, `tenant_name`, `login_icon` para uso no painel (logo) e no lado direito (ícone).

O lado direito (formulário de login) permanece inalterado funcionalmente; apenas herda os novos tokens semânticos (cores/fontes) automaticamente.

## Fora de escopo
- Nenhuma alteração de lógica de negócio, rotas, schema Supabase, RLS ou features.
- Não mexer em impressão térmica, testes ESC/POS, roles ou fluxos de pedido.
- Não remover o campo `login_carousel_images` da tabela `tenants` (apenas parar de usá-lo na UI) — sem migração.

## Ordem de execução
1. Atualizar `index.css` (tokens) + `tailwind.config.ts` (fontes/cores) + `index.html` (Google Fonts).
2. Refatorar `Login.tsx` (remover carrossel, adicionar painel persuasivo).
3. Varrer componentes e páginas por classes de cor hardcoded e trocar por tokens semânticos.
4. Rodar build e validar visualmente rota `/login` + PDV + Sidebar.
