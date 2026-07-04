## Objetivo

Ao efetuar logout, o usuário deve ser levado à página de login **padrão Degust** (sem branding de tenant). Cada tenant continua com sua própria página de login personalizada acessível via URL direta `/:slug/login` (logotipo do tenant permanece salvo e visível quando alguém acessa o link do próprio tenant).

## Comportamento atual

- Ao clicar em "Sair", `logout()` executa `supabase.auth.signOut()` e limpa o estado.
- O `RequireAuth` percebe a ausência de usuário e redireciona para `/login`.
- A rota `/login` (quando há slug na URL atual) é interceptada e redireciona para `/:slug/login`, exibindo o logotipo do tenant.

Resultado: após logout, o usuário vê o logotipo do tenant que acabou de sair — não o padrão Degust.

## Mudanças

### `src/contexts/AuthContext.tsx`
- Após `supabase.auth.signOut()`, executar `window.location.assign('/login')` (navegação hard para forçar rota raiz sem slug, garantindo que o `Login.tsx` renderize sem `slug` e use o logotipo Degust padrão).
- Limpar `setUser(null)` antes do redirect.

### Nada a alterar em `Login.tsx`
- Já exibe logo Degust padrão quando não há `slug` (verificado em `displayIcon` e no painel esquerdo).
- A rota `/:slug/login` continua funcionando normalmente para acesso direto (mantém branding do tenant salvo).

## Validação

- Login em um tenant → clicar em "Sair" no sidebar (desktop expandido, colapsado e mobile) → confirmar redirecionamento para `/login` com logotipo Degust.
- Acessar diretamente `/:slug/login` de outro tenant → confirmar que o logotipo customizado do tenant continua sendo exibido.
- Screenshot Playwright das duas situações.
