# Bloquear pedido imprime a conta + aviso de itens não impressos ao fechar

## 1. "Bloquear Pedido" imprime a conta automaticamente
- Ao ligar a chave "Bloquear Pedido" (no computador e no menu do celular), o pedido é bloqueado e a **conta é impressa na hora**, com taxa de serviço, igual ao botão "Imprimir Conta e Bloquear".
- Se ainda houver itens não enviados à cozinha, eles são enviados antes da conta (mesmo comportamento do FECHAR).
- Desbloquear não imprime nada.
- Se a impressão falhar, o pedido continua bloqueado e aparece o aviso de impressão já existente na janela.

## 2. Aviso ao fechar com itens não impressos (ESC ou X)
Hoje, ao teclar ESC com itens novos, o sistema envia sozinho para a cozinha; o X apenas salva. Passa a ser assim, nos dois casos:
- Sem itens novos: fecha e salva como hoje.
- Com itens novos: abre o aviso **"Há itens que não foram impressos"**, listando-os, com as opções:
  - **Imprimir todos** — envia para a cozinha, marca como impressos e fecha.
  - **Ignorar impressão** — salva o pedido com os itens (continuam marcados como "Novo", sem imprimir) e fecha a janela.
  - **Permanecer no pedido** — volta para a mesa.
- ESC com o aviso aberto fecha só o aviso.
- Balcão mantém a regra atual (pagar ou descartar).

## Detalhes técnicos
- `ConsumerOrderModal.tsx`: extrair a lógica do `handleFecharOrder` (enviar novos + marcar `segurado` + `printBill`) para ser chamada pelo `onCheckedChange` dos dois toggles quando `checked=true`.
- Handler do ESC e o `onClose`/X do Dialog principal passam a abrir `unsentAlertOpen` quando `items.some(i => !i.printed)`; reescrever o diálogo existente (trocar "Descartar Itens Não Enviados" por "Ignorar impressão", que salva sem remover itens).
