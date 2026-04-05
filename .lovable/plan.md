

# Plano: Redesign UX/UI inspirado na referência

## Resumo
Redesenhar a interface do sistema seguindo o layout da imagem de referência (CHILI POS): sidebar clean com logo, PDV com categorias horizontais com ícones, grid de produtos com cards visuais (imagens), painel lateral de carrinho com resumo e pagamento. O admin poderá customizar apenas nome do estabelecimento e logotipo via Configurações — sem customização de cores.

---

## O que muda visualmente

**Sidebar** — Exibir logo do tenant no topo (carregada do campo `tenants.logo`). Manter navegação atual mas com visual mais limpo e espaçado, ícones menores, texto mais suave.

**PDV (tela principal)** — Layout inspirado na referência:
- Barra de busca no topo
- Categorias horizontais com ícones circulares + nome + contagem de itens
- Grid de produtos em cards com: imagem do produto (ou placeholder com inicial da categoria), nome, preço, e botão "Adicionar"
- Painel lateral direito (carrinho) mostrando itens com imagem miniatura, nome, preço unitário, quantidade, subtotal, taxa, total e botões de pagamento
- Barra inferior mostrando mesas ocupadas com badges (como na referência: T1, T2, T3...)

**Login** — Logo do tenant carregada dinamicamente (quando disponível via slug na URL).

**Paleta de cores** — Atualizar o `index.css` para usar tons de verde como na referência (verde escuro primary, verde claro accent), mantendo light/dark mode.

---

## Customização pelo Admin

Na aba "Geral" das Configurações, adicionar:
- Campo **Nome do Estabelecimento** (salvo em `tenants.name`)
- **Upload de Logo** (salvo em Storage bucket `tenant-assets`, URL em `tenants.logo`)
- Preview da logo atual

Sem seletor de cores — a paleta é fixa para todos os tenants.

---

## Mudanças técnicas

### Banco de dados
- Criar Storage bucket `tenant-assets` (público) para logos
- Criar bucket `product-images` (público) para fotos dos produtos
- RLS: upload restrito a membros do tenant, leitura pública

### Arquivos novos
| Arquivo | Propósito |
|---|---|
| `src/components/CategoryBar.tsx` | Barra de categorias horizontais com ícones |
| `src/components/ProductCard.tsx` | Card de produto com imagem, nome, preço, botão |
| `src/components/CartPanel.tsx` | Painel lateral do carrinho redesenhado |
| `src/components/TableBar.tsx` | Barra inferior com mesas ocupadas |

### Arquivos modificados
| Arquivo | Mudança |
|---|---|
| `src/index.css` | Nova paleta verde (primary, accent, sidebar) |
| `src/pages/PDV.tsx` | Redesign completo usando novos componentes |
| `src/components/AppSidebar.tsx` | Logo do tenant no topo, visual mais clean |
| `src/pages/Login.tsx` | Logo dinâmica do tenant |
| `src/pages/Configuracoes.tsx` | Campos de nome e upload de logo na aba Geral |
| `src/pages/Produtos.tsx` | Upload de imagem ao cadastrar/editar produto |

### Ordem de implementação
1. Storage buckets (migration) + paleta de cores (index.css)
2. Sidebar com logo dinâmica
3. Aba Geral com upload de logo e nome do estabelecimento
4. Componentes do PDV (CategoryBar, ProductCard, CartPanel, TableBar)
5. Redesign do PDV usando os novos componentes
6. Upload de imagens nos produtos
7. Login com logo dinâmica

