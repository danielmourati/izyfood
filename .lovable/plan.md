## Objetivo

A tela de login deve sempre exibir a identidade **Degust**, independente da URL (`/login` ou `/:slug/login`). O logotipo do tenant só aparece após o login, dentro da aplicação (sidebar, header, etc.).

## Comportamento atual

`src/pages/Login.tsx` faz uma chamada RPC `get_tenant_branding` quando há `slug` na URL e substitui:
- O logotipo do painel esquerdo (desktop) pelo logo do tenant.
- O ícone central do formulário pelo `login_icon`/logo do tenant.
- Adiciona o nome do tenant abaixo do logo.

## Mudanças

### `src/pages/Login.tsx`

Remover toda a lógica de branding por tenant:

1. Remover os states `tenantLogo`, `tenantName`, `loginIcon` e o `useEffect` que chama `get_tenant_branding`.
2. Remover o uso de `useParams` para `slug` (ou manter apenas se necessário para SEO canonical — ver item 4).
3. No painel esquerdo (desktop): sempre renderizar `degustLogoHorizontal`.
4. No formulário (direita): sempre renderizar `degustLogoHorizontal`, remover o `<p>` do `tenantName`.
5. SEO/Helmet: usar sempre o título/descrição padrão Degust; `canonical` pode continuar refletindo a URL atual (`/login` ou `/:slug/login`) — sem menção ao nome do tenant.
6. Remover o import não utilizado de `useParams` se não for mais necessário.

### Nenhuma mudança em

- `AuthContext.tsx` — logout já redireciona para `/login`.
- `App.tsx` — roteamento de `/:slug/login` continua válido (a página apenas não usa mais branding do tenant).
- Componentes internos pós-login (sidebar, header) — continuam mostrando o logo do tenant normalmente.

## Validação

Playwright: acessar `/login` e `/xofome/login` → ambos devem mostrar o logo Degust (painel esquerdo e formulário). Após login, verificar que o logo do tenant aparece no sidebar.