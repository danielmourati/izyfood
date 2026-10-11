# Botão Revisar e nova janela de Adicionais

## 1. Botão REVISAR

- Nos três rodapés do pedido mobile (categorias, produtos e produto selecionado), o REVISAR fica sempre ativo quando o pedido já tiver pelo menos um item (enviado ou não).
- Com o pedido vazio, o botão aparece esmaecido e bloqueado, evitando abrir uma revisão vazia.
- O estado é calculado a partir da lista atual de itens, então fica ativo imediatamente após lançar o primeiro item.

## 2. Janela de personalização do item

- Remover os campos "Pesquisar observações" e "Pesquisar adicionais".
- Substituir as duas colunas por duas seções recolhíveis (accordion):
  - **Adicionais (Grátis)** — opções com preço zero, incluindo "Todos os adicionais" sempre no topo. Cada uma é marcada com um botão redondo (estilo radio); tocar novamente desmarca. Pode marcar várias.
  - **Adicionais (Pagos)** — opções com preço, exibindo o valor ao lado do nome e os controles `- 0 +` como hoje.
- As duas seções abrem expandidas; o título mostra a contagem de selecionados (ex.: "Adicionais (Grátis) · 2").
- Seções vazias não são exibidas.
- O campo de texto livre de observação continua disponível abaixo, e as observações já cadastradas continuam aparecendo junto aos grátis, mantendo o que já foi escolhido ao reabrir.
- Carrinho, total e cupons continuam iguais (grátis entram como 1x, pagos somam ao preço).

## Detalhes técnicos

- `ConsumerOrderModal.tsx`: `disabled={items.length === 0}` nos botões REVISAR (linhas ~993, ~1126, ~1143).
- `ConsumerItemCustomizeModal.tsx`: remover estados/inputs de busca; separar opções ativas da categoria em `free` (preço 0, inclui tipo `note` legado) e `paid`; usar `Accordion` do shadcn (`type="multiple"`, valores padrão abertos); grátis alternam seleção em `selectedNotes`/`complements` com quantidade 1; pagos mantêm `updateCompQty`.
- Atualizar `consumer-item-customize-modal.test.tsx` para o novo layout e rodar os testes.  
Realizar autolimpeza da **Fila de impressão**