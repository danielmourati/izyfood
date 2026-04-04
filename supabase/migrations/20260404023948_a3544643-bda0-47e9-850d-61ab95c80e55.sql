
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _role app_role;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  -- Determine tenant (from metadata or default)
  _tenant_id := COALESCE(
    (NEW.raw_user_meta_data->>'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );

  -- Determine role (from metadata or default 'atendente')
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::app_role,
    'atendente'::app_role
  );

  -- Create tenant membership
  INSERT INTO public.tenant_members (user_id, tenant_id, role)
  VALUES (NEW.id, _tenant_id, _role);

  -- Create user_role entry
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
