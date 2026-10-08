# Corrigir cupons que continuam quebrando linha

## O que foi encontrado
- As duas impressoras do Quintal de Casa ("Caixa (recibo)" e "Cozinha") estão cadastradas com bobina de **58 mm**. Com isso, o sistema usa a regra de 27 colunas e nunca chega às 42 colunas — por isso a conta continua quebrando linha, mesmo com a mudança já no código.
- A prévia do cupom no PDV também assume 58 mm quando não há impressora padrão marcada (nenhuma das duas está marcada como padrão).
- O endereço publicado (degust.app) só recebe as mudanças depois de publicar novamente; se o teste foi feito lá, ele ainda usa a versão antiga.

## O que será feito
1. Alterar as duas impressoras do Quintal de Casa para **80 mm** (42 colunas), mantendo nome, setor e demais ajustes.
2. Marcar "Caixa (recibo)" como impressora padrão, para que conta, fechamento de caixa e prévias usem a largura correta.
3. Trocar o valor de reserva da prévia do PDV de 58 mm para 80 mm, alinhado com o restante do sistema.
4. Ao cadastrar nova impressora, manter 80 mm como padrão (já é) e mostrar ao lado do campo "Largura" quantas colunas serão usadas (58 mm = 27, 80 mm = 42), para evitar a confusão novamente.
5. Validar: imprimir a conta pela prévia e conferir que as linhas usam 42 colunas sem quebra; rodar os testes de cupom.
6. Indicar a publicação para levar a correção ao degust.app.

## Observação sobre acentos (UTF-8)
Os cupons já são enviados em UTF-8 com o comando de ativação. Se a impressora não suportar UTF-8, os acentos podem sair trocados — nesse caso, avise e ajustamos.

## Detalhes técnicos
- Dados: `UPDATE printer_configs SET paper_width = 80` para os dois registros do tenant `quintal-de-casa`; `is_default = true` no setor `recibo`.
- `src/pages/PDV.tsx`: `previewPaperWidth` fallback `58` -> `80`.
- `src/components/ImpressoraTab.tsx`: texto auxiliar usando `receiptColumnsForWidth(form.paper_width)`.
- Sem mudança em `receiptColumnsForWidth` (58->27, 80->42), conforme regra em `AGENTS.md`.
