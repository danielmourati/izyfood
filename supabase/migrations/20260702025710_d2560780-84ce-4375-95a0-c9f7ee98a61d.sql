CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _role app_role;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  _tenant_id := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'atendente'::app_role
  );

  -- Only create tenant membership when an explicit tenant_id was provided.
  -- Superadmins and unlinked accounts are handled elsewhere.
  IF _tenant_id IS NOT NULL AND _role <> 'superadmin' THEN
    INSERT INTO public.tenant_members (user_id, tenant_id, role)
    VALUES (NEW.id, _tenant_id, _role);
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;