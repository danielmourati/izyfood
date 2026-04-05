-- Create storage bucket for tenant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true);

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- RLS policies for tenant-assets bucket
CREATE POLICY "Public read tenant-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated users upload tenant-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated users update tenant-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tenant-assets');

CREATE POLICY "Authenticated users delete tenant-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tenant-assets');

-- RLS policies for product-images bucket
CREATE POLICY "Public read product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users upload product-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users update product-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users delete product-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Allow tenant admins to update their own tenant (name, logo)
CREATE POLICY "Tenant admins can update own tenant"
ON public.tenants
FOR UPDATE
TO authenticated
USING (id = get_user_tenant_id() AND is_tenant_admin(auth.uid()))
WITH CHECK (id = get_user_tenant_id() AND is_tenant_admin(auth.uid()));