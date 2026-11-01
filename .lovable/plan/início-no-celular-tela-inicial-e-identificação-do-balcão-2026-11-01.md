# Início no celular, tela inicial e identificação do balcão

## 1. Botão Início no celular (correção)
Hoje, no celular, a página Início sempre redireciona para Mesas — por isso tocar em "Início" não faz nada. A regra será removida: Início abre normalmente em qualquer aparelho.

## 2. Início como tela padrão após o login
Ao entrar, todos (celular e computador) caem na tela Início.

## 3. Pedido de balcão sem "Mesa"
O título da janela de pedido do balcão passa a ser "Novo Pedido - Balcão" (hoje mostra "Mesa 1"), nas duas versões do cabeçalho.

## 4. Identificação do pedido do balcão
- Na janela do pedido do balcão, um campo **"Nome do cliente ou observação"** logo abaixo do cabeçalho, salvo junto com o pedido.
- No card violeta do balcão em Mesas, o centro mostra esse texto (ou o cliente vinculado) no lugar do código "#0b00".
- Se não houver nada, o centro do card fica vazio (continua o rótulo "Balcão", minutos, atendente e valor).
- O texto também aparece na comanda/conta impressa como observação do pedido (já funciona assim).

## Detalhes técnicos
- `src/App.tsx`: `TenantStartPage` passa a renderizar só `<Home />`; remover redirecionamento mobile. Atualizar a regra em AGENTS.md ("On mobile browsers, the tenant root opens Mesas…") para "Tenant root always opens Home".
- `ConsumerOrderModal.tsx` linhas ~1011/1093: título condicional por `orderType === 'balcao'`. Input usa o campo existente `pickupNotes` (sem mudança no banco), visível só no balcão.
- `Mesas.tsx` card balcão: centro = `custName || notes`; remover `#{order.id.slice(0,4)}` e a linha de observações duplicada no rodapé.
