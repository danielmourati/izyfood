# Corrigir login da loja Vila Boemia

## O que foi encontrado
- A conta `felipe@gmail.com` (admin da Vila Boemia) existe, está confirmada e nunca conseguiu entrar.
- Desde a mudança de "e-mail por loja", cada usuário novo entra com um login interno da loja. O app só traduz o e-mail para esse login quando a pessoa está em `/vilaboemia/login`.
- Na tela genérica `/login` (sem o nome da loja), o app tenta o e-mail direto e o sistema responde "E-mail ou senha incorretos", mesmo com a senha certa. Isso afeta todas as lojas criadas depois da mudança.

## Correção
1. Na tela `/login` sem loja: procurar em quais lojas esse e-mail está cadastrado.
   - Se estiver em uma só, entrar direto nela.
   - Se estiver em várias, mostrar uma lista para escolher a loja e continuar.
2. Contas antigas (que entram com o e-mail real) continuam funcionando como hoje.
3. Ao entrar pela tela genérica, levar o usuário para a página da própria loja.
4. Testar o login real do Felipe pela `/login` e pela `/vilaboemia/login`. Se mesmo assim a senha for recusada, o problema é a senha — redefino pelo painel de usuários.

## Detalhes técnicos
- Nova RPC security definer `resolve_login_candidates(_email)` retornando apenas `slug`, `tenant name` e `login_email` (sem expor outros dados), limitada a membros com `login_email`.
- `AuthContext.login` sem slug: chama a RPC; 1 resultado → `signInWithPassword` com o `login_email`; >1 → devolve lista ao `Login.tsx` para escolha; 0 → e-mail direto (legado).
- Teste unitário da regra de escolha (0/1/vários).
