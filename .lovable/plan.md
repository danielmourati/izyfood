# Fechar o fluxo de instalação do QZ Tray por tenant

## Problema

Hoje geramos `cert.pem` + `private_key_pem` no banco (tabela `qz_tray_certs`) e o `.bat` copia o cert para o QZ Tray. Mas:

1. **O cliente nunca assina as mensagens** — `src/lib/printer.ts` chama `qz.websocket.connect` sem `setCertificatePromise` nem `setSignaturePromise`. Sem assinatura, o QZ Tray trata a página como "Untrusted website" e mostra o pop-up de autorização (exatamente o mockup do anexo), mesmo com o cert instalado.
2. **O `.bat` grava no caminho errado.** Ele escreve em `%QZDIR%\auth\override.crt`. O QZ Tray 2.1+ lê `%ProgramFiles%\QZ Tray\override.crt` (raiz do install dir), não a subpasta `auth`.
3. **Não há endpoint de assinatura.** A chave privada precisa ficar no servidor — o front envia o nonce, o servidor devolve a assinatura SHA-512.

Sem 1+2+3, o admin baixa os arquivos mas o pop-up continua aparecendo — o fluxo prometido no modal ("sem pop-up de autorização") não se cumpre.

## Escopo

Nada muda em UI/UX visível fora do modal. Apenas fecha o loop técnico.

## 1. Edge Function `qz-sign` (nova)

`supabase/functions/qz-sign/index.ts`

- `POST { request: string }` autenticado (JWT do tenant).
- Busca `private_key_pem` de `qz_tray_certs` pelo tenant do usuário (mesma resolução usada em `qz-cert`).
- Assina `request` com RSA-SHA512 usando `node-forge` e devolve `{ signature: base64 }`.
- Retorna 404 se ainda não houver cert (força o front a chamar `qz-cert` antes).
- `verify_jwt = true` (default). Sem CORS extra além do padrão já usado em `qz-cert`.

## 2. Wiring de segurança no cliente

`src/lib/printer.ts`

- Antes de `qz.websocket.connect`, uma única vez por sessão:
  - `qz.security.setCertificatePromise((resolve, reject) => fetchTenantCertPem().then(({pem}) => resolve(pem)).catch(reject))`
  - `qz.api.setSha256Type(...)` não é necessário; usar default SHA-512.
  - `qz.security.setSignatureAlgorithm('SHA512')`
  - `qz.security.setSignaturePromise(toSign => (resolve, reject) => supabase.functions.invoke('qz-sign', { body: { request: toSign }}).then(r => resolve(r.data.signature)).catch(reject))`
- Novo helper `configureQzSecurity()` chamado do `ensureQzConnected()` antes do `connect`. Idempotente via flag de módulo.
- Import dinâmico do `fetchTenantCertPem` (já existe em `src/lib/qz-installer.ts`) para evitar ciclo.

## 3. Corrigir o caminho do `.bat`

`src/lib/qz-installer.ts` — função `buildDegustBat`:

- Trocar `set "CERTFILE=%QZDIR%\auth\override.crt"` por `set "CERTFILE=%QZDIR%\override.crt"`.
- Remover o `mkdir "%QZDIR%\auth"`.
- Adicionar comentário no cabeçalho do `.bat` explicando qual arquivo é gerado.
- Manter o restante (elevação, stop/start do serviço, mensagem final).

Efeito: o QZ Tray passa a reconhecer o cert como override permanente e, combinado com a assinatura do passo 2, deixa de mostrar o pop-up.

## 4. Persistência — sem novos arquivos no banco

A tabela `qz_tray_certs(tenant_id, cert_pem, private_key_pem)` já cobre o que precisamos:

- `cert_pem` é servido pela função `qz-cert` (existente) para o `.bat` e para `setCertificatePromise`.
- `private_key_pem` fica confinado ao servidor e é usado apenas pela nova `qz-sign`.
- Sem migração nova.

## 5. Verificação

Após o merge, no ambiente do admin:

1. Abrir `/configuracoes → Impressora → Como instalar`.
2. Baixar `.bat`, rodar como admin no Windows com QZ Tray instalado.
3. Voltar e clicar em "Testar de novo" → deve ficar verde **sem** o pop-up "Action Required".
4. `Imprimir Teste` envia direto para a impressora selecionada.

## Arquivos afetados

- new  `supabase/functions/qz-sign/index.ts`
- edit `supabase/config.toml` (registrar `qz-sign`)
- edit `src/lib/printer.ts` (wiring de assinatura)
- edit `src/lib/qz-installer.ts` (corrigir path do override.crt)

## Detalhes técnicos

- QZ Tray usa `override.crt` na raiz do install dir para pular a etapa de confiança; assinatura RSA-SHA512 é o default do `qz-tray` JS a partir de 2.1.
- `node-forge`: `forge.pki.privateKeyFromPem(pem).sign(md)` com `forge.md.sha512.create()`, resultado em `forge.util.encode64`.
- `supabase.functions.invoke` já envia JWT do usuário — a função reutiliza a resolução de `tenant_id` de `qz-cert`.
- Nenhuma dependência nova no front (`qz-tray` já instalado).
- Sem alteração em `client.ts`/`types.ts`.
