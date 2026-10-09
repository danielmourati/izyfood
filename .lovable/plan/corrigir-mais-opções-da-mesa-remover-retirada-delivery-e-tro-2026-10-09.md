# Corrigir "Mais opções" da mesa: remover Retirada/Delivery e trocar de mesa

## O que muda

Na janela do pedido (Mesas e Balcão), o menu **Mais opções → Trocar para...** passa a oferecer apenas:

1. **Mesa/Comanda** — em vez de trocar o tipo na hora, abre uma nova janela listando **somente as mesas livres** (botões numerados, no mesmo estilo da tela de Mesas). A mesa atual não aparece na lista. Ao escolher uma mesa:
   - o pedido passa a pertencer à nova mesa (número atualizado no pedido);
   - a mesa antiga fica **livre** e a nova fica **ocupada** com este pedido;
   - a janela do pedido continua aberta, já mostrando a nova mesa no título;
   - aviso de confirmação: "Pedido movido para Mesa X".
   - Se não houver nenhuma mesa livre, mostra a mensagem "Nenhuma mesa livre no momento."
2. **Balcão** — mantém o comportamento atual (converte o pedido para balcão).

As opções **Retirada** e **Delivery** são **removidas** desse menu.

Se o pedido já for do Balcão, o menu mostra apenas "Mesa/Comanda" (abrindo a lista de mesas livres) — ao escolher uma mesa, o pedido vira pedido de mesa naquela mesa.

## Detalhes técnicos

- Arquivo: `src/components/consumer/ConsumerOrderModal.tsx`.
- Remover os botões `Retirada` e `Delivery` do diálogo "Trocar para..." (linhas ~1883-1897) e o tipo correspondente de `handleChangeOrderType` quando aplicável.
- Novo estado/diálogo `tablePickerOpen`: ao clicar em "Mesa/Comanda", abre grade de botões com as mesas livres, calculadas como em `Mesas.tsx` (mesas sem pedido ativo: `tables` filtradas por status/`orderId` e `orders` finalizados), excluindo a mesa atual do pedido.
- Ao escolher a mesa: atualizar `currentOrder` (`tableNumber`, `orderType: 'mesa'`), chamar `onSaveOrder`, liberar a mesa antiga (`freeTable`) e ocupar a nova (`occupyTable`) — o modal já recebe `tables`, `setTables`, `occupyTable`, `freeTable` do `useStore`.
- Nenhuma mudança no banco de dados, na impressão ou no fluxo de pagamento.

## Validação

- `tsgo` + testes existentes.
- Conferir na prévia: abrir uma mesa ocupada → Mais opções → Trocar para... → escolher mesa livre → pedido aparece na nova mesa e a antiga fica livre.
