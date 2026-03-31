

## Caixa Diário: Abertura, Fechamento e Cupom de Relatório

### Visão geral

Criar um sistema de controle de caixa diário com:
- **Abertura**: operador informa o fundo de troco (valor inicial em dinheiro)
- **Fechamento**: sistema calcula automaticamente os totais por método de pagamento a partir das vendas realizadas durante o turno
- **Cupom**: relatório estilo cupom fiscal com opções de visualizar na tela e imprimir via `window.print()`

### Mudanças no banco de dados

Nova tabela `cash_registers`:

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid PK | |
| opened_by | uuid | user_id de quem abriu |
| opened_at | timestamptz | momento da abertura |
| closed_at | timestamptz | momento do fechamento (null = aberto) |
| initial_amount | numeric | fundo de troco |
| total_cash | numeric | total dinheiro (calculado no fechamento) |
| total_pix | numeric | total PIX |
| total_card | numeric | total cartão |
| total_fiado | numeric | total fiado |
| total_sales | numeric | total geral de vendas |
| notes | text | observações |

RLS: authenticated pode ler e inserir; admins podem deletar e atualizar.

Realtime habilitado para sincronizar entre dispositivos.

### Mudanças no código

**1. Novo tipo `CashRegister` em `src/types/index.ts`**

**2. `src/contexts/StoreContext.tsx`**
- Adicionar estado `currentCashRegister` e funções `openCashRegister` / `closeCashRegister`
- `closeCashRegister` calcula totais a partir das `sales` cujo `date` está entre `opened_at` e `now()`
- Incluir no realtime listener

**3. Nova página `src/pages/Caixa.tsx`**
- Se não há caixa aberto: exibe formulário de abertura (campo "Fundo de Troco" + botão "Abrir Caixa")
- Se há caixa aberto: exibe resumo do turno com botão "Fechar Caixa"
- Ao fechar: calcula totais por método de pagamento, salva no banco, e exibe modal com cupom

**4. Novo componente `src/components/CashRegisterReceipt.tsx`**
- Cupom estilo texto monoespaçado (fonte `font-mono`) com layout de cupom fiscal
- Conteúdo: data/hora abertura e fechamento, fundo de troco, totais por método (Dinheiro, PIX, Cartão, Fiado), total geral, saldo em caixa (fundo + dinheiro recebido)
- Botão "Imprimir" usa `window.print()` com CSS `@media print` para isolar o cupom
- Botão "Fechar" para dispensar o modal

**5. `src/components/AppSidebar.tsx`**
- Adicionar item "Caixa" no menu (visível para todos os perfis)

**6. `src/App.tsx`**
- Adicionar rota `/caixa` com `ProtectedRoute`

**7. Bloqueio de vendas sem caixa aberto (opcional mas recomendado)**
- No PDV, verificar se existe caixa aberto antes de permitir finalizar venda

### Fluxo do usuário

```text
1. Operador acessa "Caixa" → vê formulário de abertura
2. Informa fundo de troco (ex: R$ 200,00) → clica "Abrir Caixa"
3. Realiza vendas normalmente no PDV durante o turno
4. Ao final, acessa "Caixa" → vê resumo → clica "Fechar Caixa"
5. Modal com cupom aparece mostrando:
   ═══════════════════════════
       FECHAMENTO DE CAIXA
   ═══════════════════════════
   Abertura: 31/03/2026 08:00
   Fechamento: 31/03/2026 18:00
   Operador: João
   ───────────────────────────
   Fundo de Troco:   R$ 200,00
   ───────────────────────────
   VENDAS POR FORMA PGTO:
   Dinheiro:         R$ 850,00
   PIX:              R$ 420,00
   Cartão:           R$ 310,00
   Fiado:            R$ 75,00
   ───────────────────────────
   TOTAL VENDAS:   R$ 1.655,00
   ───────────────────────────
   SALDO CAIXA:    R$ 1.050,00
   (Fundo + Dinheiro)
   ═══════════════════════════
6. Operador clica "Imprimir" ou "Fechar"
```

### Resumo de arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `cash_registers` + RLS + realtime |
| `src/types/index.ts` | Adicionar tipo `CashRegister` |
| `src/contexts/StoreContext.tsx` | Estado e funções de caixa |
| `src/pages/Caixa.tsx` | Nova página |
| `src/components/CashRegisterReceipt.tsx` | Componente do cupom |
| `src/components/AppSidebar.tsx` | Novo item no menu |
| `src/App.tsx` | Nova rota |

