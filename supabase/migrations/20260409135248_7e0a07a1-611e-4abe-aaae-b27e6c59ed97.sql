CREATE POLICY "Public can read tenant branding"
ON public.tenants
FOR SELECT
TO anon
USING (true);