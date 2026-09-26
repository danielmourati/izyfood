# Corrigir seleção de observações e complementos no mobile

## Objetivo
Fazer o quarto botão do rodapé verde abrir corretamente a personalização do item selecionado, com visual mobile inspirado no anexo 2 e ícone de lista marcada inspirado no anexo 3.

## Correções
- Montar a janela de personalização também dentro do fluxo mobile; atualmente ela está somente após o retorno da versão desktop, então o clique altera o estado, mas a janela não é renderizada no celular.
- Manter o botão ligado ao item não enviado selecionado. Se ele existir, abrir para edição preservando quantidade, observações e complementos, sem duplicar a linha do pedido.
- Garantir que apenas observações e complementos ativos vinculados à categoria do produto sejam exibidos.
- Trocar o check simples por um ícone de lista com marcas, visualmente equivalente ao anexo 3, usando um ícone vetorial nativo para permanecer nítido e acompanhar a cor do botão.
- Remover o tamanho reduzido imposto ao quarto botão e deixá-lo com a mesma largura, altura, borda e alinhamento dos botões `+ 1`, `- 1` e excluir.

## Janela mobile
- Adaptar a janela ao modelo do anexo 2: tela vertical, seções empilhadas, observações com seleção visível, complementos com controles de quantidade e rodapé fixo com `VOLTAR` e `OK`.
- Manter a apresentação atual de duas colunas em telas maiores.
- No botão `OK`, atualizar o item existente, seu subtotal e o total do pedido.

## Validação
- No celular, selecionar um produto e tocar no ícone de lista marcada; a janela deve abrir imediatamente.
- Confirmar que as opções pertencem somente à categoria do produto.
- Selecionar observações e complementos, salvar, reabrir e confirmar que tudo permanece marcado.
- Confirmar que não surge item duplicado e que complementos pagos alteram o total.
- Comparar os quatro botões do rodapé para garantir larguras e alturas iguais.
- Executar os testes da personalização e validar o fluxo em viewport mobile.
