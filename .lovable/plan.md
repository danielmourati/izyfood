# Plano: Cores por seção na Home

## Objetivo
Dar identidade visual a cada seção de atalhos da Home (`src/pages/Home.tsx`) usando cores distintas, mantendo coerência com a paleta atual (verde primário) e boa legibilidade em light/dark mode.

## Paleta proposta (tom suave no card, cor cheia no hover/ícone)

| Seção | Cor base | Uso |
|---|---|---|
| **Vendas** | Verde (primary `#2D6A4F`) | Identidade principal — operação |
| **Cadastros** | Azul (`#2563EB`) | Dados/registros |
| **Gestão** | Âmbar/Laranja (`#D97706`) | Análise/administração |

Cada seção terá:
- **Título**: pequena barra/ponto colorido + texto da cor da seção
- **Card (estado normal)**: fundo `card`, borda 2px na cor da seção em opacidade baixa (~30%), ícone na cor da seção
- **Card (hover)**: borda cheia + fundo cheio na cor da seção + texto/ícone branco
- **Active**: `scale-95` (mantém)

## Implementação

### 1. Tokens de cor em `src/index.css`
Adicionar variáveis HSL semânticas para light e dark:
```css
--section-vendas: 152 55% 32%;        /* verde */
--section-vendas-soft: 152 45% 92%;
--section-cadastros: 217 91% 55%;     /* azul */
--section-cadastros-soft: 217 90% 95%;
--section-gestao: 32 95% 44%;         /* âmbar */
--section-gestao-soft: 38 95% 92%;
```
Versões dark com `*-soft` mais escuras (ex.: `… 18%`).

### 2. Mapear no `tailwind.config.ts`
```ts
colors: {
  section: {
    vendas: 'hsl(var(--section-vendas))',
    'vendas-soft': 'hsl(var(--section-vendas-soft))',
    cadastros: 'hsl(var(--section-cadastros))',
    'cadastros-soft': 'hsl(var(--section-cadastros-soft))',
    gestao: 'hsl(var(--section-gestao))',
    'gestao-soft': 'hsl(var(--section-gestao-soft))',
  }
}
```

### 3. Atualizar `src/pages/Home.tsx`
- Adicionar `color: 'vendas' | 'cadastros' | 'gestao'` em cada `Section`.
- Mapa de classes (não dinâmicas para o Tailwind detectar):
```ts
const sectionStyles = {
  vendas:    { dot: 'bg-section-vendas',    title: 'text-section-vendas',    card: 'border-section-vendas/30 hover:border-section-vendas hover:bg-section-vendas',    icon: 'text-section-vendas group-hover:text-white' },
  cadastros: { dot: 'bg-section-cadastros', title: 'text-section-cadastros', card: 'border-section-cadastros/30 hover:border-section-cadastros hover:bg-section-cadastros', icon: 'text-section-cadastros group-hover:text-white' },
  gestao:    { dot: 'bg-section-gestao',    title: 'text-section-gestao',    card: 'border-section-gestao/30 hover:border-section-gestao hover:bg-section-gestao',       icon: 'text-section-gestao group-hover:text-white' },
};
```
- `ShortcutCard` recebe `color` e aplica as classes.
- Título da seção: `<span className="inline-block w-2 h-2 rounded-full {dot}" />` ao lado do label, label em cor temática (mantendo uppercase).

### 4. Acessibilidade
- Garantir contraste AA: hover usa fundo cheio + texto branco (`text-white`).
- No dark mode, `*-soft` fica escuro o suficiente para o ícone colorido continuar visível.

## Arquivos
- Editar: `src/index.css` (tokens)
- Editar: `tailwind.config.ts` (cores `section.*`)
- Editar: `src/pages/Home.tsx` (mapa + props no card e título)

## Fora de escopo
- Sidebar, PDV e demais páginas continuam com a paleta verde atual.
