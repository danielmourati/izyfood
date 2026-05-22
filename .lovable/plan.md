## Diagnóstico

O problema não está no canal Realtime em si: o diagnóstico mostra eventos chegando. A divergência acontece porque algumas partes do app recebem o evento, mas não aplicam corretamente o novo estado, e porque há inconsistência no banco para `store_settings`.

Pontos encontrados:

- `store_settings` tem mais de uma linha para o mesmo tenant em pelo menos um caso, então telas diferentes podem ler linhas diferentes.
- A coluna `print_settings` é usada pelo código, mas não existe no banco atual, então as configurações de impressão/tenant podem falhar ou não persistir corretamente.
- No `StoreContext`, o evento Realtime de `store_settings` atualiza apenas `tableCount` e descarta `serviceFeePercentage`.
- O checkout busca a taxa de serviço com `.limit(1)` sem filtrar por tenant e sem usar o estado global, então pode pegar a linha errada.
- A sidebar carrega nome/logo do tenant só uma vez e não assina Realtime, então a mudança aparece no diagnóstico mas não reflete na UI.
- O salvamento de configurações faz `select().limit(1)` + update/insert manual, o que permite duplicidade e comportamento divergente.

## Plano de correção

### 1. Normalizar `store_settings` no banco

Criar uma migration para:

- adicionar `print_settings jsonb default '{}'`, caso ainda não exista;
- remover duplicidades de `store_settings`, mantendo a linha mais recente de cada tenant;
- criar uma restrição única para permitir apenas uma configuração por tenant;
- garantir `REPLICA IDENTITY FULL` em `store_settings`;
- garantir que `store_settings` esteja na publicação Realtime sem quebrar caso já esteja;
- ajustar a política de atualização para validar também o novo valor com `WITH CHECK`.

Resultado esperado: cada tenant terá uma única fonte confiável de configurações.

### 2. Corrigir o salvamento da tela Configurações

Alterar `Configuracoes.tsx` para:

- salvar `store_settings` usando `upsert` por `tenant_id`, em vez de `select + update/insert`;
- manter `table_count`, `service_fee_percentage` e `print_settings` na mesma gravação;
- após salvar, reler a linha persistida ou usar o retorno do `upsert` para confirmar o estado real;
- tratar erro específico quando o banco rejeitar a gravação, para não parecer que salvou quando não salvou.

Resultado esperado: taxa de serviço e dados de impressão ficam gravados no banco e propagam para outros dispositivos.

### 3. Corrigir aplicação dos eventos Realtime no estado global

Alterar `StoreContext.tsx` para:

- mapear `store_settings` incluindo `tableCount` e `serviceFeePercentage`;
- no Realtime de `store_settings`, preservar os campos existentes e atualizar também `serviceFeePercentage`;
- buscar `store_settings` de forma determinística por tenant e linha única;
- evitar que uma atualização parcial apague dados já carregados.

Resultado esperado: o app deixa de apenas “receber evento” e passa a atualizar o estado usado pelas telas.

### 4. Corrigir taxa de serviço no checkout

Alterar `CheckoutModal.tsx` para:

- usar `settings.serviceFeePercentage` do `useStore()` como fonte principal;
- remover ou corrigir a busca sem tenant em `store_settings`;
- se houver busca direta, filtrar pelo tenant e usar `.maybeSingle()` após a constraint única.

Resultado esperado: a taxa salva em Configurações aparece corretamente no fechamento de Mesa.

### 5. Sincronizar identidade visual/tenant na UI

Alterar `AppSidebar.tsx` para:

- assinar Realtime da tabela `tenants` filtrando pelo tenant atual;
- atualizar nome e logo quando outro dispositivo salvar;
- limpar o canal ao desmontar.

Resultado esperado: nome/logo alterados em um dispositivo aparecem no outro sem F5.

### 6. Melhorar o Diagnóstico Sync para detectar divergência real

Ajustar `DiagnosticoSync.tsx` para deixar claro que canal conectado não basta:

- mostrar uma checagem de consistência de `store_settings` por tenant;
- exibir alerta se houver mais de uma linha para o tenant;
- mostrar o valor atual persistido de `service_fee_percentage`, `table_count` e presença de `print_settings`;
- manter o ping, mas separar “canal conectado” de “estado aplicado”.

Resultado esperado: a tela passa a diagnosticar o problema real, não apenas a conexão websocket.

## Validação após implementar

- Salvar taxa de serviço em um dispositivo e confirmar no outro sem atualizar a página.
- Abrir checkout de uma Mesa e confirmar que a taxa aplicada bate com Configurações.
- Alterar nome/logo do estabelecimento no mobile e confirmar sidebar/configurações no desktop.
- Conferir no Diagnóstico Sync: uma única linha de `store_settings`, canais OK e valores persistidos corretos.