# Mobile: reordenar formas de pagamento e trocar Vale Refeição por Fiado

## Contexto

O `CheckoutModal.tsx` tem dois renderizadores: um para mobile (`if (isMobile)`, ~linha 420) com um grid 3×2 fixo — DINHEIRO, DÉBITO, CRÉDITO, PIX, VALE ALIM., VALE REF. — e um para desktop com lista (`paymentMethodsConfig`) e o sub-modal completo de Fiado ("Marcar Fiado - Selecione um Contato": campo Valor no Fiado, busca, tabela de clientes com Saldo Atual/Limite de Crédito, botão Novo Cliente, ações Voltar/Selecionar).

No mobile, o Fiado existe só como versão simplificada (busca + lista de nomes), sem valor, saldo, limite nem Novo Cliente, e nem aparece no grid.

## Mudanças (todas em `src/components/CheckoutModal.tsx`)

1. **Reordenar o grid mobile** (3×2) para:
   `PIX` | `DINHEIRO` | `DÉBITO` —
   `CRÉDITO` | `VALE ALIM.` | `FIADO`
   - O botão VALE REF. é removido do grid mobile.
   - FIADO abre o sub-modal `fiado` (mesmo `openSubModal('fiado')` do desktop).
   - Ícone do Fiado: `Wallet` (mesmo da config desktop).

2. **Reaproveitar o Fiado do desktop no mobile, responsivo**
   - Extrair o conteúdo do VIEW 4 (Fiado) para uma função `renderFiadoView()` dentro do componente, com classes responsivas:
     - Tabela de clientes vira lista de cards empilhados em telas estreitas (`md:hidden` cards / `hidden md:block` tabela), mostrando nome, telefone, Saldo Atual e Limite de Crédito, com seleção por rádio/toque.
     - Header com "TOTAL (FALTANDO): R$ ..." + botão Novo Cliente, campo Valor no Fiado (CurrencyInput), busca por nome/telefone e rodapé Voltar/Selecionar — idênticos ao desktop.
   - Desktop usa `renderFiadoView()` sem alteração visual; no mobile, o branch `isMobile` renderiza `renderFiadoView()` quando `activeSubModal === 'fiado'` (no lugar do bloco compacto atual de fiado, que é removido).

3. **Novo Cliente no mobile**
   - O diálogo rápido "Novo Cliente" (hoje renderizado só no branch desktop) vira um JSX compartilhado (constante no componente) renderizado nos dois branches, para o botão Novo Cliente funcionar no mobile.
   - Estado/handlers reutilizados sem mudança: `fiadoSearch`, `selectedFiadoCustomerId`, `handleSaveFiadoSplit`, `setNewCustomerOpen`.

4. **Sem mudanças de dados/fluxo**: splits de fiado continuam `method: 'fiado'` com `notes: "Cliente: ..."`, validação de cliente obrigatório e conferência de "Falta Pagar" permanecem iguais.

## Verificação

- `tsgo` e build sem erros; testes existentes passam.
- Playwright em viewport mobile (390px): abrir pedido de mesa → PAGAMENTO → conferir ordem do grid (Pix primeiro, Fiado no lugar de Vale Ref.) → abrir Fiado → cards de cliente responsivos, Valor no Fiado e Novo Cliente funcionando; selected → Adicionar → split listado; screenshot para evidência.
