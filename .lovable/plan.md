# Certificado QZ Tray único para Degust e Menuzin

## Objetivo
Um só certificado e um só arquivo de configuração (.bat) que faz o QZ Tray confiar nos dois aplicativos, eliminando o alerta "Untrusted website" em ambos.

## Estado atual (verificado)
- O Degust já usa um certificado global único (CN "Degust PDV"), guardado na tabela `qz_tray_certs` com ID global, válido por 10 anos.
- A função `qz-sign` assina as requisições de impressão com a chave privada desse certificado, mas exige login de usuário do Degust.
- O instalador `.bat` copia o `cert.pem` para `override.crt` do QZ Tray — esse arquivo já vale para qualquer site que assine com a mesma chave.

## O que falta
O Menuzin é um projeto separado e hoje não consegue assinar requisições com a chave do Degust. Sem isso, ele continua aparecendo como site não confiável.

## Plano

### 1. Liberar assinatura para o Menuzin (backend Degust)
- Atualizar a função `qz-sign` para aceitar, além do login de usuário, um segredo compartilhado (`QZ_SHARED_SECRET`) enviado pelo Menuzin no cabeçalho da requisição.
- Cadastrar esse segredo como secret do backend.
- Liberar CORS para o domínio do Menuzin (menuzin.app) nas funções `qz-sign` e `qz-cert`.

### 2. Tornar o certificado baixável sem login
- Criar endpoint público (ou liberar `qz-cert` com o mesmo segredo) para o Menuzin obter o `cert.pem` e exibir o nome amigável "Degust / Menuzin".

### 3. Ajustar o instalador (.bat)
- Renomear mensagens do `.bat` para "Degust / Menuzin" e deixar claro que uma única execução configura os dois aplicativos.
- O conteúdo do certificado não muda — quem já instalou não precisa rodar de novo.

### 4. Lado do Menuzin (projeto separado)
- No projeto Menuzin, configurar a conexão QZ para chamar a função `qz-sign` do Degust com o segredo compartilhado, em vez de assinar localmente.
- Entrego o trecho de código pronto e as instruções para aplicar lá (não tenho acesso ao código do Menuzin neste projeto).

## Detalhes técnicos
- Arquivos: `supabase/functions/qz-sign/index.ts`, `supabase/functions/qz-cert/index.ts`, `src/lib/qz-installer.ts`, `src/components/QzSetupModal.tsx`.
- Novo secret: `QZ_SHARED_SECRET` (valor gerado aleatoriamente).
- Nenhuma migração de banco necessária; o certificado global existente é reutilizado.
- Segurança: o segredo só permite assinar requisições QZ; não dá acesso a dados de lojas.

## Validação
- Testar `qz-sign` com o segredo (sem login) retornando assinatura válida.
- Testar que requisição sem login e sem segredo continua recusada.
- Confirmar no Windows que o QZ Tray não mostra mais o alerta para nenhum dos dois apps (validação sua, pois exige o QZ Tray instalado).
