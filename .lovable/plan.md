
# Simplificar cards de categoria

## Mudanças
Arquivo: `src/components/CategoryBar.tsx`

- Remover ícones (emoji) de todos os botões de categoria
- Remover contagem de produtos (badge com número)
- Todos os botões usam fundo verde (`bg-primary text-white`) por padrão
- Botão ativo: fundo verde mais escuro ou com shadow para diferenciar
- Hover: usar uma cor diferente — verde mais claro (`bg-accent`) para dar feedback visual

O resultado será botões simples apenas com o nome da categoria, fundo verde, texto branco, compactos e limpos.

### Detalhes técnicos
- Remover `categoryIcons`, `getIcon`, e as `<span>` de ícone e contagem
- Classe padrão: `bg-primary text-primary-foreground`
- Classe ativo: `bg-primary/80 text-primary-foreground shadow-md ring-2 ring-primary-foreground/30`
- Classe hover (não ativo): `hover:bg-accent hover:text-accent-foreground`
- Remover prop `productCounts` da interface (e ajustar chamadas no PDV)
