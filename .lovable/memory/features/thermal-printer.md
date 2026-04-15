---
name: Thermal Printer Module
description: ESC/POS thermal printer support via Web Bluetooth and browser fallback, with tenant-scoped config in printer_configs table.
type: feature
---
O módulo de impressão térmica suporta dois métodos de conexão:

1. **Web Bluetooth** — pareamento direto pelo Chrome/Edge. Envia comandos ESC/POS binários em chunks de 512 bytes. Service UUIDs comuns pré-configurados.
2. **Fallback navegador** — abre janela formatada com HTML monospace e aciona `window.print()`. Funciona em qualquer navegador.

**Arquivos principais:**
- `src/lib/escpos.ts` — encoder ESC/POS: `buildOrderReceipt`, `buildBillReceipt`, `buildCashCloseReceipt`
- `src/lib/printer.ts` — conexão Bluetooth (`connectBluetooth`, `printViaBluetooth`) e fallback HTML
- `src/hooks/use-printer.ts` — hook `usePrinter` com `printOrder`, `printBill`, `printCashClose`, `printTest`
- `src/components/ImpressoraTab.tsx` — UI de configuração na aba Impressora do Configurações

**Tabela:** `printer_configs` (name, connection_type, address, paper_width, is_default, tenant_id)

**Tipos de documento:** Comanda (itens para cozinha), Conta (recibo do cliente), Fechamento de Caixa.

**Largura do papel:** 58mm (32 colunas) ou 80mm (48 colunas), configurável por impressora.
