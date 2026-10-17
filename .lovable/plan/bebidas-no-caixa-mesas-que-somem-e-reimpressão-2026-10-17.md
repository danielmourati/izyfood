# Bebidas no Caixa, mesas que somem e reimpressão

## 1. Bebidas no Caixa (recibo), em comanda separada (Zezinho)
- Trocar o "Imprimir em" das 5 categorias de bebidas (Cerveja 600ml, Cerveja Long Neck, Bebidas Geladas, Bebidas Quentes, Drink's) de Cozinha para **Caixa (recibo)**.
- Conferir que nenhum produto de bebida tem setor próprio apontando para a Cozinha.
- O envio já separa os itens por setor: ao tocar Enviar, comidas saem num cupom na Cozinha e bebidas em outro no Caixa. Vou confirmar isso com um pedido misto na prévia.

## 2. Mesas que somem depois de lançadas e impressas pelo usuário "atendimento"
Causa ainda não confirmada. Primeiro passo: verificar no banco do Zezinho os pedidos e mesas desse usuário (se o pedido foi gravado, se a mesa ficou ligada a ele, e se houve erro de permissão ao salvar).

Suspeitas principais, a confirmar:
- Ao atualizar a lista, o app libera na tela toda mesa ocupada cujo pedido não voltou na consulta. Se o pedido do atendente ainda não foi gravado (ou foi recusado), a mesa some.
- O fechamento da janela com o pedido ainda vazio na memória pode chamar o descarte e liberar a mesa.

Correções previstas:
- Nunca liberar na tela uma mesa ocupada só porque o pedido não veio numa consulta; liberar apenas com pagamento, exclusão confirmada ou troca de mesa.
- Se a gravação do pedido falhar, manter a mesa ocupada e mostrar o aviso na própria tela (sem notificação flutuante).
- Corrigir a permissão do atendente, caso a gravação esteja sendo recusada.

## 3. Itens já impressos não saem de novo, a menos que o admin peça
- Enviar, Fechar e "Imprimir na Cozinha" mandam só os itens marcados como "Novo".
- Depois de impresso, o item fica marcado como "Impresso" no banco, mesmo se a janela for reaberta em outro aparelho.
- A reimpressão de itens já impressos fica disponível apenas para admin (atendente não vê a opção).
- A conta do cliente continua podendo ser impressa normalmente.

## Detalhes técnicos
- Dados: `UPDATE categories SET print_sector='recibo'` para as categorias de bebida do tenant zezinho; checar `products.print_sector`.
- `StoreContext.tsx` (reconstrução das mesas, ~linha 414): remover a liberação automática de mesa `occupied` sem pedido na consulta; manter apenas os caminhos explícitos (`freeTable`).
- `ConsumerOrderModal.tsx`: em `handleCloseAndSaveOrDiscard`/`handleFecharOrder`, não descartar quando a mesa já está ocupada; ações de reimpressão (`intent: 'reprint'`) protegidas por `effectiveAdmin`; garantir que `printed: true` seja persistido antes de fechar.
- Investigação via consulta em `orders`, `store_tables` e políticas de `orders` para o papel atendente.
- Teste: item com `printed: true` não entra no lote de envio da cozinha.
