Substituir o dropdown único do rodapé do sidebar por botões independentes de **Configurações** e **Sair** no desktop expandido, mantendo um gatilho compacto por ícone de menu quando o sidebar estiver colapsado.

## Contexto
Atualmente `src/components/AppSidebar.tsx` renderiza o rodapé do sidebar como um único `DropdownMenu` acionado pelo avatar/nome do usuário. O menu esconde as ações de *Configurações* e *Sair* em itens de dropdown. O usuário quer que essas ações apareçam como botões independentes no rodapé, corrigindo a visualização em desktop. Quando colapsado, o espaço é reduzido, então um único ícone de menu abrirá as opções.

## Alterações
1. **Refatorar o rodapé de `AppSidebar.tsx`**
   - Remover o layout atual de dropdown único no rodapé.
   - Criar layout condicional baseado no estado `collapsed` do `useSidebar`.

2. **Desktop expandido (`collapsed === false`)**
   - Linha de perfil: avatar + nome + email (pode ser clicável para *Meu Perfil*).
   - Botão **Configurações** (ícone `Settings`) navegando para `/:slug/configuracoes`.
   - Botão **Sair** (ícone `LogOut`, cor `text-destructive`) chamando `logout()`.
   - Preservar a opção *Área Super Admin* condicional para `role === 'superadmin'`.

3. **Desktop colapsado (`collapsed === true`)**
   - Renderizar um único botão de ícone (ex. `Menu` ou `Settings`) que abre um dropdown com as opções: *Meu Perfil*, *Configurações*, *Sair* e *Área Super Admin* (quando aplicável).
   - Garantir que o dropdown não seja cortado pela largura estreita do sidebar.

4. **Mobile**
   - Manter o layout expandido, pois o sidebar mobile é um sheet de largura total.

5. **Estilo e acessibilidade**
   - Usar tokens semânticos do projeto (`bg-card`, `text-foreground`, `text-destructive`, `hover:bg-muted`, `border-border`).
   - Adicionar `aria-label` nos botões de ícone.
   - Garantir espaçamento consistente e estados de hover.

## Validação
- Visualizar a aplicação em desktop expandido e confirmar que *Configurações* e *Sair* são botões visíveis no rodapé.
- Colapsar o sidebar e confirmar que o ícone de menu abre o dropdown com as mesmas opções, sem cortes.
- Verificar mobile para garantir que o layout expandido continue funcional.