## Problema

O upload do logo em `/configuracoes` (aba Geral) não renderiza a imagem nem persiste. O código atual em `src/pages/Configuracoes.tsx` (`handleLogoUpload`, linhas 255-273) tem falhas:

1. O `update` na tabela `tenants` **não verifica erro** — se a RLS bloquear (usuário sem admin/tenant_id), a falha é silenciada e o usuário vê "Logo atualizada!" mesmo sem persistir.
2. O bucket `tenant-assets` é público, mas o objeto pode não estar acessível se o path foi salvo mas o UPDATE do DB falhou → imagem "some" no próximo reload.
3. Sem log/console para diagnóstico do que retorna cada etapa.
4. `file.name.split('.').pop()` pode devolver o próprio nome se não houver extensão; melhor usar `file.type` como fallback.

RLS verificada:
- Storage `tenant-assets` INSERT/UPDATE OK (path `${tenantId}/...`)
- `tenants` UPDATE só para `is_tenant_admin` do próprio tenant — se a role não estiver em `admin/superadmin` em `tenant_members`, o update silencia.

## Correção

**Arquivo:** `src/pages/Configuracoes.tsx` — refatorar `handleLogoUpload`:

1. Validar tipo/extensão da imagem antes do upload (fallback via `file.type`).
2. Fazer upload no bucket `tenant-assets` no path `${tenantId}/logo-<timestamp>.<ext>` (nome único evita cache stale de CDN).
3. Após upload, obter `getPublicUrl` e **capturar o erro do `update` na tabela `tenants`** com `await ... ; if (error) { toast.error(msg); return; }`.
4. Só chamar `setTenantLogo(url)` e `toast.success` após confirmação de sucesso do UPDATE.
5. Adicionar `console.error` detalhado em cada falha (upload, update) para diagnóstico.
6. Limpar `e.target.value` no final para permitir re-upload do mesmo arquivo.

Sem mudanças em migrations, RLS ou storage buckets — a infraestrutura já está correta; o bug é apenas de tratamento de erro no cliente que mascarava falhas.

## Arquivos alterados

- `src/pages/Configuracoes.tsx`
