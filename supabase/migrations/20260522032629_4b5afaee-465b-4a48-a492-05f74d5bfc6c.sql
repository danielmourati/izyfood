-- 1. Add print_settings column if missing
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS print_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Dedupe store_settings keeping the most recently updated row per tenant
WITH ranked AS (
  SELECT id, tenant_id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY updated_at DESC NULLS LAST, id DESC) AS rn
  FROM public.store_settings
)
DELETE FROM public.store_settings s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 3. Unique constraint: one settings row per tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_settings_tenant_id_key'
  ) THEN
    ALTER TABLE public.store_settings
      ADD CONSTRAINT store_settings_tenant_id_key UNIQUE (tenant_id);
  END IF;
END$$;

-- 4. REPLICA IDENTITY FULL (idempotent)
ALTER TABLE public.store_settings REPLICA IDENTITY FULL;

-- 5. Ensure table is in realtime publication (skip if already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'store_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings';
  END IF;
END$$;

-- 6. Tighten UPDATE policy with WITH CHECK to prevent tenant_id rewrites
DROP POLICY IF EXISTS "Tenant admins update store_settings" ON public.store_settings;
CREATE POLICY "Tenant admins update store_settings"
  ON public.store_settings FOR UPDATE TO authenticated
  USING ((tenant_id = get_user_tenant_id()) AND is_tenant_admin(auth.uid()))
  WITH CHECK ((tenant_id = get_user_tenant_id()) AND is_tenant_admin(auth.uid()));