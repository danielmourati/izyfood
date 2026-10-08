# Corrigir o alerta "Untrusted website" do QZ Tray

## O que foi verificado
- O certificado único Degust/Menuzin existe no banco (criado hoje, 03:39) e o app já envia esse certificado e assina com SHA512, que é o formato que o QZ Tray espera.
- O `.bat` atual depende de um único método de confiança: gravar `override.crt` na pasta do QZ Tray. Ele não confere se funcionou, não mostra a versão do QZ Tray e não deixa registro do que aconteceu.
- O Gerenciador de Sites (sua captura) está vazio. Isso é esperado: o certificado nunca foi adicionado ali.
- Causa provável (ainda não confirmada no Windows): o QZ Tray não está lendo o `override.crt`. Isso pode acontecer pela versão instalada, por estar em outra pasta, ou porque o QZ Tray reabre com o mesmo usuário administrador que rodou o `.bat`. Outra possibilidade: o site publicado (degust.app) ainda está com a versão antiga das telas.

## O que será feito

1. **Novo `.bat` mais robusto** (usa três métodos de confiança ao mesmo tempo)
   - Procura o QZ Tray em todos os locais possíveis (Arquivos de Programas, x86, AppData).
   - Grava o `override.crt` e também a linha `authcert.override` no `qz-tray.properties`, para indicar ao QZ Tray qual arquivo usar.
   - Adiciona o certificado à lista "Allowed" do Gerenciador de Sites pelo comando do próprio QZ Tray (`--allow`, com `--whitelist` como alternativa para versões antigas).
   - Salva uma cópia do certificado em `C:\ProgramData\Degust\degust-cert.pem`.
   - Mostra a versão do QZ Tray e confere se cada passo funcionou ("OK"/"FALHOU").
   - Grava um registro em `C:\ProgramData\Degust\qz-setup.log` para você me enviar se algo falhar.
   - Reabre o QZ Tray como usuário normal, não como administrador.

2. **Caminho manual garantido na tela de configuração do QZ Tray**
   - Botão "Baixar certificado (cert.pem)".
   - Passo a passo ilustrado: ícone do QZ Tray > Advanced > Site Manager > botão **+** > escolher `cert.pem` > Close. Este é o mesmo painel da sua captura e funciona em qualquer versão.

3. **Diagnóstico no app**
   - Mostra a versão do QZ Tray conectada, a "impressão digital" do certificado que o app está usando e se a assinatura foi aceita. Assim dá para confirmar que o computador confia no mesmo certificado.

4. **Publicar a versão atualizada** para que degust.app use o novo fluxo (hoje as correções podem estar só na prévia).

## Como testar depois
- Baixar o novo `.bat` e rodar como administrador. Conferir se todas as linhas mostram "OK".
- Se o alerta continuar, usar o caminho manual (Site Manager > +) com o `cert.pem` baixado.
- Clicar em "Testar de novo": deve conectar sem o alerta e mostrar o diagnóstico em verde.

## Detalhes técnicos
- `src/lib/qz-installer.ts`: reescrever `buildDegustBat`. Ele vai gravar o PEM em `%ProgramData%\Degust\degust-cert.pem` e copiá-lo para `override.crt`. Também vai trocar ou adicionar `authcert.override=<caminho>` no `qz-tray.properties` da pasta de instalação e de `%APPDATA%\qz`. Depois roda `qz-tray-console.exe --allow "<pem>"` e, se falhar, `--whitelist`. Fecha o processo com `taskkill` (incluindo `javaw` com título QZ) e reabre com `explorer.exe "<qz-tray.exe>"` para não herdar a elevação. Toda a saída vai para o log.
- `src/components/QzSetupModal.tsx`: adicionar o download de `cert.pem`, o passo a passo do Site Manager e o painel de diagnóstico, com `qz.api.getVersion()` e o SHA-256 do PEM calculado com `crypto.subtle`.
- `src/lib/printer.ts`: expor a versão e o último erro de assinatura (`qz-sign`) para o diagnóstico.
- Funções `qz-cert`/`qz-sign` não mudam.
