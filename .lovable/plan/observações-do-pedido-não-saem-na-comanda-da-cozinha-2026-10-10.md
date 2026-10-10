# Observações do pedido não saem na comanda da cozinha

## Causa confirmada
O campo "Observações do pedido" no celular atualiza só o estado local (`generalNotes`) e dispara o salvamento no banco (`onSaveOrder`), mas **nunca atualiza o pedido em memória** (`currentOrder`). Ao tocar em ENVIAR ou FECHAR, a comanda é montada a partir de `currentOrder` — que ainda tem as observações antigas/vazias — então o bloco `OBS:` sai em branco mesmo com o texto salvo no banco. O mesmo padrão se repete nos três campos de observação do modal (linhas ≈1104, 1328 e 1548 de `ConsumerOrderModal.tsx`).

A geração do cupom em si está correta: `buildOrderReceipt` (ESC/POS) e a prévia HTML já imprimem `OBS:` em fonte dupla quando `pickupNotes` chega preenchido, e a divisão por setor de impressão preserva o campo.

## Correção
- Nos três campos de observação do `ConsumerOrderModal.tsx`, atualizar também `currentOrder` (`setCurrentOrder`) junto com o `onSaveOrder`, mantendo memória e banco sincronizados.
- Como proteção extra, na hora de montar o objeto para impressão (ENVIAR e FECHAR), usar as observações digitadas no momento (`generalNotes`) em vez de depender apenas do estado salvo.
- Garantir que o bloco `OBS:` continue em fonte dupla ao final dos itens, na impressão térmica e na prévia do navegador.

## Validação
- No celular: abrir uma mesa, adicionar item, escrever observação em duas linhas e tocar em ENVIAR — a comanda deve sair com o bloco `OBS:` e o texto completo.
- Repetir com FECHAR e com a prévia de impressão do navegador.
- Rodar os testes de impressão (`escpos.test.ts`) e a verificação de tipos.

## Detalhes técnicos
- `src/components/consumer/ConsumerOrderModal.tsx`: nos `onChange` das linhas ≈1104, 1328 e 1548, adicionar `setCurrentOrder({ ...currentOrder, pickupNotes: value })`; em `handleEnviarOrder` e `handleFecharOrder`, montar `orderToPrint` com `pickupNotes: generalNotes` (fallback para `currentOrder.pickupNotes`).
- Nenhuma mudança necessária em `escpos.ts`, `use-printer.ts` ou `receipt-preview.ts` — eles já tratam o campo corretamente.
