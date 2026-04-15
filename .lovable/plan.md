

# Plano: Módulo de Impressoras Térmicas

## Resumo
Implementar configuração de impressoras térmicas (Web Bluetooth + Rede IP) na aba Impressora das Configurações, com um serviço de impressão ESC/POS reutilizável para comandas, contas e fechamento de caixa.

## Etapas

### 1. Tabela `printer_configs` no banco
Criar tabela para salvar impressoras configuradas por tenant:
- `id`, `tenant_id`, `name` (ex: "Cozinha"), `connection_type` (bluetooth | network), `address` (IP:porta ou device ID), `paper_width` (58 | 80mm), `is_default` (boolean), `created_at`
- RLS: leitura/escrita para membros do tenant, delete para admins

### 2. Biblioteca ESC/POS (`src/lib/printer.ts`)
Serviço que abstrai a comunicação:
- **`connectBluetooth()`** — usa `navigator.bluetooth.requestDevice()` com filtro por serviço de impressora serial
- **`connectNetwork(address)`** — envia dados via fetch para um proxy local ou WebSocket (limitação de browsers; fallback para `window.open` + `print()` em rede)
- **`printRaw(bytes: Uint8Array)`** — envia buffer ESC/POS para o dispositivo conectado
- **Helpers**: `buildOrderReceipt(order)`, `buildBillReceipt(order)`, `buildCashCloseReceipt(register)` — geram bytes ESC/POS com formatação de 58/80mm

### 3. Hook `usePrinter` (`src/hooks/use-printer.ts`)
- Carrega configuração padrão da impressora do tenant
- Expõe `printOrder(order)`, `printBill(order)`, `printCashClose(register)`
- Gerencia estado de conexão Bluetooth (pareamento persistente via `navigator.bluetooth.getDevices()`)

### 4. Aba Impressora (`ImpressoraTab`)
UI de configuração:
- Listar impressoras cadastradas (nome, tipo, endereço, largura do papel)
- Botão "Adicionar Impressora" com formulário: nome, tipo (Bluetooth/Rede), endereço IP (se rede), largura do papel (58mm/80mm)
- Para Bluetooth: botão "Parear" que aciona `navigator.bluetooth.requestDevice()`
- Botão "Imprimir Teste" para validar conexão
- Marcar uma impressora como padrão

### 5. Integrar impressão nos fluxos existentes
- **Comanda**: ao adicionar itens a pedido de mesa, botão "Imprimir Comanda" no carrinho
- **Conta**: no checkout, após pagamento, imprimir automaticamente ou com botão
- **Fechamento de caixa**: substituir `window.open().print()` do `CashRegisterReceipt` pelo serviço ESC/POS, mantendo fallback para navegador

## Detalhes técnicos

**Web Bluetooth API** — disponível em Chrome/Edge (desktop e Android). O pareamento é feito uma vez e o dispositivo fica acessível via `getDevices()`. O serviço filtra por UUID `0x1101` (Serial Port Profile) ou serviços específicos de impressoras térmicas comuns.

**Rede IP** — browsers não permitem conexão TCP raw. A abordagem realista é:
- Usar `window.open` com HTML formatado para impressão via driver do SO (abordagem atual, melhorada)
- Futuramente, um app companion local poderia receber comandos via localhost

**Formato ESC/POS** — comandos binários para: inicializar (`\x1B\x40`), negrito, alinhamento, corte de papel, código de barras. A lib gera `Uint8Array` com o layout completo.

**Tabela DB**:
```sql
CREATE TABLE printer_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT get_user_tenant_id(),
  name text NOT NULL,
  connection_type text NOT NULL CHECK (connection_type IN ('bluetooth','network')),
  address text DEFAULT '',
  paper_width integer NOT NULL DEFAULT 80,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS policies para tenant isolation
```

### Ordem de implementação
1. Migration: tabela `printer_configs` + RLS
2. `src/lib/escpos.ts` — encoder de comandos ESC/POS
3. `src/lib/printer.ts` — conexão Bluetooth/fallback
4. `src/hooks/use-printer.ts` — hook reutilizável
5. `ImpressoraTab` — UI de configuração com pareamento e teste
6. Integrar nos fluxos de comanda, conta e caixa

