# Correção da acentuação dos cupons

## Diagnóstico confirmado
- As impressoras de Cozinha e Recibo do Pastelão Sousa estão salvas em CP850, com modelo genérico.
- O sistema oferece um teste com sete opções, mas você informou que nenhuma linha preservou os acentos corretamente.
- O envio pelo QZ Tray usa bytes em hexadecimal. Não há evidência suficiente para atribuir o erro a uma conversão para UTF-8 nesse envio.
- **A causa exata ainda não está confirmada.** Trocar novamente para CP850 ou UTF-8 sem conferir a impressão física não garante a correção.

## Plano de correção
1. **Isolar a falha:** conferir os bytes de “ç”, “ã” e “é” desde a geração até o envio direto e pela fila, incluindo caracteres maiúsculos e acentos vindos de nomes, adicionais e observações. Corrigir qualquer alteração comprovada nesse percurso.
2. **Calibrar além das opções atuais:** ampliar o teste para combinações de tabela e índice compatíveis com o modelo real, isolando cada amostra com reinicialização para evitar interferência da anterior. Não tratar `ESC t 8` como ativação universal de UTF-8.
3. **Salvar a combinação correta por impressora:** permitir selecionar a tabela de caracteres e, quando necessário, seu índice de comando específico. Aplicar a mesma combinação à cozinha, conta, fechamento de caixa e aos cupons gerados pelo servidor de impressão, respeitando a configuração de cada destino.
4. **Validar após salvar:** imprimir uma amostra curta pela mesma impressora configurada, com “Ação, Maçã, Café, Ç, Ã, É”, e mostrar o resultado do envio na própria tela. Não confundir envio concluído com confirmação de acentos corretos no papel.

## Detalhes técnicos
- Manter opções existentes e configurações salvas compatíveis, sem alterar indiscriminadamente outras lojas.
- Preservar envio binário, configuração de setores, fila, QZ Tray e larguras de 32/16 colunas para 55/58 mm e 40/20 para 80 mm.
- Caso seja necessário guardar o índice personalizado, usar a configuração por impressora com validação de intervalo e isolamento por loja.
- Testar valores exatos de bytes, comandos de seleção, isolamento das amostras, leitura da configuração pelo destino e consistência entre impressão direta e fila.

## Confirmação física necessária
- Para escolher a combinação definitiva, será necessária uma **foto do teste impresso e a marca/modelo real da impressora**; o cadastro atual informa apenas “ESC/POS compatível”.
- Se nenhum comando compatível com o modelo resolver, investigar o modo de operação/driver antes de aplicar outra solução. Não remover acentos como correção silenciosa.