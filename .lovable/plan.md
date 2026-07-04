## Diagnóstico

- `tenants.logo` para o tenant `xofome` está `NULL` — nenhum upload foi persistido.
- O bucket `tenant-assets` é privado e as policies existentes em `storage.objects` cobrem apenas INSERT/UPDATE/DELETE (`Tenant-scoped upload/update/delete tenant-assets`). **Falta a policy SELECT.**
- Sem SELECT, `supabase.storage.from('tenant-assets').createSignedUrl(...)` falha, o handler mostra "Não foi possível gerar URL do logo" e aborta antes de gravar `tenants.logo`. Por isso a sidebar (anexo 2) mostra sempre o fallback "X" da inicial do nome.

## Correção

### 1. Migration — policy SELECT em `storage.objects` para `tenant-assets`

```sql
CREATE POLICY "Tenant-scoped read tenant-assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);
```

Isso destrava `createSignedUrl` (que exige SELECT na row). A URL assinada é entregue via HMAC, então continua funcionando na sidebar/login sem depender de RLS no momento do fetch da imagem.

### 2. Sidebar — nenhuma alteração necessária

`AppSidebar` já lê `tenants.logo` via SELECT + realtime e renderiza `<img src={tenantLogo}>` com fallback para a inicial. Assim que o upload gravar a URL, o logo aparece automaticamente (desktop e mobile).

### 3. `handleLogoUpload` em `src/pages/Configuracoes.tsx`

O código atual (validação de tipo/tamanho, `upload` com `upsert`, `createSignedUrl` de 10 anos, `update` em `tenants.logo`) já está correto. Depois da nova policy o fluxo completa sem erro — sem reescrita.

## Escopo

- 1 migration nova (policy SELECT em `storage.objects`).
- Nenhuma alteração de código frontend.
