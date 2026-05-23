## Diagnóstico

No desktop, ao abrir Configurações, o app salva `print_settings` no banco e também em `localStorage` daquele navegador, e a tela de preview/impressão lê desse cache local com toggles preenchidos. Por isso o cabeçalho/rodapé aparece corretamente no desktop.

No mobile, o cenário muda:

- O `localStorage` daquele celular começa vazio para `print_settings_<tenant>`, então o cache em memória (`__printSettingsCache`) também está vazio quando o usuário aciona imprimir.
- O `printBill` em `src/hooks/use-printer.ts` tenta buscar do banco antes de imprimir, mas a busca pode falhar silenciosamente em situações reais de mobile:
  - sessão sem `user.tenantId` ainda hidratado (recarregou no PDV antes do `AuthContext` resolver) → o bloco `if (tenantId)` é pulado e `ps` fica `{}` (sem nenhum toggle).
  - resposta vem com `print_settings` `null` (linha do tenant nunca atualizada com a coluna nova) → cai no `else if (tenantName)` e descarta tudo, mantendo `ps` vazio.
  - Realtime de `store_settings` no `StoreContext` não propaga `print_settings`, então um celular aberto há horas continua com o cache antigo mesmo após salvar no desktop.
- Como `ps` chega praticamente vazio no `buildBillReceipt`, todos os blocos `if (ps.showAddress && ps.address)`, `if (ps.showWhatsapp && ps.whatsapp)`, etc. são falsos e a comanda/conta sai sem cabeçalho e rodapé.
- Existe duplicidade entre `fetchPrintSettings` (em `escpos.ts`) e a refetch dentro de `printBill` (em `use-printer.ts`), com regras de merge diferentes, o que aumenta a chance de divergência entre dispositivos.

## Plano de correção

### 1. Centralizar `print_settings` no estado global do app

Em `src/contexts/StoreContext.tsx`:

- Carregar `print_settings` junto com `store_settings` no primeiro fetch por `tenantId`.
- Expor `printSettings` no contexto (`useStore()`), com merge de `storeName` vindo de `tenants.name`.
- Assinar Realtime de `store_settings` para o tenant e atualizar `printSettings` quando outro dispositivo salvar — sem descartar campos.
- Gravar a versão consolidada em `localStorage` (`print_settings_<tenant>`) e em `(window as any).__printSettingsCache` para retrocompatibilidade.

Resultado: qualquer dispositivo passa a ter, em memória, a configuração atual sem depender de cache local prévio.

### 2. Tornar `printBill` determinístico e à prova de tenant não pronto

Em `src/hooks/use-printer.ts`:

- Remover o refetch inline de `print_settings` e ler diretamente de `useStore().printSettings`.
- Se `printSettings` estiver vazio no momento do clique, executar um `await fetchPrintSettings(tenantId)` síncrono antes de montar o buffer ESC/POS e abortar o envio com mensagem clara se o tenant ainda não estiver disponível (em vez de imprimir um recibo "pelado").
- Garantir que o `ps` enviado ao `buildBillReceipt` contenha sempre os campos `show*` (default `false` apenas se realmente ausentes no banco).

### 3. Endurecer `fetchPrintSettings` em `src/lib/escpos.ts`

- Sempre retornar um objeto com todos os toggles definidos (default `false`) e os campos textuais (default `''`), evitando que o consumidor precise checar `undefined`.
- Quando o banco vier com `print_settings = null`, recuperar do `localStorage` daquele dispositivo somente como último recurso, e logar (sem toast) qual fonte foi usada para facilitar diagnóstico.
- Manter o cache em memória sincronizado com o `localStorage` em toda atualização.

### 4. Garantir que o salvamento em Configurações nunca grave parcial

Em `src/pages/Configuracoes.tsx`:

- No `upsert` de `store_settings`, montar `print_settings` a partir de um objeto completo (todos os toggles e textos, com fallback para os valores atuais) antes de enviar, para impedir que um save antigo derrube campos novos.
- Após o upsert, atualizar imediatamente `useStore().printSettings` e o `localStorage` local, em vez de depender só do Realtime para refletir na própria tela.

### 5. Adicionar verificação no Diagnóstico Sync

Em `src/pages/DiagnosticoSync.tsx`:

- Mostrar, por tenant, se `print_settings` está presente no banco e quais toggles estão ativos.
- Mostrar também o que o dispositivo atual tem em `localStorage` / `__printSettingsCache`, lado a lado, para que o usuário consiga ver no celular se ele já recebeu as configurações antes de tentar imprimir.

### 6. Validação após implementar

- No desktop: salvar cabeçalho/rodapé com toggles ativos. Conferir Diagnóstico Sync no celular: deve mostrar os mesmos toggles ativos sem F5.
- No celular: abrir uma mesa, fechar conta e imprimir via Bluetooth. Conferir que o recibo sai com nome da loja, endereço, documento, WhatsApp (conforme toggles) e com PIX, Instagram e mensagem de agradecimento no rodapé.
- No celular sem nunca ter aberto Configurações: confirmar que a primeira impressão já sai com cabeçalho/rodapé corretos (validando o caminho via DB + StoreContext).
- No celular offline momentâneo (DB falha): confirmar que cai no cache local e ainda imprime cabeçalho/rodapé se houver dados em `localStorage`; caso contrário, mostrar aviso claro em vez de imprimir sem cabeçalho.
