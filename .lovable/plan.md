# Corrigir login de atendentes na página geral

## O que encontrei
- Paulo (paulo@gmail.com) está cadastrado no Pastelão Junin e a conta está ativa. A senha foi alterada às 18:58 e as tentativas seguintes falharam.
- Desde que cada loja tem e-mails independentes, as contas novas (Paulo, Talles, Kerllen) entram com um endereço interno da loja. Esse endereço só é encontrado quando o login é feito pela página da loja (degust.app/pastelao-junin/login).
- A tela da foto é a página geral (degust.app/login), sem a loja. Ali o app tenta entrar direto com "paulo@gmail.com", que não existe como login, e mostra "E-mail ou senha incorretos". A conta do admin Junin funciona porque é antiga e usa o próprio e-mail.
- O mesmo problema afeta todas as lojas (já aconteceu na Vila Boemia).

## O que vou fazer
1. Na página geral de login, procurar o e-mail digitado em todas as lojas:
   - Se estiver em uma loja só, entrar nela normalmente.
   - Se estiver em mais de uma, mostrar a lista de lojas para a pessoa escolher, e então entrar.
   - Se não estiver em nenhuma, seguir como hoje (contas antigas e superadmin).
2. Depois de entrar, levar a pessoa para a página da loja dela.
3. Testar com o Paulo pela página geral e pela página da loja. Se a senha continuar recusada pela página da loja, a senha digitada não é a que foi salva, e aviso você para redefinir.

## Detalhes técnicos
- Nova função no banco `find_login_tenants(_email)` (security definer) que retorna só `slug` e nome da loja dos `tenant_members` com aquele e-mail; não expõe o login interno. Grant de execução para anon/authenticated.
- `Login.tsx`: sem slug, chama a função; com 1 resultado usa `login(email, senha, slug)`; com vários, mostra seletor de loja (sem toast).
- `AuthContext.login` já resolve via `resolve_tenant_login` quando recebe slug; sem mudanças nele.
