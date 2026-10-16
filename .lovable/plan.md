# Taxa de serviço, datas padrão e menu expandido

## Causas encontradas (tela Caixa)
- **Taxa de serviço R$ 0,00:** o total soma a taxa procurando o pedido apenas na lista de pedidos carregada na tela; pedidos já finalizados normalmente não estão nela, então a soma dá zero.
- **Datas:** "Hoje", "Ontem" etc. e o filtro usam o horário universal; depois das 21h (Brasília) "Hoje" vira o dia seguinte, e o início do dia começa às 21h da véspera.
- **Sem dados ao abrir:** os campos começam vazios e nada é buscado até clicar em Filtrar.

## Correções
1. **Taxa de Serviço & Comissões**
   - Buscar a taxa direto dos pedidos no banco (pedidos das vendas do período, tipo Mesa) em vez da lista em memória.
   - Abrir já com INÍCIO e FIM = hoje e carregar os dados automaticamente.
2. **Histórico de Caixa**
   - Abrir com INÍCIO e FIM = hoje e filtrar automaticamente.
3. **Datas no fuso local** nos atalhos e nos filtros das duas seções (início 00:00 e fim 23:59 do dia local).
4. **Menu lateral** aberto (expandido) por padrão.

## Detalhes técnicos
- `src/pages/Caixa.tsx`: helper `localISODate(d)` e `localDayStart/End`; em `handleSearch`, após `sales`, `select('id, order_type, service_fee').in('id', orderIds)` em `orders` e somar `service_fee` onde `order_type='mesa'`; `useState(todayLocal)` + `useEffect` disparando `handleSearch`/`handleFilterHistory` na montagem.
- `src/components/Layout.tsx`: `SidebarProvider defaultOpen={true}`.
