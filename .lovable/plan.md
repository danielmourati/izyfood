# Corrigir criação de usuário em Configurações da loja

## Causa encontrada
- As mensagens de erro (e de sucesso) dessa tela usam avisos flutuantes, mas esses avisos não estão ativos no app. Por isso, ao clicar em salvar, qualquer falha some sem explicação.
- A tela aceita senha com 4 caracteres, mas o sistema de login exige no mínimo 6 e recusa senhas fracas/vazadas (ex.: "pastel@123"). Essa recusa é o motivo mais provável da falha.
- Quando o servidor recusa, a tela tenta um "plano B" de cadastro direto, que também falha pelo mesmo motivo — e o motivo real é perdido.

## Correção
1. **Mensagem visível no próprio formulário** (sem avisos flutuantes): erro em vermelho acima do botão Salvar e confirmação "Usuário criado" na lista.
2. **Motivo real em português**: ler a resposta do servidor e traduzir — senha curta, senha fraca/vazada, e-mail já cadastrado, sem permissão.
3. **Validação antes de enviar**: nome, e-mail válido e senha com no mínimo 6 caracteres.
4. **Remover o plano B** de cadastro direto, que criava contas pela metade; a criação passa só pela função segura do servidor.
5. **Botão com estado "Salvando..."** para evitar clique duplo; usuário aparece na lista logo após criado.

## Validação
- Criar atendente com senha forte: aparece na lista e consegue entrar.
- Tentar com senha fraca e com e-mail repetido: mensagem clara na tela, nada salvo pela metade.
- Tipagem e build.

## Detalhes técnicos
- `src/pages/Configuracoes.tsx` `handleSave`: estado `formError`/`saving`; extrair `await error.context.json()` do `FunctionsHttpError`; usar `formatAuthError` ampliado em `src/lib/auth-errors.ts` (weak/pwned password, already registered); remover fallback `signUp`.
- `supabase/functions/manage-users`: traduzir erros do `createUser` e validar senha ≥ 6; redeploy.
