## Problema

Na sidebar mobile (sheet aberto), os rótulos dos itens de menu não aparecem — só os ícones. Isso acontece porque `AppSidebar.tsx` usa `const collapsed = state === 'collapsed'` para decidir se mostra o texto, mas no mobile o `state` do `useSidebar` continua como `'collapsed'` mesmo quando o sheet (openMobile) está aberto. O `collapsible="icon"` só afeta desktop; no mobile o sheet deveria sempre mostrar os labels.

## Correção

Em `src/components/AppSidebar.tsx`:

- Ler `isMobile` do `useSidebar()` (já é lido).
- Trocar `const collapsed = state === 'collapsed'` por `const collapsed = !isMobile && state === 'collapsed'`.
- Isso garante que no mobile os rótulos (nome do tenant, "Sistema PDV", labels dos itens, nome/email do usuário, ícone de settings) sempre apareçam quando o sheet estiver aberto, mantendo o comportamento icon-only apenas no desktop colapsado.

Nenhuma outra alteração de layout, estilo ou lógica.
