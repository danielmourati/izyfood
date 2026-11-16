-- Ensure all tenant_id foreign keys cascade on tenant deletion
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'cash_movements'
      AND constraint_name = 'cash_movements_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.cash_movements DROP CONSTRAINT cash_movements_tenant_id_fkey;
    ALTER TABLE public.cash_movements
      ADD CONSTRAINT cash_movements_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'attendant_permissions'
      AND constraint_name = 'attendant_permissions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.attendant_permissions DROP CONSTRAINT attendant_permissions_tenant_id_fkey;
    ALTER TABLE public.attendant_permissions
      ADD CONSTRAINT attendant_permissions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'commission_records'
      AND constraint_name = 'commission_records_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.commission_records DROP CONSTRAINT commission_records_tenant_id_fkey;
    ALTER TABLE public.commission_records
      ADD CONSTRAINT commission_records_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Trigger function: BEFORE DELETE on public.tenants
-- Deletes all non-superadmin users tied exclusively to the tenant being deleted
CREATE OR REPLACE FUNCTION public.handle_before_delete_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids uuid[];
BEGIN
  -- Collect all non-superadmin users belonging to this tenant who do not belong to any other tenant
  SELECT ARRAY_AGG(DISTINCT tm.user_id)
  INTO v_user_ids
  FROM public.tenant_members tm
  WHERE tm.tenant_id = OLD.id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = tm.user_id AND ur.role = 'superadmin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.tenant_members other_tm
      WHERE other_tm.user_id = tm.user_id AND other_tm.tenant_id <> OLD.id
    );

  -- Remove tenant_members for this tenant first
  DELETE FROM public.tenant_members WHERE tenant_id = OLD.id;

  IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
    DELETE FROM public.attendant_permissions WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.user_roles WHERE user_id = ANY(v_user_ids) AND role <> 'superadmin';
    DELETE FROM public.profiles WHERE id = ANY(v_user_ids);
    DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_tenant_users_before_tenant_delete ON public.tenants;
CREATE TRIGGER trg_delete_tenant_users_before_tenant_delete
  BEFORE DELETE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_before_delete_tenant();

-- Trigger function: AFTER DELETE on public.tenant_members
-- Guarantees that if a tenant_members row is deleted (including via ON DELETE CASCADE)
-- and the user has no remaining tenant memberships and is not superadmin, the user is deleted
CREATE OR REPLACE FUNCTION public.handle_after_delete_tenant_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Keep superadmins intact
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = OLD.user_id AND ur.role = 'superadmin'
  ) THEN
    RETURN OLD;
  END IF;

  -- If the user still belongs to another existing tenant, keep the user
  IF EXISTS (
    SELECT 1 FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.user_id = OLD.user_id AND tm.tenant_id <> OLD.tenant_id
  ) THEN
    RETURN OLD;
  END IF;

  -- Otherwise delete user records and auth account
  DELETE FROM public.attendant_permissions WHERE user_id = OLD.user_id;
  DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role <> 'superadmin';
  DELETE FROM public.profiles WHERE id = OLD.user_id;
  DELETE FROM auth.users WHERE id = OLD.user_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_user_after_tenant_member_delete ON public.tenant_members;
CREATE TRIGGER trg_cleanup_user_after_tenant_member_delete
  AFTER DELETE ON public.tenant_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_after_delete_tenant_member();

