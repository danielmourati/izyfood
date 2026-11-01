# Balcão para atendentes, opção "Ambos" e menu de perfil

## 1. Atendimento no Balcão para atendentes
- Nova permissão **"Atender no balcão"** em Configurações → Permissões dos atendentes, no grupo **Salão** (ao lado de "Gerenciar mesas").
- Ligada: o atendente vê **Balcão** no menu e pode abrir, cobrar ou descartar pedidos de balcão, como o admin faz hoje.
- Desligada: o item some do menu e a página `/balcao` fica bloqueada para ele.
- Atendentes que já existem: a permissão começa **ligada**. Assim ninguém perde o acesso que tem hoje. O admin desliga quem não deve usar.

## 2. Opção "Ambos" em observações e adicionais
- No cadastro de observações e adicionais, a escolha passa a ter três opções: **Sabor**, **Adicional** ou **Ambos**.
- Uma opção marcada como "Ambos" aparece nas duas listas na hora de montar o item: a de sabores e a de adicionais.
- No pedido, na comanda e na conta, ela sai no grupo em que o atendente a escolheu (**Sabores:** ou **Adicionais:**). O que já foi lançado antes continua igual.

## 3. Rodapé do menu lateral
- Todas as opções do rodapé ficam dentro de um único botão de perfil, com a letra inicial, o nome e o e-mail do usuário.
- Ao clicar, abre um menu com **Meu Perfil**, **Configurações**, **Área Super Admin** (só para o superadmin) e **Sair**.
- O seletor Claro/Escuro/Auto sai do rodapé, porque o app já fica sempre no modo claro.
- Com o menu recolhido, o botão mostra só a letra inicial e abre o mesmo menu.

## Detalhes técnicos
- Migração: nova coluna `attendant_permissions.use_counter boolean not null default true`.
- `use-attendant-permissions.ts`: adicionar a chave `use_counter`. `Configuracoes.tsx`: adicionar o rótulo e incluir a chave no grupo `salao`. `AppSidebar.tsx`: o Balcão passa a usar `permissionKey: 'use_counter'`. `App.tsx`: a rota `/balcao` usa `ProtectedRoute adminOnly permissionKey="use_counter"`.
- `classification` passa a aceitar `'both'`: alterar os tipos em `types/index.ts` e `lib/utils.ts`, e o seletor em `Produtos.tsx`. Os filtros em `ConsumerItemCustomizeModal.tsx` e `ItemNotesModal.tsx` incluem `'both'` nas duas listas. Ao selecionar uma opção "Ambos", o item guarda como foi usada (`flavor` ou `additional`), então `getOrderItemCustomizationGroups` e os cupons ficam como estão. Isso segue a regra de guardar a escolha no item.
- `AppSidebar.tsx`: o `SidebarFooter` passa a ter um único `DropdownMenu`. Quando expandido, o botão mostra avatar, nome e e-mail. Quando recolhido, mostra só o avatar. O `ThemeToggle` sai do rodapé.
- Testes: um teste para a permissão do balcão, que libera e bloqueia o acesso. Outro para "Ambos", que deve aparecer nas duas listas e ser impresso no grupo escolhido.
