# Pré-seleção de recheios/adicionais só no Pastelão Junin

## O que muda
- Ao lançar ou editar um item, os recheios e adicionais só virão marcados automaticamente na loja **pastelao-junin**.
- Em todas as outras lojas, o item abre sem nada pré-marcado; o atendente escolhe manualmente (itens já salvos com escolhas continuam iguais).
- Limites mínimo/máximo e a regra "carne = Carne moída" continuam funcionando onde já valiam.

## Detalhes técnicos
- `src/lib/flavor-limits.ts`: exportar `PRESELECT_FLAVOR_TENANTS = ['pastelao-junin']` e `tenantAllowsFlavorPreselect(slug)`.
- `src/components/ItemNotesModal.tsx` (único chamador de `getPreselectedFlavorsForProduct`): ler `tenantSlug` do `useAuth()` e usar `[]` quando a loja não for permitida, tanto no `useMemo` quanto no `useEffect`; a contagem de sabores pré-selecionados fica 0 nas demais lojas.
- Teste em `flavor-limits.test.ts`: `pastelao-junin` permitido; `zezinho`, `pastelao-sousa` e vazio negados.
- Salvar a regra em memória do projeto.
