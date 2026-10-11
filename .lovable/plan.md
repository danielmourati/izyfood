# Layout da comanda de cozinha em bobina compacta

## Resultado esperado

- Fazer a comanda de cozinha respeitar a opção configurada em cada impressora: **fonte dupla** ou **fonte padrão**.
- Inserir uma linha separadora entre todos os produtos, incluindo seus adicionais, no formato `-------------`, ocupando exatamente a largura disponível no modo ativo.
- Quebrar nomes de produtos, adicionais e observações somente nos limites reais da linha, preservando palavras inteiras sempre que possível e mantendo a continuação alinhada.
- Manter cabeçalho e identificação da mesa destacados, sem alterar o conteúdo obrigatório da comanda.

## Correção

1. Centralizar o cálculo de largura da comanda a partir da bobina e do modo de fonte:
   - bobina compacta configurada como 58/55 mm: 27 colunas em fonte padrão e a capacidade equivalente em fonte dupla;
   - 80 mm: 40 colunas em fonte padrão e a capacidade equivalente em fonte dupla.
2. Aplicar `double_font_orders` de fato aos produtos, adicionais e observações. Hoje a montagem ativa fonte dupla incondicionalmente, mesmo quando a opção da impressora está desligada.
3. Criar um formatador próprio para blocos de item, para que quantidade + nome, título dos adicionais e cada adicional usem a mesma largura ativa e uma indentação consistente nas linhas seguintes.
4. Imprimir o separador após cada bloco completo de produto, evitando separadores duplicados no início ou no fim da lista.
5. Ajustar a versão de impressão pelo navegador para seguir a mesma organização visual e respeitar o modo de fonte selecionado.

## Validação

- Adicionar testes para bobina compacta em fonte padrão e dupla, verificando:
  - nenhuma linha excede a quantidade ativa de colunas;
  - palavras comuns não são cortadas no meio;
  - adicionais permanecem junto do produto;
  - existe exatamente um separador entre produtos;
  - os comandos de fonte dupla só aparecem quando configurados.
- Cobrir também 80 mm para garantir que a regra compartilhada não cause regressão.
- Executar os testes de impressão e confirmar a compilação final.

## Detalhes técnicos

- Alterar a montagem em `src/lib/escpos.ts`, substituindo o `Math.floor(cols / 2)` fixo por uma função compartilhada de colunas ativas por modo de fonte.
- Fazer `buildOrderHtml` em `src/hooks/use-printer.ts` consumir `doubleFontOrders` e representar os separadores entre itens.
- Atualizar `src/test/escpos.test.ts` com casos de nomes e adicionais longos nos dois modos.
- Atualizar a decisão de arquitetura sobre comandas em `AGENTS.md`, pois a configuração da impressora passará a controlar o tamanho dos produtos e adicionais.
