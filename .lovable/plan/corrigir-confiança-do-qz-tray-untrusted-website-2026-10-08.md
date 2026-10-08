# Corrigir confiança do QZ Tray ("Untrusted website")

## O que foi verificado

- O certificado do arquivo enviado é idêntico ao salvo para a loja Pastelão Sousa — o .bat gravou o certificado correto.
- **Reinício não acontece:** o .bat tenta reiniciar um "serviço QZ Tray", mas o QZ Tray roda como programa na bandeja do Windows, não como serviço. Sem fechar e abrir o QZ Tray, ele não lê o novo `override.crt` e continua tratando o site como desconhecido (janela "Unrecognized Certificate").
- **Nome com acentos no certificado:** o nome gravado é "Degust · Pastelão Sousa", com "·" e "ã" codificados de forma não padrão. O QZ Tray (Java) pode não reconhecer esse certificado como confiável.
- **Um certificado por loja:** cada loja tem um certificado próprio, mas o Windows aceita só um `override.crt` por computador. Um computador usado por mais de uma loja (ou para testes) perde a confiança ao trocar de loja.
- **Pedido "anônimo":** o aviso "An anonymous request" aparece quando o site não consegue entregar o certificado ao QZ Tray (ex.: conexão feita antes do login carregar ou falha ao buscar o certificado). Hoje essa falha é silenciosa e a conexão segue sem certificado.

## Correção

1. **Certificado único da plataforma Degust**, só com letras simples (ex.: "Degust PDV"), válido para todas as lojas. Instala-se uma vez por computador e serve para qualquer loja.
2. **Assinatura pelo servidor com esse certificado único**, mantendo a exigência de usuário logado.
3. **Conexão só com certificado:** o site espera o login e o certificado antes de conectar; se o certificado falhar, mostra o motivo na tela em vez de cair no pedido anônimo.
4. **Novo configurador .bat:** grava o `override.crt`, fecha o QZ Tray e o abre de novo automaticamente, e remove passos que não funcionam.
5. **Tela de configuração do QZ Tray:** passo explícito "Fechar e abrir o QZ Tray", botão "Testar de novo" que mostra se o certificado foi aceito, e orientação para clicar "Sim" na janela "Unrecognized Certificate" (com permissão de administrador) como alternativa ao .bat.

## O que você fará depois

- Baixar o novo configurador e executar como administrador uma vez em cada computador do caixa.
- Clicar em "Testar de novo": a conexão deve ocorrer sem o aviso "Untrusted website".

## Detalhes técnicos

- Novo segredo/registro global de certificado (cert + chave) gerado uma vez; `qz-cert` passa a retornar o certificado global (CN ASCII `Degust PDV`, O `Degust`); `qz-sign` assina com a chave global. Certificados por loja ficam sem uso (não apagados).
- `src/lib/printer.ts`: `configureQzSecurity` aguarda sessão; `setCertificatePromise` rejeita com erro visível; não conectar se o certificado não carregar; cache do PEM.
- `src/lib/qz-installer.ts` `buildDegustBat`: remover `net stop/start`; usar `taskkill /IM qz-tray.exe /F` (e java do QZ), gravar `override.crt`, relançar `"%QZDIR%\qz-tray.exe"`.
- `src/components/QzSetupModal.tsx`: textos/passos atualizados e mensagem de erro inline.
- Redeploy de `qz-cert` e `qz-sign`.  
Como fica então quando tenho outra aplicação como o Menuzin que também da mesma configuração, ou seja, baixar o cert.pem e setup.bat? Poderíamos implementar um só que possa atender ambos?