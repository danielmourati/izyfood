# Um botão de teste + Zezinho tudo na Cozinha

## 1. Apenas um botão "Imprimir teste"
Na tela de Impressoras do celular aparecem dois botões "Imprimir teste": um no cartão "Servidor de impressão (Caixa)" e outro no rodapé, ao lado de Salvar/Concluir.
- Manter só o do cartão do Servidor de impressão (no celular).
- Remover o do rodapé no celular. No computador, onde o cartão do servidor não aparece, o botão do rodapé continua sendo o único.

## 2. Zezinho: tudo sai na Cozinha, numa só comanda
Situação atual no Zezinho:
- Os 91 produtos usam "Padrão da categoria".
- 5 categorias de bebidas (Cerveja 600ml, Cerveja Long Neck, Bebidas Geladas, Bebidas Quentes, Drink's) estão em "Recibo (Caixa)"; as outras 3 já vão para a Cozinha.

Mudança (só nos dados do Zezinho):
- Trocar "Imprimir em" dessas 5 categorias de Recibo (Caixa) para Cozinha.
- Conferir que nenhum produto fique fixado em Recibo (hoje nenhum está).
- Como todos os itens passam a ter o mesmo destino, o pedido sai numa única comanda na Cozinha, com comidas e bebidas juntas.
- Conta, fechamento de caixa e recibo de pagamento continuam saindo no Caixa.

## Detalhes técnicos
- `ImpressoraTab.tsx`: esconder o botão de teste do rodapé quando `isMobileDevice()`.
- Atualizar dados: `UPDATE categories SET print_sector='cozinha' WHERE tenant_id=<zezinho> AND print_sector='recibo'`; mesmo para `products`.
- Validar com consulta de leitura depois.
