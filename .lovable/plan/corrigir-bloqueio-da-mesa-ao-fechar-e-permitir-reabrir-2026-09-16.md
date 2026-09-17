# Corrigir bloqueio da mesa ao Fechar e permitir Reabrir

## Problema

Ao clicar em **FECHAR** na comanda da mesa, o bloqueio aparece apenas no aparelho que clicou. Em outro celular ou no PC a mesa continua "Em aberto", e ao recarregar a tela o bloqueio desaparece.

Causa confirmada na leitura do código: o bloqueio é guardado só na memória do aparelho. Na gravação do pedido, o estado "bloqueado" não é enviado ao banco (o pedido continua sendo salvo como "aberto"), enquanto a leitura considera bloqueado apenas quando o pedido está gravado como "segurado". Ou seja: nada é gravado, então nada é sincronizado.

## O que muda

1. **Fechar bloqueia de verdade**
   Ao clicar em FECHAR, o pedido passa a ser gravado como bloqueado (mesa "segurada"), com data/hora do fechamento. Isso viaja pelo tempo real e aparece em segundos em todos os aparelhos, e continua bloqueado depois de recarregar.

2. **Botão Enviar vira Reabrir**
   Quando a mesa está bloqueada, o botão laranja ENVIAR passa a mostrar **REABRIR**. Ao clicar, a mesa volta ao estado em aberto (gravado no banco), liberando novos lançamentos, também refletido em todos os aparelhos.

3. **Enquanto bloqueada**
   A mesa permanece ocupada e com o valor visível, aparecendo com o indicador de bloqueio na tela de Mesas em qualquer dispositivo. Lançar/remover itens só depois de reabrir. Pagar/finalizar continua disponível para quem tem permissão.

4. **Permissão**
   Reabrir segue a mesma regra de permissão já usada para fechar a mesa (administrador ou atendente autorizado).

## Detalhes técnicos

- `src/contexts/StoreContext.tsx`: no `syncOrders`, derivar o `status` gravado a partir de `isLocked` (`isLocked === true` → `segurado`; ao desbloquear → `aberto`), e preencher/limpar `held_at`. Manter o mapeamento de leitura `isLocked: r.status === 'segurado'` como fonte única de verdade.
- `src/components/consumer/ConsumerOrderModal.tsx`:
  - `handleFecharOrder`: incluir `status: 'segurado'` e `heldAt` no pedido salvo (além de `isLocked: true`).
  - Novo `handleReabrirOrder`: valida `canManageMesa`, grava `isLocked: false`, `status: 'aberto'`, `heldAt: undefined` via `onSaveOrder`, atualiza estado local e mantém o modal aberto para novos lançamentos.
  - Rodapé: quando `isLocked`, o botão laranja renderiza "REABRIR" (ícone de desbloqueio) chamando `handleReabrirOrder`, habilitado independentemente de `hasNewUnsentItems`; quando não bloqueada, permanece ENVIAR com o comportamento atual. FECHAR fica desabilitado enquanto a mesa já estiver bloqueada.
  - Sincronizar `isLocked` vindo do `order` recebido por realtime enquanto o modal está aberto, para que o bloqueio feito em outro aparelho apareça sem fechar o modal.
- `src/pages/Mesas.tsx`: nenhuma mudança de regra necessária — `isBlocked`/`activeMesaOrders` já reagem a `isLocked`/`segurado`.

## Validação

- Celular fecha a mesa → PC mostra a mesa em amarelo/bloqueada em poucos segundos; F5 mantém bloqueada.
- No aparelho bloqueado, botão mostra REABRIR; ao clicar, mesa volta a "Em aberto" nos dois aparelhos.
- Mesa bloqueada nunca é liberada nem apagada; segue ocupada com o valor.
