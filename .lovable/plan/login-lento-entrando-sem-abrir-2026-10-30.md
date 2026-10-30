# Login lento ("Entrando..." sem abrir)

## O que foi visto
- O serviço de login reiniciou às 22:29 UTC (19:29); durante alguns minutos as respostas ficaram lentas (1–2 s) e houve falhas de sessão antiga.
- O login do junin@gmail.com às 22:32 deu certo em 0,8 s — a senha em si não é o gargalo.
- Depois da senha, o app faz várias consultas em sequência (perfil, permissões, loja) e repete tudo uma segunda vez em paralelo; com o banco carregado (memória 79%, alerta de disco às 17:44) isso pode passar de 10 s e não há limite de tempo — o botão fica em "Entrando..." indefinidamente.

## O que vou mudar (vale para todas as lojas)
1. Buscar perfil, permissões e loja ao mesmo tempo, não um após o outro.
2. Fazer essa busca uma única vez por login (hoje roda duas vezes).
3. Limite de tempo: se o servidor não responder em 15 s, o botão volta ao normal com a mensagem "O servidor demorou para responder. Tente de novo." exibida abaixo do botão (sem pop-up).
4. Se a busca dos dados da loja demorar, entrar com os dados já salvos no aparelho e completar em segundo plano.
5. Teste automático para o limite de tempo.

## Detalhes técnicos
- `AuthContext.tsx`: `fetchAppUser` com `Promise.all`; dedupe via promise compartilhada por `user.id` entre `login()` e `onAuthStateChange(SIGNED_IN)`; `withTimeout` em resolve RPC, `signInWithPassword` e `fetchAppUser`; remover retry extra do signIn.
- `Login.tsx`: mostrar erro de timeout inline.
- Não altera banco nem permissões.
