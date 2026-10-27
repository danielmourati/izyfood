Exportar o cardápio da loja Pastelão Junin em arquivos CSV

O que vou entregar (na área de Arquivos, separados por vírgula, acentos preservados, preços com vírgula decimal):

1. categorias.csv: nome da categoria, setor de impressão.
2. produtos.csv: categoria, nome, código, descrição, preço, preço de custo, disponível (Sim/Não), link da foto, tipo (unidade/peso).
3. tamanhos_precos.csv: produto base, tamanho, preço. Os tamanhos ficam no nome do produto, por exemplo "Mineiro (Grande)", então vou separar o nome e o tamanho. Produtos sem tamanho ficam como "Único".
4. adicionais.csv: nome, preço, categorias onde aparece, ativo.
5. observacoes.csv: observações e sabores (sem preço ou de preço zero), com classificação (Sabor/Observação), categorias e ativo.

Regra de "disponível": o cardápio não tem uma chave liga/desliga por produto. Vou considerar "Não" quando o produto controla estoque e está com estoque zero, e "Sim" nos demais casos.

Fotos sem link ficam em branco.

Nada no aplicativo ou nos dados da loja é alterado; é só leitura.

## Detalhes técnicos
- Consultas somente leitura nas tabelas de categorias, produtos e opções de observações, filtrando pelo id da loja com slug pastelao-junin.
- Tamanho extraído do último trecho entre parênteses do nome.
- Adicionais = type/classification de adicional com preço; o resto vai para observações.
- Arquivos gerados em /mnt/documents/pastelao-junin/ e conferidos (quantidade de linhas e acentos) antes de entregar.
