## Objetivo
1. Trocar a listagem vertical de atendentes em Configurações → Permissões por um **dropdown** de seleção de atendente.
2. Fazer com que a aba **Impressora** apareça e funcione para o atendente quando a permissão `manage_printers` estiver ativa.

## Alterações

### 1. Dropdown de atendente (`src/pages/Configuracoes.tsx` — `PermissoesTab`)
- Adicionar estado `selectedUserId` (inicia com o primeiro atendente após o fetch).
- Substituir o `users.map(...)` que renderiza um card por atendente por:
  - Um `<Select>` (shadcn) no topo do card listando todos atendentes (`nome — email`).
  - Abaixo, renderizar apenas o bloco do atendente selecionado: cabeçalho (nome/email), botões "Marcar todos" / "Desmarcar" / "Copiar para outros…" e o grid de grupos de permissões.
- Mantém intactos: `togglePermission`, `toggleAll`, modal "Copiar para outros…" e toda a lógica de persistência.
- Mensagem quando não houver atendentes permanece.

### 2. Aba Impressora liberada para atendente com permissão
- **`src/pages/Configuracoes.tsx`**:
  - Ampliar o tipo da lista `allTabs` para suportar uma flag opcional `permissionKey?: keyof AttendantPermissions`.
  - Marcar `impressora` com `permissionKey: 'manage_printers'` (mantendo `adminOnly: true`).
  - Usar `useAttendantPermissions()` no componente `Configuracoes` e filtrar tabs assim:
    ```
    tabs = allTabs.filter(t =>
      !t.adminOnly || isAdmin || (t.permissionKey && permissions[t.permissionKey])
    )
    ```
  - Garantir que, ao acessar `?tab=impressora`, o atendente com permissão veja `<ImpressoraTab />` normalmente (já é renderizado com base em `activeTab`).
- **Rota**: `/:slug/configuracoes` já está aberta para qualquer usuário autenticado em `App.tsx`, então não precisa mudar `ProtectedRoute`. A correção da "rota" é apenas garantir que a aba fique visível e clicável quando o toggle está ligado.

## Fora de escopo
- Nenhuma mudança de banco de dados (a coluna `manage_printers` já existe).
- `ImpressoraTab` em si não é alterado — só passa a ser renderizado quando permitido.
