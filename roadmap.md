# Roadmap

- [ ] Importar e adaptar o cardápio público Menuzin de pastelaojunin à loja pastelao-junin sem duplicar produtos existentes; conferir preços, categorias e opções disponíveis.

- [x] Remover Cupons e Auditoria das configurações e a recuperação de senha da tela de entrada; manter dados e registros internos.

- [x] Garantir um único servidor de impressão por tenant e bloquear ativação nos demais aparelhos; trava atômica e validação do dono aplicadas no banco.
- [x] Incluir cupons falhos nas tentativas automáticas; 21 testes aprovados, incluindo bloqueio por aparelho e recuperação da fila.
- [ ] Conferir bloqueio com duas sessões reais e saída física de cupom falho — depende de login na prévia e impressora física disponível.

- [x] Classificar sabores no cadastro e separar Sabores/Adicionais nas telas e cupons; testes de quantidades e reabertura aprovados.
- [ ] Conferir cadastro e pedido com login real e impressão física — sessão automática indisponível; depende de login na prévia e teste no papel.

- [x] Corrigir formato QZ 2.x para command/hex, ampliar calibração com amostras isoladas, permitir índice validado por impressora e amostra da configuração salva; 79 testes aprovados.
- [ ] Confirmar acentos na impressora física e escolher calibração definitiva — aguarda foto do novo teste e marca/modelo real; tela autenticada não verificada por ausência de sessão disponível.

- [x] Destacar o tipo e o número do pedido na comanda.
- [x] Adicionar fonte dupla por impressora.
- [x] Adicionar duas vias somente para pedidos novos.
- [x] Preservar a intenção pela fila do Caixa e separar reimpressões.
- [x] Validar tipagem, testes da cozinha e compilação.
- [x] Mover fila e conexão Bluetooth para depois de Onde imprimir.
- [x] Aplicar UTF-8 compatível com o perfil Bematech e largura compartilhada de 27/40 colunas.
- [x] Validar cupons, prévia e compilação final.
- [x] Acentuação por impressora (CP850 padrão) com folha de teste de calibração.
- [x] Teste de acentuação na Bematech: linhas 1, 2 e 3 corretas; mantida a opção 1 (CP850).
- [x] Substituir o ID pela mesa e fixar fonte dupla no cabeçalho, produtos e adicionais das comandas da cozinha.
- [x] Balcão no fluxo das Mesas; PDV removido
- [x] Fixar o atendente que abriu o pedido e exibi-lo nas comandas e contas.
- [x] Listar administradores e atendentes cadastrados e permitir troca do responsável somente por admin.
- [x] Adequar comandas compactas às colunas ativas, fonte configurada e separadores entre itens.
- [x] Desativar por padrão e isolar por atendente/aparelho a opção de usar impressora neste dispositivo.
- [x] Adaptar layout Menuzin aos cupons de cozinha, conta e caixa, mantendo larguras e calibração.
- [x] Unificar prévias e navegador com a impressão térmica; 56 testes e prévias com pedido real validados.
- [x] Aplicar 32 colunas normais / 16 duplas em 55/58 mm a todos os cupons e prévias, preservando 40/20 em 80 mm; 61 testes e 12 prévias validados. Indicação da tela usa a regra compartilhada; conferência autenticada bloqueada por ausência de sessão.
- [x] Cancelar cupons "Na fila"/"Falhou" (um a um e todos) com confirmação na tela.
- [x] Mesas só liberadas pelo pedido dono; banco bloqueia liberação de mesa com pedido aberto e recoloca itens perdidos fora da lixeira.
