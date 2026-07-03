## Anexo 1 — Fechar Caixa: aviso apenas quando há pendências reais

**Problema:** o AVISO ("Existem pedidos não finalizados ou mesas abertas") aparece mesmo quando o caixa está limpo, porque `checkPendingBeforeClose` considera qualquer registro em `orders` com status `aberto`/`segurado` — incluindo carrinhos-fantasma criados no PDV que nunca foram finalizados (Balcão zerado, delivery abortado) e mesas com `status='occupied'` desatualizado.

**Ajustes em `src/pages/Caixa.tsx`:**

1. Filtrar explicitamente por `tenant_id` do usuário nas duas consultas (defense in depth além do RLS).
2. Ignorar pedidos vazios: adicionar `.gt('total', 0)` **ou** somente contar pedidos com itens registrados no período do caixa atual (`created_at >= currentRegister.openedAt`). Isso descarta carrinhos zumbis e evita falso positivo do PDV Balcão.
3. Para `store_tables`, manter `status='occupied'` mas cruzar com a existência de pelo menos um pedido `mesa` em aberto no mesmo tenant — se a mesa está "occupied" sem pedido correspondente, é lixo residual e não deve disparar o aviso (fica um log de warning para diagnóstico).
4. Enriquecer o texto do AlertDialog para mostrar a contagem real: "AVISO: 2 pedido(s) em aberto e 1 mesa ocupada." — deixa claro para o operador. Sem contagem = sem aviso.
5. Garantir `setHasPendingItems(false)` no início do check (reseta estado antes de decidir), evitando resquício de um clique anterior.

Resultado: quando não houver pedido válido nem mesa realmente ocupada com pedido, o modal abre limpo, apenas com "Tem certeza que deseja fechar o caixa?".

---

## Anexo 2 — Nova UI de Impressora de Cupom

Substitui a `ImpressoraTab` atual pelo layout do mockup, mantendo integração com QZ Tray / Bluetooth já existentes em `src/lib/printer.ts`.

### Estrutura visual

**Card 1 — Status do QZ Tray** (destaque)
- Badge de status ("Cert: <nome-do-tenant>" quando conectado, "Não detectado" caso contrário).
- Botão **Como instalar** (abre `https://qz.io/download/` em nova aba).
- Botão **Detectar** (chama `retryQzConnection`).
- Botão **Teste de conexão** (imprime um recibo curto via QZ).
- Accordion **Ajuda & solução de problemas** com passos comuns (porta 8181 bloqueada, firewall, reiniciar o QZ).
- Bloco **Configurar confiança permanente (Windows)** — badge "Cert próprio: <tenant>", passos 1-2-3 e botão **Baixar instalador** apontando para o download oficial do QZ Tray (`https://qz.io/download/`).
- Link colapsável **Instalação manual (avançado / macOS / Linux)** com botão **Baixar cert.pem** apontando para a página oficial de certificados do QZ.

**Card 2 — Impressora** (formulário inline, não mais em Dialog)
- Nome da impressora (`name`)
- **Modelo** (novo campo texto, default "ESC/POS compatível") — coluna `model`
- **Tipo de conexão** (select): `QZ Tray — Impressão local (recomendado)`, `Bluetooth`, `Rede (IP)`
- **Perfil ESC/POS** (novo select) — coluna `escpos_profile`: `Genérico ESC/POS`, `Epson TM`, `Bematech MP`, `Elgin i9`, `Custom`
- Endereço / seletor de impressora do sistema (mantém lógica atual)
- Largura do papel (58/80)
- Impressora padrão (switch)
- **Conectar automaticamente ao QZ Tray ao logar** (novo switch) — coluna `auto_connect_qz`

**Card 3 — Bluetooth** (colapsado por padrão, para casos móveis)
- Mantém o card atual de pareamento BT como fallback avançado.

**Card 4 — Impressoras configuradas** (lista atual, sem mudança funcional).

**Card 5 — Imprimir teste** (mantido).

### Migração de banco (`printer_configs`)

Adicionar colunas opcionais:
- `model text` default `'ESC/POS compatível'`
- `escpos_profile text` default `'generic'`
- `auto_connect_qz boolean` default `false`

RLS existente permanece; grants já cobrem `authenticated` + `service_role`.

### Auto-connect ao logar

Novo efeito no `AuthContext` (ou hook `useAutoPrinter`): ao autenticar, buscar a impressora padrão do tenant; se `auto_connect_qz=true`, chamar `initQzTray()` silenciosamente.

---

## Detalhes técnicos

- **Arquivos alterados:**
  - `src/pages/Caixa.tsx` — nova lógica de `checkPendingBeforeClose` + contagens no AlertDialog.
  - `src/components/ImpressoraTab.tsx` — rewrite com nova estrutura de cards.
  - `src/hooks/use-printer.ts` — expor `printers` com os novos campos + helper `printTestConnection()`.
  - `src/contexts/AuthContext.tsx` — auto-connect QZ no login se configurado.
  - Nova migração para `printer_configs` (3 colunas).
- **Sem toasts novos** (respeita regra do projeto): feedback via badges, Alerts inline e estado nos botões.
- **Sem alteração** em `src/lib/printer.ts` — API já suficiente.

## Fora de escopo
- Não altera o fluxo de emissão de comandas/contas nem `escpos.ts`.
- Não muda a lógica de fechamento em si (`doClose`), apenas a pré-checagem e o texto do aviso.
