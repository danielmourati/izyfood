## Plano: Layout Definitivo do Cupom CONTA (58mm Bluetooth)

### Contexto e diagnóstico
A cada alteração o cupom sai desconfigurado porque:
1. Mini-impressoras Bluetooth genéricas frequentemente **ignoram comandos** como Font B (`ESC M 1`), modo condensado e até double-height fora do alinhamento `CMD_ALIGN_LEFT`.
2. A função `row()` atual **não trata nomes longos** — quando `label + value` excede 32 colunas, ela cai num fallback com apenas 1 espaço, achatando tudo.
3. Os separadores `lineOf('-', cols)` foram adicionados/removidos pontualmente em iterações anteriores, sem um padrão claro de seções.

A solução é congelar um layout **setorizado** com regras determinísticas e uma função `rowWrap()` que quebra nomes longos em 2 linhas, mantendo o preço alinhado à direita na primeira linha.

---

### Layout final (32 colunas, 58mm)

```text
        NOME DA LOJA              <- center+bold (se houver)
       Rua Exemplo, 123           <- center (se showAddress)
      CNPJ: 00.000.000/0001-00    <- center (se showDocument)
       WhatsApp: 11999999999      <- center (se showWhatsapp)
--------------------------------  <- separador (fim do cabeçalho)
             CONTA                <- center+bold+double
--------------------------------  <- separador (fim do título)
Tipo:                       Mesa
Mesa:                          5
Cliente:             Consumidor
Data:           22/05/2026 17:13
--------------------------------  <- separador (fim dos dados)
1x Açaí 500ml com complemen
tos especiais             R$48,00
  + 2x Granola            R$ 4,00
2x Refrigerante 350ml     R$ 9,00
--------------------------------  <- separador (fim dos itens)
Desconto (10%):           -R$5,28
Taxa de Serviço:          R$ 4,80
Taxa de entrega:          R$ 5,00
--------------------------------  <- separador (fim dos ajustes)
TOTAL              R$ 52,80       <- bold + double (16 cols)
--------------------------------  <- separador (fim do total)
PAGAMENTO:                        <- bold
Dinheiro                  R$30,00
PIX                       R$22,80
--------------------------------  <- separador (fim do pagamento)
        PIX: chave@exemplo        <- center (se showPixKey)
      Instagram: @minhaloja       <- center (se showInstagram)
    Obrigado pela preferência!    <- center+bold (se showThankMessage)
```

**Regra de ouro:** uma linha `lineOf('-', 32)` ao final de cada bloco lógico — cabeçalho, título, dados, itens, ajustes, total, pagamento. Nada de linhas em branco no meio.

---

### Mudanças técnicas em `src/lib/escpos.ts`

**1. Nova função `rowWrap(label, value, cols)`**
- Se `label.length + 1 + value.length <= cols` → comporta-se como `row()` atual.
- Senão, quebra `label` em pedaços de `cols` caracteres respeitando palavras (split em espaço); a **última linha** carrega o `value` alinhado à direita.
- Substitui `row()` apenas nos **itens e complementos** (onde nomes podem ser longos). Os 4 rótulos fixos (`Tipo/Mesa/Cliente/Data`) continuam com `row()` simples.

**2. Compatibilidade Bluetooth (mini-printer genérica)**
- Remover usos de `CMD_FONT_B` no rodapé (já está em Font A — confirmar e travar).
- Garantir `normalTextMode()` antes de cada bloco que muda formatação (após `CONTA` double, após `TOTAL` double).
- Manter apenas `CMD_BOLD_ON/OFF`, `CMD_DOUBLE_ON/OFF`, `CMD_ALIGN_*` — comandos universais.
- Não usar code page específica em texto que pode falhar; manter `CMD_CODEPAGE_PC860` apenas no `CMD_INIT`.

**3. Separadores fixos em `buildBillReceipt`**
Ordem definitiva das chamadas `lineOf('-', cols)`:
1. Depois do cabeçalho dinâmico (se houver qualquer campo)
2. Depois de `text('CONTA\n')`
3. Depois de `Data:` (fim dos dados)
4. Depois do último item (fim dos itens)
5. Depois do último ajuste (Desconto/Taxa Serviço/Taxa Entrega) — só se houver ao menos um
6. Depois de `TOTAL`
7. Depois do último split de pagamento — só se houver pagamento

**4. Remover ruído**
- Eliminar `parts.push(text('\n'))` órfãos remanescentes.
- Remover `CMD_ALIGN_LEFT` repetidos antes de cada `row()` (já está em LEFT desde o título).

---

### Arquivos afetados
- **`src/lib/escpos.ts`** — adicionar `rowWrap()`, refatorar `buildBillReceipt()` para o layout setorizado acima.
- **`src/test/escpos.test.ts`** — adicionar 2 testes: (a) item longo quebrado em 2 linhas com preço na 1ª, (b) presença de todos os 7 separadores na ordem correta.

---

### Fora de escopo (não vou tocar agora)
- `buildOrderReceipt` (comanda da cozinha) — layout diferente, já estável.
- `buildCashCloseReceipt` (fechamento de caixa) — separado, sem reclamação.
- Configurações do componente `ImpressoraTab` — apenas o renderer ESC/POS.

---

### Validação após implementar
1. Rodar `vitest src/test/escpos.test.ts` — todos os testes passam.
2. Imprimir cupom de teste real na mini-printer Bluetooth com: 1 item curto, 1 item longo (>20 chars), 1 complemento, desconto + taxa de serviço, pagamento dividido em 2.
3. Conferir visualmente que cada um dos 7 separadores aparece exatamente uma vez, full-width.

Se algum ajuste ainda for necessário após esse layout-base, será **incremental sobre uma base estável** — sem refatorar tudo de novo.
