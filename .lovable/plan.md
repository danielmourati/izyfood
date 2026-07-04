## Correção

Ao clicar em "Fazer upgrade" no `TrialBanner`, direcionar o admin diretamente para a aba **Plano** de `/configuracoes`.

### 1. `src/pages/Configuracoes.tsx`
- Ler `useSearchParams()` do `react-router-dom` e usar `searchParams.get('tab')` como estado inicial de `activeTab` (validando contra as chaves de `allTabs`, com fallback para `'perfil'`).
- Ao trocar de aba pelo clique, atualizar o query param via `setSearchParams({ tab }, { replace: true })` para manter URL e estado sincronizados.

### 2. `src/components/TrialBanner.tsx`
- Trocar `navigate('/configuracoes')` por `navigate('/configuracoes?tab=plano')`.

Sem outras mudanças de layout/lógica.
