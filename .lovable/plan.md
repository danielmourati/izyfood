
## Funcionalidades solicitadas

### 1. Mesas — Mínimo 5 mesas padrão
- Garantir que ao criar um tenant, pelo menos 5 mesas sejam cadastradas automaticamente.

### 2. Transferência de mesa
- Permitir transferir um pedido de uma mesa para outra (ex: mesa 1 → mesa 5), liberando a mesa antiga automaticamente.

### 3. Mesclar/Juntar mesas
- Duas mesas ocupadas podem ter seus itens combinados em uma única mesa, liberando a outra.

### 4. Divisão de pagamento por ocupantes
- No checkout, informar número de ocupantes para calcular valor por pessoa automaticamente.

### 5. Pagamentos parciais ("a ver")
- Registrar pagamentos avulsos que são decrementados do total, exibindo "Falta R$XX de R$XXX".

### 6. Permissões granulares por atendente
- Admin pode configurar quais ações cada atendente pode realizar (cadastrar produtos, alterar preços, dar entrada no estoque, remover itens, cancelar pedidos, etc).
- Possibilidade de copiar permissões de outro atendente existente.
- Por padrão, apenas admin pode excluir/cancelar.

### 7. Fechamento de caixa com validação
- Ao fechar o caixa com pedidos não finalizados ou mesas abertas, exigir confirmação do admin com senha.

### 8. Movimentações de caixa (entradas e saídas)
- Registrar entradas avulsas (fundo de troco adicional, pagamentos recebidos).
- Registrar saídas/sangrias (despesas, pagamento de fornecedor, compra de insumos).
- Sempre informando o destino/motivo do valor.

## Ordem de implementação sugerida
1. Mesas (itens 1-3) — migração DB + UI
2. Checkout melhorado (itens 4-5) — UI + lógica
3. Movimentações de caixa (item 8) — migração DB + UI
4. Fechamento de caixa com validação (item 7) — lógica + UI
5. Permissões granulares (item 6) — migração DB + UI + lógica

Cada etapa será implementada e testada antes de seguir para a próxima.
