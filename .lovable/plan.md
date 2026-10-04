# Redesenhar login e cadastro de produtos

## Resultado esperado
- Login em tela única, sem o painel esquerdo, com o formulário centralizado e a marca original Degust em destaque.
- Visual baseado na direção **Modern Centered Card**, adaptado à paleta escolhida: creme `#FBF4DB`, creme dourado `#F3E7B3`, vermelho `#D8392F` e verde `#2D6A4F`.
- Tipografia **Outfit** nos títulos e **Figtree** nos textos.
- Produtos exibidos em uma tabela compacta, sem imagens, mantendo cadastro, edição e exclusão.

## Implementação

### 1. Login centralizado
- Remover integralmente o painel promocional esquerdo e seus benefícios.
- Criar um fundo claro em camadas suaves de creme, vermelho e verde, sem elementos que prejudiquem a leitura.
- Centralizar uma caixa translúcida compacta com o logotipo horizontal original do Degust, título, campos de e-mail e senha, recuperação de senha, erro inline e botão Entrar.
- Preservar o fluxo atual de autenticação e recuperação de senha.
- Adaptar a composição para celular e desktop, mantendo o formulário inteiro visível.

### 2. Produtos em tabela compacta
- Substituir a grade atual de cards com área de imagem por uma tabela responsiva sem fotos.
- Exibir colunas úteis para operação: código, produto, categoria, preço de venda, estoque, situação e destino de impressão.
- Manter busca e filtro por categoria no topo.
- Manter ações de editar e excluir no fim de cada linha, usando os componentes de botão existentes e rótulos acessíveis.
- Em telas estreitas, preservar a estrutura em linhas com rolagem horizontal controlada, sem voltar ao formato de cards.

### 3. CRUD e formulários
- Reaproveitar e estabilizar o CRUD já existente de produtos: novo produto, edição e exclusão com confirmação.
- Manter o formulário atual dividido em Dados principais, Configurações e Estoque.
- Preservar máscara BRL, categoria, controle de estoque, fornecedor, fidelidade, taxa de serviço e impressora por setor.
- Remover código residual de envio ou exibição de fotos do cadastro de produtos.
- Manter os gerenciamentos atuais de categorias, observações e complementos.

### 4. Sistema visual
- Aplicar os tokens semânticos da paleta escolhida, sem cores soltas nos componentes alterados.
- Carregar Outfit e Figtree no documento e atualizar os tokens tipográficos globais.
- Manter contraste, foco visível e suporte ao tema escuro nas áreas internas.

### 5. Validação
- Conferir visualmente o login em desktop e celular.
- Conferir busca, filtro, criação, edição e exclusão na tabela de produtos.
- Rodar testes, verificação de tipos e confirmar que o projeto compila sem erros.

## Fora do escopo
- Não alterar regras de pedidos, estoque, impressão ou permissões.
- Não modificar dados existentes no banco.
- Não reativar importação CSV nem fotos de produtos.
