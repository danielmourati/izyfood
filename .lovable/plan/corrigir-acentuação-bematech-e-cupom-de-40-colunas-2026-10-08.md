# Corrigir acentuação Bematech e cupom de 40 colunas

## Diagnóstico confirmado

- Os cupons atualmente codificam o texto em UTF‑8, mas enviam `ESC t 255` para selecionar a tabela da impressora. Esse valor não ativa UTF‑8 na Bematech, portanto os bytes acentuados são interpretados pela tabela errada.
- O perfil ESC/POS salvo no cadastro da impressora ainda não é usado na geração do cupom. As duas impressoras do tenant `quintal-de-casa` estão cadastradas com perfil genérico.
- A largura de impressão e da prévia é centralizada em uma regra compartilhada que ainda define 42 colunas para 80 mm.

## Alterações

1. **Aplicar o perfil Bematech na impressão real**
   - Fazer os geradores de comanda, conta e fechamento receberem o perfil da impressora selecionada.
   - Para `bematech_mp`, enviar o comando de tabela UTF‑8 compatível com Bematech e manter o conteúdo codificado em UTF‑8.
   - Manter uma estratégia compatível para perfis genérico, Epson e Elgin, sem usar o comando inválido atual.
   - Aplicar o mesmo comportamento em impressão USB/QZ Tray, Bluetooth, aplicativo desktop e fila do aparelho host, pois todos compartilham o mesmo gerador de bytes.

2. **Ativar o perfil no tenant atual**
   - Atualizar as impressoras Caixa e Cozinha de `quintal-de-casa` para o perfil Bematech, para que a correção tenha efeito imediato no equipamento informado.

3. **Reduzir o cupom de 80 mm para 40 colunas**
   - Alterar a regra compartilhada de 80 mm de 42 para 40 colunas; 58 mm permanece com 27.
   - Ajustar a divisão entre descrição e preço e eliminar a regra duplicada da prévia, garantindo a mesma quebra de linha na tela e no papel.
   - Atualizar o texto informativo do cadastro de impressora e as referências internas de 42 para 40.

4. **Validar**
   - Adicionar testes de bytes para o perfil Bematech com `Açaí, pão, coração, maçã, café` e confirmar o comando correto antes do texto.
   - Testar comandas, contas e fechamento em 40 colunas, incluindo nomes longos, adicionais e valores alinhados.
   - Executar os testes de impressão e a verificação de tipos; conferir a prévia visual de 80 mm.

## Resultado esperado

- Caracteres acentuados e `ç` impressos corretamente na Bematech.
- Todos os cupons de 80 mm limitados a 40 colunas, com a prévia reproduzindo as mesmas quebras do papel.
