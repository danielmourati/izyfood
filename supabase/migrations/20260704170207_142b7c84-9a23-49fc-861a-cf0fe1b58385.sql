CREATE POLICY "Tenant-scoped read tenant-assets"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tenant-assets'
  AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
);