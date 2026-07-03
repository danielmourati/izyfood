# Plano de implementação

Quatro entregas relacionadas ao fluxo de impressão em `/configuracoes → Impressora`.

## 1. Modal "Como instalar QZ Tray em 3 passos"

Substituir o link externo do botão **Como instalar** (hoje aponta para `qz.io/download`) por um `Dialog` que replica o mockup enviado.

Arquivo: `src/components/ImpressoraTab.tsx`

- Novo estado `showInstallModal`.
- Botão "Como instalar" abre o modal em vez de navegar.
- Conteúdo do modal:
  1. **Instale o QZ Tray** — botão externo `qz.io/download` (link oficial).
  2. **Baixe e rode o configurador Menuzin (Windows)** — botão laranja `menuzin-qz-setup.bat` que dispara download do `.bat` gerado (item 2 abaixo). Texto de apoio explicando "Executar como administrador" e o aviso do SmartScreen.
  3. **Volte aqui e clique em Testar de novo** — texto informativo.
- Bloco recolhível "Não estou no Windows ou preciso do cert.pem" com botão para baixar o `cert.pem` (item 3 abaixo).
- Rodapé: botão **Fechar** + botão primário **Testar de novo** que chama `handleTestQzConnection()` e mantém o modal aberto mostrando o feedback (`qzFeedback`).
- Manter o card de "Configurar confiança permanente (Windows)" atual mas apontar o botão de instalador para o mesmo modal (fonte única de verdade).

## 2. Gerador do `menuzin-qz-setup.bat`

O `.bat` precisa: (a) copiar o `cert.pem` do tenant para a pasta do QZ Tray, (b) registrar como override, (c) reiniciar o serviço, para que o QZ Tray confie automaticamente nas requisições assinadas por Degust — sem popup por máquina.

Estratégia: gerar o arquivo **no cliente** (sem função edge) a partir de um template embutido, para incluir o nome do tenant e o `cert.pem` correspondente inline.

Arquivos novos:
- `src/lib/qz-installer.ts`
  - `buildMenuzinBat({ tenantName, certPem }): string` — devolve o conteúdo do `.bat`.
  - `downloadMenuzinBat(tenantName, certPem)` — cria `Blob` `application/bat`, dispara download com nome `menuzin-qz-setup.bat`.
  - `downloadCertPem(tenantName, certPem)` — idem para `cert.pem`.

Conteúdo do `.bat` (resumo do template):

```text
@echo off
REM Menuzin/Degust — configurador QZ Tray para {TENANT}
net session >nul 2>&1 || (echo Execute como administrador & pause & exit /b 1)
set QZDIR=%ProgramFiles%\QZ Tray
if not exist "%QZDIR%" set QZDIR=%ProgramFiles(x86)%\QZ Tray
> "%TEMP%\degust-cert.pem" (
{CERT_LINES_ESCAPED}
)
copy /Y "%TEMP%\degust-cert.pem" "%QZDIR%\auth\override.crt" >nul
net stop "QZ Tray" >nul 2>&1
net start "QZ Tray" >nul 2>&1
echo Pronto! Volte ao Degust e clique em Testar de novo.
pause
```

Placeholders substituídos em runtime; `{CERT_LINES_ESCAPED}` = cada linha do PEM emitida como `echo <linha>>>"%TEMP%\degust-cert.pem"` (evita here-doc, seguro para caracteres normais do base64).

## 3. `cert.pem` do tenant

Para o QZ Tray reconhecer as mensagens sem popup, precisamos de um certificado auto-assinado por tenant. Não é gerado no cliente (precisa de chave privada persistida).

Opção adotada: **gerar via Edge Function** e persistir em uma nova tabela, retornando apenas o `cert.pem` público para o front.

Backend (migration + edge function):
- Nova tabela `public.qz_tray_certs`
  - Colunas: `tenant_id uuid unique`, `cert_pem text`, `private_key_pem text`, `created_at`, `updated_at`.
  - GRANT: só `service_role` (nada para `authenticated`/`anon`). O front lê o PEM via edge function.
  - RLS: enabled, sem policies (bloqueio total via PostgREST).
- Edge Function `qz-cert`:
  - `GET` (ou action `get`): retorna `cert_pem` do tenant do JWT; se não existir, gera par RSA 2048 + certificado X.509 auto-assinado (CN = nome do tenant, validade 10 anos) usando `node-forge` via esm.sh, salva e retorna.
  - Somente usuários autenticados; tenant vem do `user_metadata`/`get_user_tenant_id` chamado com service role.

Frontend:
- `src/lib/qz-installer.ts` expõe `fetchTenantCertPem()` que chama a função.
- No modal: ao clicar em `menuzin-qz-setup.bat` ou `Baixar cert.pem`, busca o PEM (com cache em memória), depois dispara o download correspondente.
- Estado `certLoading`/`certError` no modal com feedback via `Alert` (sem toast).

## 4. Impressoras adicionais (cozinha, balcão, bar)

Habilitar múltiplas impressoras já configuráveis; gate por plano conforme mockup.

Arquivos:
- `src/components/ImpressoraTab.tsx`
  - Novo card **Impressoras adicionais (cozinha, balcão, bar)** abaixo do card de impressoras configuradas.
  - Se o tenant estiver no plano Start (checar `storeSettings.plan`/`user.plan`), renderizar o bloco de upsell do mockup (ícone, título com cadeado, descrição, botão "Conhecer o Plano Pro" que navega para `/{slug}/configuracoes?tab=plano`).
  - Se estiver em Pro, renderizar lista das impressoras adicionais com botão "Adicionar impressora de setor" reaproveitando o formulário existente com um campo extra **Setor** (`recibo | cozinha | bar | balcao`).
- `src/hooks/use-printer.ts`
  - Adicionar campo `sector` em `PrinterConfig` e helpers `getPrinterForSector(sector)` (fallback para default).
- Migration: adicionar coluna `sector text not null default 'recibo'` em `printer_configs` (`check` para os 4 valores).
- Consumidores existentes (impressão de comanda/cozinha) permanecem inalterados nesta entrega — apenas o CRUD e o gate. A roteirização por setor será plugada em uma próxima iteração para não sair do escopo de UI/configuração.

## Detalhes técnicos

- Sem novos toasts — feedback via `Alert`/`Badge` (regra do projeto).
- Downloads usam `URL.createObjectURL` + `<a download>`; nada é persistido no repo.
- `node-forge` na edge function via `import forge from "npm:node-forge@1"`.
- Nenhuma edição em `src/integrations/supabase/client.ts`/`types.ts` manual — o codegen roda após a migration.
- Regenerar tipos depende de migrations aprovadas; `printer_configs.sector` é opcional em toda leitura com fallback `'recibo'`.

## Arquivos afetados

- edit `src/components/ImpressoraTab.tsx`
- edit `src/hooks/use-printer.ts`
- new  `src/lib/qz-installer.ts`
- new  `supabase/functions/qz-cert/index.ts`
- edit `supabase/config.toml` (registrar função `qz-cert`, verify_jwt = true)
- new migration: cria `qz_tray_certs`, adiciona `printer_configs.sector`.
