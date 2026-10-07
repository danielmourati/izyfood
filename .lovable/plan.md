# Copiar cardápio do Menuzin para a loja Pastelão Sousa no Degust

## O que será feito
1. **Ler os dados do Menuzin**: abrir o projeto Menuzin para ver como categorias, produtos, adicionais e logotipo ficam guardados, e ler os dados da loja `pastelao-sousa` pelo acesso público do cardápio (o mesmo que a página usa).
2. **Limpar a loja no Degust** (Pastelão Sousa): apagar as categorias, os produtos, as observações e os complementos atuais. Pedidos, vendas, clientes, caixa e usuários não são alterados.
3. **Importar e adaptar**:
   - Categorias, com a mesma ordem e os mesmos nomes.
   - Produtos: nome, descrição, preço (em reais), categoria e código. Venda por unidade, sem controle de estoque e sem foto (o Degust não usa foto no cadastro). "Imprimir em" fica no padrão da categoria (Cozinha).
   - Adicionais do Menuzin: os que têm preço viram **Complementos**, e os que não têm viram **Observações**, ligados às categorias certas.
   - Itens esgotados ou ocultos no Menuzin entram como inativos.
4. **Logotipo**: baixar o logo do Menuzin, guardar no armazenamento do Degust e definir como logo da loja.
5. **Conferir**: comparar a quantidade de itens nos dois sistemas e abrir o PDV da loja para ver o cardápio.

## Fora do escopo
- Clientes, pedidos e configurações de entrega ou WhatsApp do Menuzin.
- Grupos de opções com mínimo e máximo de escolha. Se o Menuzin tiver esse tipo de regra, viram uma lista simples de observações ou complementos, porque o Degust ainda não tem essas regras.

## Detalhes técnicos
- `cross_project--checkout_project` no Menuzin (ebe8f6a8…) para descobrir o esquema, a URL e a chave pública. Depois, leitura via REST com a chave pública e as policies públicas do cardápio. Se alguma tabela estiver bloqueada, faço a leitura pela própria página publicada.
- Tenant de destino: `2497a989-95fa-44de-8cb8-7b3b12903b31`.
- Gravação com `supabase--run_sql`: DELETE em `product_note_options`, `products` e `categories` onde `tenant_id` é o tenant de destino, sempre nessa ordem. Antes, anulo o `category_id` dos produtos que ainda estiverem ligados. Depois vêm os INSERTs com ids novos e o mapeamento de categoria antiga para nova em `category_ids` (jsonb).
- Logo: upload no bucket `tenant-assets/<tenant_id>/logos/`, depois UPDATE em `tenants.logo`.
