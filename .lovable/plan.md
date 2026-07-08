## Plano

Corrigir a impressão da comanda de cozinha para que observações de checkbox como “gelo e limão” sejam enviadas à impressora física mesmo quando aparecem imediatamente após a descrição do item no preview.

## O que será alterado

1. **Gerador ESC/POS da comanda**
   - Ajustar a impressão das observações para emitir cada linha de observação com terminação de linha explícita e modo normal/alinhado à esquerda antes de imprimir.
   - Evitar que a observação logo após o nome do item seja “engolida” por impressoras Bluetooth sensíveis a sequência de comandos de negrito/quebra de linha.
   - Manter quebra de texto segura para 58mm e 80mm.

2. **Paridade preview x impressão**
   - Criar/usar um helper textual para montar a comanda de cozinha em formato simples e comparar com o ESC/POS decodificado nos testes.
   - Garantir que “Coca Lata” + checkbox “gelo e limão” apareça tanto no preview quanto no buffer físico.

3. **Envio Bluetooth**
   - Revisar o envio em chunks para reduzir chance de corte no meio de linhas pequenas, sem mudar o fluxo visual do app.
   - Se necessário, diminuir chunk e/ou garantir pausa mínima entre blocos para impressoras BLE mais instáveis.

4. **Testes de regressão**
   - Adicionar teste específico para item curto: `Coca Lata` seguido imediatamente de `* gelo e limão`.
   - Adicionar teste verificando que a linha de observação vem depois da linha do item e antes de complementos/rodapé.
   - Rodar os testes de impressão existentes para confirmar que não quebra conta, complementos e observações longas.

## Fora do escopo

- Não alterar banco de dados, autenticação, permissões ou cadastro de produtos.
- Não redesenhar o modal de observações.
- Não mudar a regra de preço/complementos.