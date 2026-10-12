# Separar sabores de pastéis e adicionais

## Resultado esperado
- No cadastro de Adicionais, incluir a classificação **Sabor** ou **Adicional**, conforme sua escolha.
- Agrupar as opções selecionadas em **Sabores:** e **Adicionais:**, com os dois títulos em negrito, mesmo quando houver apenas uma opção.
- Exibir cada opção em uma linha com marcador; não mostrar grupos vazios.
- Ocultar a quantidade quando for uma unidade: `- Queijo`. Mostrar somente quantidades maiores que uma: `- 2x Queijo`.

```text
Pastel
Sabores:
- Carne
- Queijo
Adicionais:
- Azeitona
- 2x Bacon
```

## Cadastro e seleção
- Acrescentar o campo de classificação ao criar ou editar uma opção e mostrar a classificação na listagem.
- Manter os registros existentes como Adicional até que sejam classificados manualmente, sem adivinhar pelo nome ou preço.
- Na personalização, apresentar Sabores separados dos accordions Adicionais (Grátis) e Adicionais (Pagos).
- Permitir selecionar um ou vários sabores, preservando os preços e os controles de quantidade das opções pagas.
- Manter “Todos os adicionais” no topo dos adicionais e limitado a esse grupo, sem selecionar sabores automaticamente.

## Exibição e impressão
- Aplicar os grupos nos detalhes dos itens do pedido, carrinho, conta, comanda da cozinha e prévias que compartilham esses detalhes.
- Usar marcador de lista na tela e hífen na impressão, compatível com as tabelas de acentuação.
- Preservar observações livres, cálculos, atendente, setores de impressão e a configuração de fonte de cada impressora.
- Respeitar 32/16 colunas em 55/58 mm e 40/20 em 80 mm, inclusive nos títulos e linhas de continuação.

## Detalhes técnicos
- O código consultado reúne atualmente observações e complementos em uma lista única e guarda as opções selecionadas sem classificação.
- Verificar a estrutura atual da tabela `product_note_options` antes da migração; adicionar a classificação sem alterar a separação entre lojas ou permissões existentes.
- Propagar a classificação pelo cadastro e sincronização do StoreContext e salvar uma cópia junto à opção selecionada no pedido, para que mudanças futuras no cadastro não alterem pedidos novos já registrados.
- Centralizar a separação dos grupos e a formatação de quantidade nos helpers compartilhados, utilizados pelas telas e pelos cupons térmicos; HTML e texto continuarão derivados do cupom térmico.
- Para pedidos antigos sem classificação, manter as opções em Adicionais; não reclassificar o histórico automaticamente.

## Validação
- Testar um sabor, vários sabores, adicionais grátis/pagos, quantidade 1 e quantidade 2, ausência de grupos e compatibilidade com pedidos antigos.
- Conferir salvar, reabrir e editar um pedido com sabores e adicionais separados.
- Validar negrito e limites de linha nas prévias e nos cupons de 55/58 e 80 mm, em fonte normal e dupla.
- A confirmação final no papel dependerá de um teste na impressora física.
