# Adaptar os cupons do Menuzin ao Degust

## Referência confirmada
- O código do Menuzin utiliza blocos de produtos com quantidade, nome destacado, adicionais recuados e separadores; nomes longos continuam alinhados e palavras maiores que a linha são hifenizadas.
- A comanda de cozinha não apresenta valores. Na conta, os valores unitário e total aparecem em uma linha própria abaixo do produto.
- O Menuzin usa 32 colunas em 55 mm e 42 em 80 mm no modo padrão. O Degust usa 27 e 40, respectivamente; a adaptação manterá estas larguras úteis para não reintroduzir as quebras já corrigidas.

## Alterações
1. **Comandas de cozinha:** aplicar a organização visual do Menuzin, com nomes destacados, continuação alinhada à quantidade, adicionais recuados e separadores entre produtos. Preservar `MESA: 02`, ausência de ID, atendente responsável e observações gerais. Produtos, adicionais e observações continuam respeitando a opção de fonte padrão/dupla de cada impressora.
2. **Contas:** organizar cada produto em um bloco com nome e quantidade, adicionais e valores unitário/total em linha própria, seguido por separador. Adotar o aviso de documento não fiscal da referência. Preservar valores registrados, descontos, taxa de serviço, adiantamentos, pagamentos divididos e informações da loja.
3. **Fechamento de caixa:** aplicar a mesma hierarquia de títulos, separadores e alinhamento de valores, mantendo os dados e cálculos do caixa do Degust. O resumo de entregas encontrado no Menuzin não substituirá o fechamento de caixa.
4. **Prévias e impressão pelo navegador:** reproduzir as mesmas linhas e larguras da impressão térmica, sem uma segunda organização baseada em tamanhos de texto independentes. Aplicar a todos os cupons, nas bobinas compactas de 55/58 mm e nas de 80 mm.
5. **Preservar funcionamento:** manter acentos pela tabela calibrada de cada impressora, escolha de setor, destino do fechamento no Caixa, fila e conexão QZ Tray. Não copiar a remoção de acentos nem as opções de delivery/retirada do Menuzin.

## Validação
- Testar bobina compacta e 80 mm, fonte padrão e dupla, nomes longos, palavras extensas, adicionais, observações multilinhas e acentos.
- Conferir que nenhuma linha ultrapassa a largura ativa e que separadores e continuação dos nomes permanecem alinhados.
- Comparar conteúdo e quebras entre impressão térmica, prévia e navegador, incluindo os totais e pagamentos da conta e do caixa.
- Executar os testes de impressão e conferir as prévias na aplicação. A qualidade física da saída exigirá um teste nas impressoras reais.

## Detalhes técnicos
- Compartilhar a formatação das linhas entre `escpos.ts`, `receipt-preview.ts` e os geradores HTML de `use-printer.ts`, adaptando o recuo pendente e a hifenização de `wrapIndent` do Menuzin.
- Manter `receiptColumnsForWidth` como regra única: 27 colunas para bobina compacta e 40 para 80 mm; fonte dupla utiliza metade da largura ativa.
- Transmitir largura e modo de fonte da impressora de destino também às prévias, incluindo `PrintPreviewModal` e fechamento de caixa.
- Atualizar os testes pertinentes e registrar a regra de formatação compartilhada em `AGENTS.md`.