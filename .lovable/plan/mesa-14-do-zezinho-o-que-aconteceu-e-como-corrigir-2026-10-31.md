# Mesa 14 do Zezinho: o que aconteceu e como corrigir

## O que o banco mostra (hoje, 31/10)
- O pedido da mesa 14 foi aberto às 11:01 (horário de Fortaleza) pelo "Atendente" e tinha 25 itens, cerca de R$ 550.
- Às 15:46 a mesa 14 foi liberada com esse pedido **ainda aberto**. Quem liberou foi o usuário Zezinho.
- Logo depois, o pedido apareceu **na mesa 2**, marcado como "finalizado", com R$ 563. Ele **não tem pagamento, venda nem horário de fechamento**.
- A mesa 2 tinha sido paga às 15:39 (outro pedido, R$ 748). Às 15:57 abriu um pedido novo na mesa 2 (R$ 68, aberto agora).
- Conclusão: o pedido da 14 foi **movido para a mesa 2** e, em seguida, **fechado sem pagamento**. Isso o tirou das mesas sem passar pelo caixa. Nenhum item foi apagado: os 25 itens continuam salvos.

Ainda não sei qual tela fez o "fechar sem pagamento". O primeiro passo é rastrear isso.

## Plano
1. **Recuperar a mesa 14 agora**: devolver o pedido para a mesa 14 como aberto, com os itens intactos, e ocupar a mesa 14. A mesa 2 continua com o pedido novo dela. Tudo fica registrado na auditoria.
2. **Achar a causa**: revisar no app os caminhos que trocam a mesa do pedido e os que marcam o pedido como finalizado. Suspeitos: trocar de mesa quando a mesa de destino acabou de ser paga, e um aparelho com a tela desatualizada da mesa 2 "fechando" o pedido que chegou depois.
3. **Trava no banco**: recusar marcar como finalizado um pedido de mesa com itens que não tenha venda nem pagamento registrado. Também recusar mover um pedido para uma mesa cujo pedido acabou de ser fechado sem confirmação nova.
4. **Auditoria**: registrar toda troca de mesa (de X para Y, quem fez) e todo fechamento de pedido, para casos assim aparecerem direto no histórico.
5. **Testes** para as duas regras novas e conferência de que pagar e fechar mesa continuam funcionando.

## Detalhes técnicos
- Pedido: `edda4dd2-c262-404f-b13a-e8116e60e7d8` (status `finalizado`, `table_number=2`, `completed_at` nulo, sem linha em `sales`).
- Auditoria `table_freed` às 18:46:56 UTC por user `54a3080e…`; não existe registro de `move_order_table`, então a troca não foi auditada.
- Recuperação via migração: `status='aberto'`, `table_number=14`, `store_tables` 14 → `occupied` com `order_id`.
- Revisar `move_order_table`, `release_table_of_order`, `StoreContext.tsx`, `ConsumerOrderModal.tsx` e `Mesas.tsx` (atualizações de `status` sem venda).
- Trigger nova em `orders`: bloquear `status → finalizado` para `order_type='mesa'` com itens quando não houver `sales` do pedido nem `completed_at`; auditar mudanças de `table_number` em `audit_order_changes`.
