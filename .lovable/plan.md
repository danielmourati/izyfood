# Reimpressão indevida: diagnóstico e ajuste final

## O que a investigação mostrou (últimos 3 dias, todas as lojas)
- **Nenhuma impressão duplicada registrada.** Nenhum cupom foi enviado ao papel mais de uma vez; a trava "enviado uma vez, nunca mais" está funcionando.
- **Existe um único cupom pendente**: "Conta do cliente" do Zezinho (criado às 08:39, celular). O Caixa "Computador" tentou **237 vezes em 40 minutos** e todas falharam *antes* de enviar ("Nada foi enviado para a impressora do caixa") — ou seja, a impressora do computador não está acessível (provavelmente o QZ Tray/impressora desconectado). Nada saiu no papel, mas o app insiste sem parar a cada ~10s.
- Há um registro antigo de Caixa do Zezinho parado há 11 dias (inofensivo, mas sujeira).

## Conclusão
A reimpressão duplicada está sanada. O que resta é a **repetição automática sem limite** de cupons que falham antes do envio — se a impressora voltar horas depois, uma conta antiga sairia sem ninguém pedir.

## Ajustes propostos
1. **Limite de tentativas automáticas**: um cupom com falha é tentado automaticamente no máximo 3 vezes (com intervalo crescente). Depois fica "Falhou" e só sai com **Forçar impressão** do usuário.
2. **Validade da reimpressão automática**: cupons com mais de 10 minutos não são mais impressos automaticamente; exigem ação do usuário.
3. **Fila mostra o motivo e o número de tentativas** ("3 tentativas — impressora do Caixa não respondeu").
4. **Limpeza**: remover o registro de Caixa antigo do Zezinho e encerrar o loop do cupom atual (fica como "Falhou", aguardando forçar ou cancelar).

## Detalhes técnicos
- `canAutoPrintJob` (print-queue.ts): bloquear quando `attempts >= 3` ou `created_at` > 10 min; `force_print_jobs` continua liberando manualmente (zera o contador de tentativas automáticas mantendo intenção `reprint`).
- `claim_print_job_for_host`: mesma regra no banco para hosts com versão antiga.
- Testes em `print-queue-auto.test.ts` para o limite de 3 tentativas e os 10 minutos.
