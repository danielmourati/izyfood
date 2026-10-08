# Padronizar tela e cupons de impressão

## Objetivo

Organizar as configurações de impressão e eliminar diferenças de codificação e quebra entre a prévia e o cupom impresso.

## Alterações

1. **Reorganizar a tela de Impressoras**
   - Manter **Onde imprimir** como a primeira seção de configuração.
   - Mover para depois dela o card **Este aparelho imprime para os outros (Caixa)**, incluindo a fila de impressão.
   - Mover também para depois dela o card **Conexão impressora Bluetooth (dispositivo local)**.
   - Preservar os controles, estados e ações atuais desses cards; será alterada apenas a posição na tela.

2. **UTF-8 como padrão único**
   - Centralizar a inicialização ESC/POS em UTF-8 para comanda, conta e fechamento de caixa.
   - Remover o caminho legado de codificação CP860 que não é mais utilizado, evitando interpretações divergentes de acentos.
   - Manter UTF-8 também no conteúdo impresso pelo navegador e no QZ Tray.
   - Cobrir caracteres do português, incluindo `ç`, `ã`, `á`, `é` e nomes de produtos com acentos.

3. **Padronizar a largura dos cupons**
   - Usar **42 colunas úteis nas impressoras de 80 mm**, conforme definido.
   - Manter uma largura segura específica para impressoras de 58 mm, sem forçar 42 caracteres em uma bobina que não comporta essa medida em fonte normal.
   - Aplicar a mesma largura à comanda, conta, fechamento de caixa e prévia exibida no sistema.
   - Ajustar a divisão entre nome/descrição e preço para que valores permaneçam alinhados e nomes longos quebrem de forma previsível.

4. **Verificação**
   - Testar cupons de 58 mm e 80 mm com nomes, adicionais, valores e textos acentuados.
   - Confirmar que nenhuma linha da conta ultrapassa sua largura útil e que a prévia reproduz as mesmas quebras da impressão real.
   - Validar comanda, conta e fechamento de caixa, além da tela de Impressoras em computador e celular.

## Detalhes técnicos

- A função compartilhada de largura será a fonte única para os geradores ESC/POS e para a prévia textual.
- Para 80 mm, a largura útil passará de 44 para 42 colunas.
- Para 58 mm, será adotado um único valor seguro em todos os caminhos, eliminando a divergência atual entre 27 colunas na impressão e 30 na prévia.
- Os testes existentes serão atualizados para refletir a nova regra e serão incluídas verificações explícitas de UTF-8 e limite de 42 colunas.
