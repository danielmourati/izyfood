# Cupons de 55/58 mm com 32 colunas

## Alteração
- Aplicar **32 colunas em fonte normal** aos cupons de 55/58 mm em toda a plataforma: cozinha, conta e fechamento de caixa.
- Ajustar quebras de texto, alinhamento de valores, recuos e separadores à nova largura.
- Em fonte dupla, usar **16 colunas**, respeitando o dobro da largura dos caracteres.
- Atualizar as prévias e a indicação na tela de impressoras para refletir o mesmo padrão.
- Manter os cupons de **80 mm com 40 colunas** em fonte normal e 20 em fonte dupla.

## Detalhes técnicos
- A regra compartilhada `receiptColumnsForWidth` atualmente retorna 27 para papéis de até 58 mm; alterar para 32. A opção da tela agrupa 55 e 58 mm, portanto ambas seguirão o novo padrão.
- Revisar os limites específicos de bobina compacta nos formatadores e testes, sem substituir números não relacionados à largura.
- Preservar o layout Menuzin, a codificação calibrada de acentos, o destino das impressoras, a fila e a conexão QZ Tray.
- A mudança valerá para cupons gerados após a atualização; não reenviar automaticamente cupons já impressos.

## Validação
- Executar testes dos três tipos de cupom nas larguras 55, 58 e 80 mm, com fonte normal e dupla.
- Verificar limites explícitos de 32/16 colunas para bobina compacta e 40/20 para 80 mm, incluindo nomes longos, adicionais, observações e valores.
- Conferir a indicação de 32 colunas na tela de impressoras e a correspondência das prévias com o conteúdo térmico.
- Confirmar a saída física com um cupom de teste na impressora de 55/58 mm; essa confirmação depende do aparelho do usuário.