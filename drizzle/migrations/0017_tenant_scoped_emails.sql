ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.tenant_members ADD COLUMN IF NOT EXISTS login_email text;

UPDATE public.tenant_members tm SET email = lower(p.email), login_email = lower(u.email)
FROM public.profiles p, auth.users u
WHERE p.id = tm.user_id AND u.id = tm.user_id AND tm.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_tenant_email_uq
  ON public.tenant_members (tenant_id, lower(email)) WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_tenant_login(_slug text, _email text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((
    SELECT tm.login_email FROM public.tenant_members tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE t.slug = _slug AND lower(tm.email) = lower(trim(_email)) AND tm.login_email IS NOT NULL
    LIMIT 1), lower(trim(_email)));
$$;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_login(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _tenant_id uuid;
  _role app_role;
  _contact text := lower(COALESCE(NULLIF(NEW.raw_user_meta_data->>'contact_email', ''), NEW.email));
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(_contact, '@', 1)), _contact);

  _tenant_id := NULLIF(NEW.raw_user_meta_data->>'tenant_id', '')::uuid;
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'atendente'::app_role);

  IF _tenant_id IS NOT NULL AND _role <> 'superadmin' THEN
    INSERT INTO public.tenant_members (user_id, tenant_id, role, email, login_email)
    VALUES (NEW.id, _tenant_id, _role, _contact, lower(NEW.email));
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;