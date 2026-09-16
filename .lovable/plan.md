# Impressora Bluetooth no menu do pedido (mobile)

Adicionar uma seção de conexão da impressora Bluetooth dentro do menu hambúrguer do cabeçalho do pedido (o "Menu do Pedido - Mesa X"), para que o atendente pareie e teste a impressora do próprio aparelho sem sair da comanda.

## O que o atendente verá

Um novo bloco "Impressora Bluetooth (Este Aparelho)" no menu, abaixo das opções básicas, com:

- Status atual: Conectado / Desconectado, com o nome do aparelho pareado (ou "Nenhum pareado").
- Botão **Parear / Buscar** (abre o seletor Bluetooth do navegador).
- **Reconectar** quando desconectado, ou **Desconectar** quando conectado.
- **Teste de impressão** para confirmar que o cupom sai.
- Chave **Usar Bluetooth como padrão neste aparelho** (mesma preferência já usada nas configurações).
- Mensagem curta na própria seção quando o navegador não tiver suporte a Bluetooth (ex.: iPhone/Safari), orientando usar a impressão pelo navegador.

Disponível para todos os usuários, sem exigir permissão, já que a conexão é local do aparelho.

Retorno visual dentro da própria seção (linha de status e mensagens em texto), sem notificações flutuantes.

## Detalhes técnicos

- Arquivo novo: `src/components/BluetoothPrinterSection.tsx` — componente compacto que consome `usePrinter()` (`btConnected`, `btDeviceName`, `lastPairedName`, `btPriorityDefault`, `pairBluetooth`, `reconnectPrinter`, `forgetPrinter`, `toggleBluetoothPriorityDefault`, `printTest`) e `isBluetoothAvailable()` de `src/lib/printer.ts`. Estados locais para "pareando"/"testando" e mensagem de resultado inline.
- `src/components/consumer/ConsumerOrderModal.tsx`: renderizar `<BluetoothPrinterSection />` no diálogo do menu (após o bloco "Opções & Funções Básicas", antes do rodapé "Fechar Menu"), com o mesmo padrão de título de seção em caixa alta.
- Nada de lógica nova de impressão: reaproveita o hook e a persistência em localStorage já existentes; a aba Impressora das Configurações continua igual.
